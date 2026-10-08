import type { MetadataRoute } from "next";
import { APP_NAME } from "@/lib/config";

// ทำให้ "เพิ่มไปยังหน้าจอโฮม" บนมือถือเปิดแบบเต็มจอเหมือนแอป
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: "เพื่อนคุยสำหรับระบายความในใจและหาไฟทำงาน",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f2eb",
    theme_color: "#f6f2eb",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
