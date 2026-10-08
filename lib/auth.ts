// Session แบบเรียบง่ายสำหรับผู้ใช้คนเดียว
// cookie = "<เวลาที่ออก>.<HMAC-SHA256 ของเวลานั้นด้วย SESSION_SECRET>"
// ใช้ Web Crypto จึงทำงานได้ทั้งใน proxy และ route handler โดยไม่ต้องติดตั้งไลบรารีเพิ่ม

import { SESSION_MAX_AGE_SECONDS } from "./config";

const encoder = new TextEncoder();

function requireSecret(secret: string | undefined): string {
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET ต้องตั้งค่าและยาวอย่างน้อย 32 ตัวอักษร");
  }
  return secret;
}

async function hmacHex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** เทียบสตริงโดยใช้เวลาเท่ากันไม่ว่าจะต่างกันตรงไหน กันการเดาทีละตัวจากเวลาตอบ */
export function timingSafeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/** ตรวจรหัสผ่าน โดยเทียบ HMAC ของทั้งสองฝั่ง ความยาวรหัสจึงไม่รั่วผ่านเวลาที่ใช้ */
export async function checkPassword(
  input: string,
  expected: string | undefined,
  secret: string | undefined,
): Promise<boolean> {
  if (!expected) return false;
  const key = requireSecret(secret);
  const [a, b] = await Promise.all([hmacHex(key, `pw:${input}`), hmacHex(key, `pw:${expected}`)]);
  return timingSafeEqual(a, b);
}

export async function createSessionToken(secret: string | undefined, now = Date.now()): Promise<string> {
  const issuedAt = String(now);
  return `${issuedAt}.${await hmacHex(requireSecret(secret), issuedAt)}`;
}

export async function verifySessionToken(
  token: string | undefined,
  secret: string | undefined,
  now = Date.now(),
): Promise<boolean> {
  if (!token || !secret) return false;
  const [issuedAt, signature] = token.split(".");
  if (!issuedAt || !signature || !/^\d+$/.test(issuedAt)) return false;

  const age = now - Number(issuedAt);
  if (age < 0 || age > SESSION_MAX_AGE_SECONDS * 1000) return false;

  const expected = await hmacHex(requireSecret(secret), issuedAt);
  return timingSafeEqual(signature, expected);
}
