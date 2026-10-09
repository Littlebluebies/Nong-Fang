// type ที่ใช้ร่วมกันทั้งฝั่ง server และหน้าเว็บ (ไฟล์นี้ห้าม import โค้ดฝั่ง server)

import type { UIMessage } from "ai";

/**
 * ข้อมูลที่แนบไปกับข้อความของบอท หน้าเว็บใช้ crisis ตัดสินว่าจะแสดงการ์ดสายด่วนหรือไม่
 * chatId (เฟส 2) บอกหน้าเว็บว่าแชทนี้ถูกเก็บใน DB ด้วย id อะไร
 */
export type ChatMetadata = { crisis?: boolean; chatId?: string };

/** GET /api/chat: persistent = false แปลว่าไม่มี DB แชทอยู่แค่ในหน้าเว็บแบบเฟส 1 */
export type ChatState =
  | { persistent: false }
  | { persistent: true; chatId: string | null; messages: ChatMessage[] };

export type ChatMessage = UIMessage<ChatMetadata>;
