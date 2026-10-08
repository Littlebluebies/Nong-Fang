import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, resetRateLimit } from "../lib/rate-limit";

const LIMIT = { max: 3, windowMs: 1_000 };

describe("checkRateLimit", () => {
  beforeEach(() => resetRateLimit());

  it("ให้ผ่านจนครบโควต้า แล้วบล็อก", () => {
    expect(checkRateLimit("a", 0, LIMIT).ok).toBe(true);
    expect(checkRateLimit("a", 100, LIMIT).ok).toBe(true);
    expect(checkRateLimit("a", 200, LIMIT).ok).toBe(true);
    const blocked = checkRateLimit("a", 300, LIMIT);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(1);
  });

  it("พ้นช่วงเวลาแล้วส่งได้อีก", () => {
    for (const t of [0, 100, 200]) checkRateLimit("a", t, LIMIT);
    expect(checkRateLimit("a", 1_001, LIMIT).ok).toBe(true);
  });

  it("แต่ละ key นับแยกกัน", () => {
    for (const t of [0, 100, 200]) checkRateLimit("a", t, LIMIT);
    expect(checkRateLimit("b", 300, LIMIT).ok).toBe(true);
  });
});
