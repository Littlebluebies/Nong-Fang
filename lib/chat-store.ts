// ที่เก็บประวัติแชท (เฟส 2) แยกเป็น interface เหมือน memory-store เพื่อให้ test ใช้ของปลอมได้
// ทุก query ที่รับ chatId จากหน้าเว็บต้องเช็ค user_id ด้วย กันการอ่านหรือลบแชทของคนอื่น

import type { Channel } from "./chat-pipeline";
import { getSql } from "./db";
import type { ChatMessage } from "./types";

export interface ChatStore {
  createChat(userId: string, channel: Channel): Promise<string>;
  chatExists(userId: string, chatId: string): Promise<boolean>;
  latestChatId(userId: string, channel: Channel): Promise<string | null>;
  /** เพิ่มข้อความผู้ใช้ ถ้ามีอยู่แล้ว (กด "ลองอีกครั้ง") ให้ลบข้อความที่ตามหลังทิ้ง */
  appendUserMessage(chatId: string, message: ChatMessage): Promise<void>;
  saveMessage(chatId: string, message: ChatMessage): Promise<void>;
  /** ข้อความล่าสุด limit ข้อความ เรียงจากเก่าไปใหม่ */
  loadMessages(chatId: string, limit: number): Promise<ChatMessage[]>;
  deleteChat(userId: string, chatId: string): Promise<boolean>;
}

type MessageRow = { id: string; role: "user" | "assistant"; parts: unknown; metadata: unknown };

function toMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    role: row.role,
    parts: row.parts as ChatMessage["parts"],
    ...(row.metadata ? { metadata: row.metadata as ChatMessage["metadata"] } : {}),
  };
}

export function createPostgresChatStore(): ChatStore {
  return {
    async createChat(userId, channel) {
      const sql = getSql();
      const rows = await sql`insert into chats (user_id, channel) values (${userId}, ${channel}) returning id`;
      return String(rows[0].id);
    },

    async chatExists(userId, chatId) {
      const sql = getSql();
      const rows = await sql`select 1 from chats where id = ${chatId} and user_id = ${userId}`;
      return rows.length > 0;
    },

    async latestChatId(userId, channel) {
      const sql = getSql();
      const rows = await sql`
        select c.id
        from chats c
        left join messages m on m.chat_id = c.id
        where c.user_id = ${userId} and c.channel = ${channel}
        group by c.id
        order by max(coalesce(m.created_at, c.created_at)) desc
        limit 1`;
      return rows[0] ? String(rows[0].id) : null;
    },

    async appendUserMessage(chatId, message) {
      const sql = getSql();
      await sql.transaction([
        sql`
          insert into messages (id, chat_id, role, parts)
          values (${message.id}, ${chatId}, 'user', ${JSON.stringify(message.parts)}::jsonb)
          on conflict (id) do nothing`,
        sql`
          delete from messages
          where chat_id = ${chatId}
            and created_at > (select created_at from messages where id = ${message.id} and chat_id = ${chatId})`,
      ]);
    },

    async saveMessage(chatId, message) {
      const sql = getSql();
      const metadata = message.metadata ? JSON.stringify(message.metadata) : null;
      await sql`
        insert into messages (id, chat_id, role, parts, metadata)
        values (${message.id}, ${chatId}, ${message.role}, ${JSON.stringify(message.parts)}::jsonb, ${metadata}::jsonb)
        on conflict (id) do nothing`;
    },

    async loadMessages(chatId, limit) {
      const sql = getSql();
      const rows = (await sql`
        select id, role, parts, metadata from (
          select id, role, parts, metadata, created_at
          from messages
          where chat_id = ${chatId}
          order by created_at desc
          limit ${limit}
        ) recent
        order by created_at asc`) as MessageRow[];
      return rows.map(toMessage);
    },

    async deleteChat(userId, chatId) {
      const sql = getSql();
      const rows = await sql`delete from chats where id = ${chatId} and user_id = ${userId} returning id`;
      return rows.length > 0;
    },
  };
}

/**
 * เตรียมประวัติก่อนเรียก runChat: หาแชทเดิม (หรือสร้างใหม่ถ้าไม่มีหรือถูกลบไปแล้ว)
 * บันทึกข้อความผู้ใช้ แล้วโหลดประวัติจาก DB แทนการเชื่อประวัติที่หน้าเว็บส่งมา
 */
export async function prepareChatHistory(input: {
  store: ChatStore;
  userId: string;
  channel: Channel;
  chatId: string | undefined;
  message: ChatMessage;
  limit: number;
}): Promise<{ chatId: string; history: ChatMessage[] }> {
  const { store, userId, channel, message, limit } = input;
  let chatId = input.chatId;
  if (chatId && !(await store.chatExists(userId, chatId))) chatId = undefined;
  chatId ??= await store.createChat(userId, channel);

  await store.appendUserMessage(chatId, message);
  const history = await store.loadMessages(chatId, limit);
  return { chatId, history };
}
