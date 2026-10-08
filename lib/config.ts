// ค่าตั้งต้นทั้งหมดของแอปอยู่ที่นี่ จะเปลี่ยนชื่อบอทหรือปรับขีดจำกัด แก้ไฟล์นี้ไฟล์เดียว

export const APP_NAME = "น้องฟัง";

/** ส่งประวัติให้ LLM แค่กี่ข้อความล่าสุด (คุมค่าใช้จ่ายไม่ให้โตตามความยาวแชท) */
export const MAX_HISTORY_MESSAGES = 20;

/** ความยาวสูงสุดของข้อความที่ผู้ใช้ส่งได้ต่อครั้ง (ตัวอักษร) */
export const MAX_MESSAGE_CHARS = 2000;

/** ความยาวคำตอบสูงสุดของบอท (output token) */
export const MAX_OUTPUT_TOKENS = 400;

/** Rate limit: ส่งได้กี่ครั้งต่อช่วงเวลา */
export const RATE_LIMIT = { max: 20, windowMs: 5 * 60 * 1000 };

/** อายุ cookie หลัง login */
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export const SESSION_COOKIE = "nf_session";

/** เฟส 2: ความยาวสูงสุดของความจำหนึ่งรายการ (ตัวอักษร) ตรงกับ check ในตาราง memories */
export const MEMORY_MAX_CHARS = 200;

/** เฟส 2: recall_memory คืนความจำล่าสุดกี่รายการ */
export const RECALL_LIMIT = 20;

/** เฟส 2: LLM เรียก tool แล้วตอบต่อได้กี่รอบต่อหนึ่งข้อความ (กัน loop ไม่จบและคุมค่าใช้จ่าย) */
export const MAX_TOOL_STEPS = 3;

/** เฟส 2: เปิดหน้าเว็บแล้วโหลดข้อความของแชทล่าสุดมาแสดงสูงสุดกี่ข้อความ */
export const MAX_DISPLAY_MESSAGES = 200;
