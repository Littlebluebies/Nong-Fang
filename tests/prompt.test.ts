import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "../lib/prompt";

describe("buildSystemPrompt", () => {
  it("มีส่วนความจำเมื่อเปิด tools และไม่มี marker หลงเหลือ", () => {
    const prompt = buildSystemPrompt({ crisis: false, memory: true });
    expect(prompt).toContain("save_memory");
    expect(prompt).not.toContain("<!--");
  });

  it("ตัดส่วนความจำออกเมื่อไม่มี tools", () => {
    const prompt = buildSystemPrompt({ crisis: false, memory: false });
    expect(prompt).not.toContain("save_memory");
    expect(prompt).not.toContain("<!--");
    expect(prompt).toContain("## ความปลอดภัย");
  });

  it("เติมคำแนะนำพิเศษเมื่อเจอคำเสี่ยง", () => {
    expect(buildSystemPrompt({ crisis: true, memory: false })).toContain("## สถานการณ์ตอนนี้");
  });
});
