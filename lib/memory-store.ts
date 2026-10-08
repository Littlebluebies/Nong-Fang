// ที่เก็บความจำและอารมณ์ แยกเป็น interface เพื่อให้ test ใช้ของปลอมได้โดยไม่ต้องมี DB จริง

import { getSql } from "./db";

export const MEMORY_KINDS = ["goal", "fact", "preference", "person"] as const;
export type MemoryKind = (typeof MEMORY_KINDS)[number];

export type Memory = { kind: MemoryKind; content: string; createdAt: string };

export interface MemoryStore {
  /** คืน false ถ้ามีความจำข้อความเดียวกันอยู่แล้ว (ไม่บันทึกซ้ำ) */
  saveMemory(userId: string, memory: { kind: MemoryKind; content: string }): Promise<boolean>;
  recallMemories(userId: string, options: { kind?: MemoryKind; limit: number }): Promise<Memory[]>;
  logMood(userId: string, mood: { score: number; label: string }): Promise<void>;
}

export function createPostgresMemoryStore(): MemoryStore {
  return {
    async saveMemory(userId, { kind, content }) {
      const sql = getSql();
      const rows = await sql`
        insert into memories (user_id, kind, content)
        select ${userId}, ${kind}, ${content}
        where not exists (
          select 1 from memories
          where user_id = ${userId} and content = ${content} and deleted_at is null
        )
        returning id`;
      return rows.length > 0;
    },

    async recallMemories(userId, { kind, limit }) {
      const sql = getSql();
      const rows = await sql`
        select kind, content, created_at
        from memories
        where user_id = ${userId}
          and deleted_at is null
          and (${kind ?? null}::text is null or kind = ${kind ?? null})
        order by created_at desc
        limit ${limit}`;
      return rows.map((r) => ({
        kind: r.kind as MemoryKind,
        content: String(r.content),
        createdAt: new Date(r.created_at as string).toISOString(),
      }));
    },

    async logMood(userId, { score, label }) {
      const sql = getSql();
      await sql`insert into mood_logs (user_id, score, label) values (${userId}, ${score}, ${label})`;
    },
  };
}
