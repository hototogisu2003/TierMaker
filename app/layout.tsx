// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tier Maker",
  description: "Drag and drop characters into tiers.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>
        <header className="appHeader">
          <div className="container">
            <div className="headerRow">
              <div className="brand">Tier Maker</div>
              <div className="muted">S/A/B/C にドラッグ＆ドロップ</div>
            </div>
          </div>
        </header>

        <main className="container appMain">{children}</main>

        <footer className="appFooter">
          <div className="container muted">
            Built with Next.js + Supabase
          </div>
        </footer>
      </body>
    </html>
  );
}
