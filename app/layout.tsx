// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MSオプティマイズ",
  description: "MSオプティマイズのツール一覧ページです。",
  icons: {
    icon: "/icon/icon_HP_2.png",
    shortcut: "/icon/icon_HP_2.png",
    apple: "/icon/icon_HP_2.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>
        <main className="appMain">{children}</main>
        <footer style={{ padding: "16px", color: "#374151", fontSize: "12px", lineHeight: 1.6 }}>
          <div>(C)hototogisu2003 All rights reserved.</div>
          <div>
            当サイト上で使用しているゲーム アセットの全ての権利は、mixi Inc.に帰属します。その他の知的財産権は、各権利所有者に帰属します。
          </div>
        </footer>
      </body>
    </html>
  );
}
