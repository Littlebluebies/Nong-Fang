// หัวใจของระบบ: ไม่ผูกกับช่องทางใด เว็บ (เฟส 1) และ LINE (เฟส 3) เรียกฟังก์ชันเดียวกัน
// ลำดับ: 1) ด่านคำเสี่ยง → 2) รวม context → 3) เรียก LLM (เฟส 2: พร้อม tools ความจำ)

import { openai } from "@ai-sdk/openai";
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";
import { MAX_HISTORY_MESSAGES, MAX_OUTPUT_TOKENS, MAX_TOOL_STEPS } from "./config";
import { isDatabaseConfigured } from "./db";
import { createPostgresMemoryStore, type MemoryStore } from "./memory-store";
import { buildSystemPrompt, PROMPT_VERSION } from "./prompt";
import { detectCrisis } from "./safety";
import { createTools } from "./tools";
import type { ChatMessage } from "./types";

export type Channel = "web" | "line";

export function getMessageText(message: UIMessage): string {
  return message.parts.map((part) => (part.type === "text" ? part.text : "")).join("");
}

export async function runChat(input: {
  channel: Channel;
  /** เฟส 1 ใช้ค่าคงที่ "owner" */
  userId: string;
  messages: ChatMessage[];
  /** ไม่ใส่ = ใช้ PostgreSQL ถ้ามี DATABASE_URL, null = ปิดความจำ */
  memoryStore?: MemoryStore | null;
}) {
  const { channel, userId, messages } = input;
  const memoryStore =
    input.memoryStore !== undefined
      ? input.memoryStore
      : isDatabaseConfigured()
        ? createPostgresMemoryStore()
        : null;

  const model = process.env.OPENAI_MODEL;
  if (!model) throw new Error("ยังไม่ได้ตั้งค่า OPENAI_MODEL");

  // 1) ด่านคำเสี่ยง ดูเฉพาะข้อความล่าสุดของผู้ใช้
  const lastUserMessage = messages.findLast((m) => m.role === "user");
  const crisis = detectCrisis(lastUserMessage ? getMessageText(lastUserMessage) : "");

  // 2) รวม context: system prompt + ประวัติแค่ช่วงล่าสุด
  const recent = messages.slice(-MAX_HISTORY_MESSAGES);

  // 3) เรียก LLM ถ้ามีที่เก็บความจำ LLM เรียก tool แล้วตอบต่อได้ไม่เกิน MAX_TOOL_STEPS รอบ
  const tools = memoryStore ? createTools({ userId, crisis, store: memoryStore }) : undefined;

  const result = streamText({
    model: openai(model),
    system: buildSystemPrompt({ crisis, memory: Boolean(tools) }),
    messages: await convertToModelMessages(recent),
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    tools,
    stopWhen: stepCountIs(tools ? MAX_TOOL_STEPS : 1),
    onError: ({ error }) => {
      console.error(JSON.stringify({ event: "llm_error", channel, message: String(error) }));
    },
    onFinish: ({ totalUsage, steps }) => {
      // บันทึกเฉพาะ metadata ห้ามบันทึกเนื้อหาแชท
      console.log(
        JSON.stringify({
          event: "chat_finished",
          channel,
          userId,
          crisis,
          promptVersion: PROMPT_VERSION,
          historyMessages: recent.length,
          // ชื่อ tool ที่ถูกเรียก (ไม่บันทึก input ของ tool เพราะเป็นเนื้อหาจากผู้ใช้)
          toolCalls: steps.flatMap((step) => step.toolCalls.map((call) => call.toolName)),
          inputTokens: totalUsage.inputTokens,
          outputTokens: totalUsage.outputTokens,
        }),
      );
    },
  });

  return { crisis, result };
}
