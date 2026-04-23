// app/layout.tsx
import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

const siteTitle = "Strike-Optima |モンストお役立ちツール";
const siteDescription =
  "Strike-Optimaはモンスト向けのTierメーカー、ダメージ計算機、編成メモ、適正予想メーカーをまとめたお役立ちツールサイトです。";

export const metadata: Metadata = {
  title: {
    default: siteTitle,
    template: `%s | ${siteTitle}`,
  },
  description: siteDescription,
  applicationName: "Strike-Optima",
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    siteName: siteTitle,
    locale: "ja_JP",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: siteTitle,
    description: siteDescription,
  },
  icons: {
    icon: "/icon/icon_HP_3.png",
    shortcut: "/icon/icon_HP_3.png",
    apple: "/icon/icon_HP_3.png",
  },
  other: {
    "google-adsense-account": "ca-pub-2860145144315315",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2860145144315315"
          crossOrigin="anonymous"
        />
        <main className="appMain">{children}</main>
        <footer style={{ padding: "16px", color: "#374151", fontSize: "12px", lineHeight: 1.6 }}>
          <div>
            <Link href="/privacy" style={{ color: "#1d4ed8", fontWeight: 700, textDecoration: "underline" }}>
              プライバシーポリシー
            </Link>
          </div>
          <div>(C)hototogisu2003 All rights reserved.</div>
          <div>当サイトは非公式のファンツールであり、mixi Inc.とは一切関係ありません。</div>
          <div>
            当サイト上で使用しているゲームの画像・名称・その他のアセットの著作権および商標権は、mixi Inc.に帰属します。その他、当サイトの知的財産権は、各権利所有者に帰属します。
          </div>
        </footer>
      </body>
    </html>
  );
}
