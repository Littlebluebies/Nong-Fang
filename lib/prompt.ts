// โหลด system prompt ตามเวอร์ชัน แก้ prompt ให้สร้างไฟล์ใหม่ (system-v2.md) แล้วเปลี่ยน PROMPT_VERSION
// จะได้ย้อนเทียบผลกับชุดทดสอบใน tests/conversations.md ได้

import { readFileSync } from "node:fs";
import path from "node:path";
import { APP_NAME } from "./config";

export const PROMPT_VERSION = "v1";

const CRISIS_ADDENDUM = `

## สถานการณ์ตอนนี้

ข้อความล่าสุดของผู้ใช้มีสัญญาณว่าอาจคิดทำร้ายตัวเอง ตอบด้วยความอ่อนโยนและจริงจังเป็นพิเศษ ไม่ตื่นตูม ไม่สั่งสอน ถามว่าตอนนี้เขาปลอดภัยไหม และชวนให้ติดต่อคนที่ไว้ใจหรือผู้เชี่ยวชาญ`;

let cached: string | null = null;

function loadBasePrompt(): string {
  if (cached === null) {
    const file = path.join(process.cwd(), "prompts", `system-${PROMPT_VERSION}.md`);
    cached = readFileSync(file, "utf8").replaceAll("{{BOT_NAME}}", APP_NAME);
  }
  return cached;
}

export function buildSystemPrompt(options: { crisis: boolean }): string {
  const base = loadBasePrompt();
  return options.crisis ? base + CRISIS_ADDENDUM : base;
}
