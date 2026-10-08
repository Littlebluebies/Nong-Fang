import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import { APP_NAME } from "@/lib/config";
import "./globals.css";

const thai = IBM_Plex_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600"],
  variable: "--font-thai",
  display: "swap",
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: "เพื่อนคุยสำหรับระบายความในใจและหาไฟทำงาน",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f2eb" },
    { media: "(prefers-color-scheme: dark)", color: "#161514" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={thai.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
