// หัวใจของระบบ: ไม่ผูกกับช่องทางใด เว็บ (เฟส 1) และ LINE (เฟส 3) เรียกฟังก์ชันเดียวกัน
// ลำดับ: 1) ด่านคำเสี่ยง → 2) รวม context → 3) เรียก LLM

import { openai } from "@ai-sdk/openai";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { MAX_HISTORY_MESSAGES, MAX_OUTPUT_TOKENS } from "./config";
import { buildSystemPrompt, PROMPT_VERSION } from "./prompt";
import { detectCrisis } from "./safety";
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
}) {
  const { channel, userId, messages } = input;

  const model = process.env.OPENAI_MODEL;
  if (!model) throw new Error("ยังไม่ได้ตั้งค่า OPENAI_MODEL");

  // 1) ด่านคำเสี่ยง ดูเฉพาะข้อความล่าสุดของผู้ใช้
  const lastUserMessage = messages.findLast((m) => m.role === "user");
  const crisis = detectCrisis(lastUserMessage ? getMessageText(lastUserMessage) : "");

  // 2) รวม context: system prompt + ประวัติแค่ช่วงล่าสุด
  const recent = messages.slice(-MAX_HISTORY_MESSAGES);

  // 3) เรียก LLM
  const result = streamText({
    model: openai(model),
    system: buildSystemPrompt({ crisis }),
    messages: await convertToModelMessages(recent),
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    onError: ({ error }) => {
      console.error(JSON.stringify({ event: "llm_error", channel, message: String(error) }));
    },
    onFinish: ({ usage }) => {
      // บันทึกเฉพาะ metadata ห้ามบันทึกเนื้อหาแชท
      console.log(
        JSON.stringify({
          event: "chat_finished",
          channel,
          userId,
          crisis,
          promptVersion: PROMPT_VERSION,
          historyMessages: recent.length,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
        }),
      );
    },
  });

  return { crisis, result };
}
