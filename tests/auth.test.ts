import { describe, expect, it } from "vitest";
import { checkPassword, createSessionToken, timingSafeEqual, verifySessionToken } from "../lib/auth";
import { SESSION_MAX_AGE_SECONDS } from "../lib/config";

const SECRET = "test-secret-that-is-at-least-32-characters-long";

describe("session token", () => {
  it("token ที่สร้างเองผ่านการตรวจ", async () => {
    const token = await createSessionToken(SECRET);
    expect(await verifySessionToken(token, SECRET)).toBe(true);
  });

  it("secret ไม่ตรง ไม่ผ่าน", async () => {
    const token = await createSessionToken(SECRET);
    expect(await verifySessionToken(token, `${SECRET}-other`)).toBe(false);
  });

  it("แก้เวลาใน token ไม่ผ่าน", async () => {
    const token = await createSessionToken(SECRET, 1_000);
    const [, signature] = token.split(".");
    expect(await verifySessionToken(`2000.${signature}`, SECRET, 2_000)).toBe(false);
  });

  it("หมดอายุแล้วไม่ผ่าน", async () => {
    const issued = Date.now();
    const token = await createSessionToken(SECRET, issued);
    const later = issued + SESSION_MAX_AGE_SECONDS * 1000 + 1;
    expect(await verifySessionToken(token, SECRET, later)).toBe(false);
  });

  it("token เสียรูปแบบไม่ผ่าน", async () => {
    for (const bad of [undefined, "", "abc", "123", "x.y", "123."]) {
      expect(await verifySessionToken(bad, SECRET)).toBe(false);
    }
  });

  it("SESSION_SECRET สั้นเกินไปต้องแจ้ง error", async () => {
    await expect(createSessionToken("short")).rejects.toThrow("SESSION_SECRET");
  });
});

describe("checkPassword", () => {
  it("รหัสถูก", async () => {
    expect(await checkPassword("hello", "hello", SECRET)).toBe(true);
  });

  it("รหัสผิด", async () => {
    expect(await checkPassword("hell", "hello", SECRET)).toBe(false);
  });

  it("ยังไม่ได้ตั้ง APP_PASSWORD ต้องไม่ผ่าน", async () => {
    expect(await checkPassword("", undefined, SECRET)).toBe(false);
  });
});

describe("timingSafeEqual", () => {
  it("เทียบถูกต้อง", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    expect(timingSafeEqual("abc", "abcd")).toBe(false);
  });
});
