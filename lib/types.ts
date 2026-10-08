// type ที่ใช้ร่วมกันทั้งฝั่ง server และหน้าเว็บ (ไฟล์นี้ห้าม import โค้ดฝั่ง server)

import type { UIMessage } from "ai";

/** ข้อมูลที่แนบไปกับข้อความของบอท หน้าเว็บใช้ crisis ตัดสินว่าจะแสดงการ์ดสายด่วนหรือไม่ */
export type ChatMetadata = { crisis?: boolean };

export type ChatMessage = UIMessage<ChatMetadata>;
