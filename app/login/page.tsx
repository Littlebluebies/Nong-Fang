"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { APP_NAME } from "@/lib/config";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.replace("/");
        router.refresh();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "เข้าสู่ระบบไม่สำเร็จ");
    } catch {
      setError("เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <form onSubmit={onSubmit} className="w-full max-w-xs text-center">
        <span aria-hidden className="mx-auto grid size-14 place-items-center rounded-full bg-accent-soft text-2xl">
          🌿
        </span>
        <h1 className="mt-4 text-xl font-semibold">{APP_NAME}</h1>
        <p className="mt-1 text-sm text-muted">ใส่รหัสผ่านเพื่อเริ่มคุย</p>

        <label htmlFor="password" className="sr-only">
          รหัสผ่าน
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          autoFocus
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-6 w-full rounded-full border border-line bg-surface px-4 py-2.5 text-center outline-none focus:border-accent"
        />
        {error && (
          <p role="alert" className="mt-3 text-sm text-muted">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={!password || loading}
          className="mt-4 w-full rounded-full bg-accent py-2.5 font-medium text-accent-ink disabled:opacity-40"
        >
          {loading ? "กำลังเข้า…" : "เข้าสู่ระบบ"}
        </button>
      </form>
    </main>
  );
}
