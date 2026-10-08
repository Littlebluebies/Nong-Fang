// ด่านคำเสี่ยง: โค้ดล้วน ไม่ผ่าน LLM จึงทำงานเหมือนเดิมทุกครั้งและทดสอบอัตโนมัติได้
// หลักการ: ยอมเตือนเกินดีกว่าพลาด เจอคำที่ระบบยังไม่จับ ให้เพิ่มใน CRISIS_KEYWORDS พร้อม test case

/**
 * คำ/วลีเสี่ยง เขียนแบบปกติได้เลย ระบบจะ normalize ทั้งคำนี้และข้อความผู้ใช้ด้วยวิธีเดียวกันก่อนเทียบ
 */
export const CRISIS_KEYWORDS: readonly string[] = [
  // ไทย
  "อยากตาย",
  "อยากจะตาย",
  "ไม่อยากอยู่แล้ว",
  "ไม่อยากอยู่บนโลกนี้",
  "ไม่อยากมีชีวิต",
  "ไม่อยากมีชีวิตอยู่",
  "ไม่อยากตื่นขึ้นมาอีก",
  "อยากหายไปจากโลก",
  "อยากหายไปตลอดกาล",
  "ฆ่าตัวตาย",
  "จบชีวิต",
  "จบชีวิตตัวเอง",
  "ทำร้ายตัวเอง",
  "ตายไปซะ",
  "อยู่ไปก็ไม่มีความหมาย",
  // อังกฤษ
  "kill myself",
  "suicide",
  "suicidal",
  "want to die",
  "end my life",
  "self harm",
  "selfharm",
  "hurt myself",
];

/** ข้อความคงที่ที่ต้องแสดงทุกครั้งเมื่อด่านคำเสี่ยงทำงาน ไม่ว่า LLM จะตอบอะไร */
export const CRISIS_MESSAGE =
  "ถ้าตอนนี้รู้สึกหนักมาก หรือคิดอยากทำร้ายตัวเอง โทรคุยกับสายด่วนสุขภาพจิต 1323 ได้ฟรีตลอด 24 ชั่วโมง " +
  "ถ้าอยู่ในอันตรายเร่งด่วน โทร 1669 หรือไปโรงพยาบาลที่ใกล้ที่สุดนะ";

// อักขระที่มองไม่เห็น (zero-width) ที่อาจแทรกมาระหว่างคำ
const INVISIBLE = /[​-‍⁠﻿]/g;
// เว้นวรรค ไม้ยมก และเครื่องหมายวรรคตอนทั่วไป
const SEPARATORS = /[\sๆ.,!?;:'"`~\-_*()[\]{}…“”‘’/\\|]+/g;

/**
 * ทำข้อความให้อยู่ในรูปเดียวกันก่อนเทียบ:
 * ตัวพิมพ์เล็ก → ตัดอักขระล่องหน → ตัดช่องว่าง/เครื่องหมาย → ยุบอักขระซ้ำติดกันเหลือตัวเดียว
 * ตัวอย่าง: "อ ยา ก ต า ย ย ย ย!!" → "อยากตาย"
 */
export function normalizeForMatch(text: string): string {
  return text
    .normalize("NFC")
    .toLowerCase()
    .replace(INVISIBLE, "")
    .replace(SEPARATORS, "")
    .replace(/(.)\1+/gu, "$1");
}

const NORMALIZED_KEYWORDS = CRISIS_KEYWORDS.map(normalizeForMatch);

/** คืน true ถ้าข้อความมีคำเสี่ยง */
export function detectCrisis(text: string): boolean {
  if (!text) return false;
  const normalized = normalizeForMatch(text);
  return NORMALIZED_KEYWORDS.some((keyword) => normalized.includes(keyword));
}
