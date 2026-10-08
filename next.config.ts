import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ให้ไฟล์ system prompt ถูกแพ็กไปกับ API route ตอน deploy บน Vercel
  outputFileTracingIncludes: {
    "/api/chat": ["./prompts/**/*"],
  },
};

export default nextConfig;
