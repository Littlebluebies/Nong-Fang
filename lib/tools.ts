// Tools ของเฟส 2: LLM ตัดสินใจเองว่าจะเรียกเมื่อไหร่ (คำอธิบายแต่ละ tool คือสิ่งที่ LLM อ่าน)
// userId มาจาก closure ไม่รับจาก LLM เพื่อไม่ให้ LLM อ่านหรือเขียนข้อมูลของคนอื่นได้

import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { MEMORY_MAX_CHARS, RECALL_LIMIT } from "./config";
import { MEMORY_KINDS, type MemoryStore } from "./memory-store";

function logToolError(name: string, error: unknown) {
  // บันทึกแค่ชื่อ tool กับ error ห้ามบันทึก input เพราะเป็นเนื้อหาจากผู้ใช้
  console.error(JSON.stringify({ event: "tool_error", tool: name, message: String(error) }));
}

export function createTools(input: { userId: string; crisis: boolean; store: MemoryStore }): ToolSet {
  const { userId, crisis, store } = input;
  let moodLogged = false;

  const recall_memory = tool({
    description:
      "ดึงสิ่งที่เคยจดไว้เกี่ยวกับผู้ใช้ (เป้าหมาย เรื่องที่เล่า สิ่งที่ชอบ คนรอบตัว) ใช้เมื่อผู้ใช้ถามถึงเรื่องที่เคยเล่า หรือเมื่อรู้แล้วจะตอบได้ตรงใจขึ้น",
    inputSchema: z.object({
      kind: z.enum(MEMORY_KINDS).optional().describe("กรองตามประเภท ไม่ใส่ = ทุกประเภท"),
    }),
    execute: async ({ kind }) => {
      try {
        const memories = await store.recallMemories(userId, { kind, limit: RECALL_LIMIT });
        return { ok: true, memories };
      } catch (error) {
        logToolError("recall_memory", error);
        return { ok: false, memories: [] };
      }
    },
  });

  const log_mood = tool({
    description:
      "บันทึกอารมณ์ของผู้ใช้ตอนนี้ ใช้เมื่อผู้ใช้บอกความรู้สึกของตัวเองชัดเจน เรียกได้ครั้งเดียวต่อข้อความ ไม่ต้องบอกผู้ใช้ว่าบันทึกแล้ว",
    inputSchema: z.object({
      score: z.number().int().min(1).max(5).describe("1 = แย่มาก, 3 = เฉยๆ, 5 = ดีมาก"),
      label: z.string().trim().min(1).max(30).describe("คำสั้นๆ เช่น เหนื่อย, โล่ง, กังวล"),
    }),
    execute: async ({ score, label }) => {
      if (moodLogged) return { ok: false, reason: "บันทึกอารมณ์ไปแล้วในข้อความนี้" };
      moodLogged = true;
      try {
        await store.logMood(userId, { score, label });
        return { ok: true };
      } catch (error) {
        logToolError("log_mood", error);
        return { ok: false };
      }
    },
  });

  const save_memory = tool({
    description:
      "จดเรื่องสำคัญของผู้ใช้ไว้ใช้ในแชทครั้งหน้า เช่น เป้าหมาย เรื่องงาน คนสำคัญ สิ่งที่ชอบหรือไม่ชอบ เขียนเป็นประโยคสั้นๆ ด้วยภาษาของเรา ห้ามจดเรื่องสุขภาพจิตที่รุนแรง ไม่ต้องบอกผู้ใช้ว่าจดแล้ว ยกเว้นเขาขอให้จำ",
    inputSchema: z.object({
      kind: z.enum(MEMORY_KINDS),
      content: z.string().trim().min(1).max(MEMORY_MAX_CHARS),
    }),
    execute: async ({ kind, content }) => {
      try {
        const saved = await store.saveMemory(userId, { kind, content });
        return saved ? { ok: true } : { ok: true, note: "จดไว้แล้วก่อนหน้านี้" };
      } catch (error) {
        logToolError("save_memory", error);
        return { ok: false };
      }
    },
  });

  // ข้อความที่ติดด่านคำเสี่ยงไม่ให้จดลงความจำ (docs/phase-2-plan.md ข้อ D4)
  return crisis ? { recall_memory, log_mood } : { save_memory, recall_memory, log_mood };
}
