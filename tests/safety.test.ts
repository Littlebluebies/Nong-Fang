import { describe, expect, it } from "vitest";
import { CRISIS_MESSAGE, detectCrisis, normalizeForMatch } from "../lib/safety";

describe("normalizeForMatch", () => {
  it("ตัดช่องว่าง เครื่องหมาย และยุบอักขระซ้ำ", () => {
    expect(normalizeForMatch("อ ยา ก ต า ย ย ย ย!!")).toBe("อยากตาย");
  });

  it("ตัดอักขระล่องหน (zero-width)", () => {
    expect(normalizeForMatch("อยาก​ตาย")).toBe("อยากตาย");
  });

  it("แปลงอังกฤษเป็นตัวพิมพ์เล็ก", () => {
    expect(normalizeForMatch("I Want To DIE")).toBe("iwantodie");
  });
});

describe("detectCrisis: ต้องจับได้", () => {
  const shouldFlag = [
    "ไม่อยากอยู่แล้ว", // ชุดทดสอบข้อ 1
    "อยากตาย",
    "อยากตายยยยยย",
    "อ ย า ก ต า ย", // ชุดทดสอบข้อ 2: เว้นวรรคแปลกๆ
    "อยาก...ตาย",
    "บางทีก็คิดว่าไม่อยากมีชีวิตอยู่",
    "คิดเรื่องฆ่าตัวตายบ่อยๆ",
    "อยากหายไปจากโลกนี้",
    "เคยคิดจะทำร้ายตัวเอง",
    "I want to die",
    "thinking about suicide",
    "I might kill myself",
  ];

  it.each(shouldFlag)("%s", (text) => {
    expect(detectCrisis(text)).toBe(true);
  });
});

describe("detectCrisis: ไม่ควรจับ", () => {
  const shouldNotFlag = [
    "",
    "วันนี้เหนื่อยมาก",
    "โดนหัวหน้าด่าต่อหน้าคนอื่น",
    "ต้องทำธีสิสแต่ไม่อยากเริ่มเลย",
    "ไม่อยากอยู่บ้านคนเดียว",
    "ตายแล้ว ลืมส่งงาน", // คำอุทาน
  ];

  it.each(shouldNotFlag)("%s", (text) => {
    expect(detectCrisis(text)).toBe(false);
  });
});

describe("CRISIS_MESSAGE", () => {
  it("มีเบอร์สายด่วนครบ", () => {
    expect(CRISIS_MESSAGE).toContain("1323");
    expect(CRISIS_MESSAGE).toContain("1669");
  });
});
