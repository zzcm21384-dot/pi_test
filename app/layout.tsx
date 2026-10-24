import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "坦克大战 | Tank Battle",
  description: "用 Next.js 打造的经典坦克大战小游戏",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
