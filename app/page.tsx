import Link from "next/link";
import type { CSSProperties } from "react";

const tools = [
  {
    title: "Tierメーカー",
    description: "好きなキャラクターを選んで、自分だけのキャラランク表を作成しよう。",
    href: "/tier",
    cta: "Tierメーカーへ",
    accent: "#ef4444",
  },
  {
    title: "ダメージ計算機",
    description: "直殴り、友情コンボで与えるダメージを計算可能。ワンパンライン等の計算をお手軽に。",
    href: "/damage-calc",
    cta: "ダメージ計算機へ",
    accent: "#2563eb",
  },
  {
    title: "編成メモ",
    description: "パーティ編成、わくわくの実や紋章の構成を管理できるツール。",
    href: "/TeamBuild/team",
    cta: "編成メモへ",
    accent: "#16a34a",
  },
  {
    title: "適正予想メーカー",
    description: "星墓のギミック、適正予想を簡単に入力、共有できるツール。新規クエスト実装の都度更新します。（現在：星墓2期）",
    href: "/Seibo-Prediction",
    cta: "適正予想メーカーへ",
    accent: "#9333ea",
  },
] as const;

export default function HomePage() {
  return (
    <section className="homePage">
      <div className="homeShell">
        <header className="homeHeader">
          <img className="homeLogo" src="/icon/icon_Header_2.png" alt="Strike-Optima" />
        </header>

        <div className="homeIntro">
          <p>
            Strike-Optimaは、ゲーム「モンスターストライク」のプレイをより効率化するために公開しているサイトです。
            ゲームプレイを最適化（optimize）するための補助ツールを追加しています。
          </p>
        </div>

        <div className="toolGrid" aria-label="ツール一覧">
          {tools.map((tool) => (
            <article key={tool.href} className="toolCard" style={{ "--accent": tool.accent } as CSSProperties}>
              <div className="toolCardHeader">
                <span className="toolAccent" aria-hidden="true" />
                <h2>{tool.title}</h2>
              </div>
              <p>{tool.description}</p>
              <Link href={tool.href} className="toolLink" aria-label={tool.cta}>
                <span>{tool.cta}</span>
                <span className="toolLinkIcon" aria-hidden="true">
                  &gt;
                </span>
              </Link>
            </article>
          ))}
        </div>
      </div>

      <style>{`
        .homePage {
          min-height: calc(100vh - 24px);
          color: #111827;
          background:
            linear-gradient(180deg, #f8fafc 0%, #eef2f7 48%, #f7f8fb 100%);
        }

        .homeShell {
          width: min(1120px, calc(100% - 32px));
          margin: 0 auto;
          padding: 28px 0 44px;
        }

        .homeHeader {
          display: flex;
          align-items: center;
          min-height: 56px;
          margin-bottom: 18px;
        }

        .homeLogo {
          width: 192px;
          height: 64px;
          display: block;
          object-fit: contain;
        }

        .homeIntro {
          max-width: 760px;
          margin: 0 0 24px;
        }

        .homeIntro p {
          margin: 0;
          color: #374151;
          font-size: 16px;
          line-height: 1.85;
          font-weight: 600;
        }

        .toolGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .toolCard {
          min-height: 246px;
          display: grid;
          grid-template-rows: auto 1fr auto;
          gap: 14px;
          padding: 18px;
          border: 1px solid #d8dee8;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.86);
          box-shadow: 0 14px 32px rgba(15, 23, 42, 0.08);
        }

        .toolCardHeader {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .toolAccent {
          width: 10px;
          height: 32px;
          flex: 0 0 auto;
          border-radius: 999px;
          background: var(--accent);
        }

        .toolCard h2 {
          margin: 0;
          color: #111827;
          font-size: 20px;
          line-height: 1.25;
          font-weight: 900;
          letter-spacing: 0;
        }

        .toolCard p {
          margin: 0;
          color: #4b5563;
          font-size: 14px;
          line-height: 1.75;
          font-weight: 600;
        }

        .toolLink {
          width: 100%;
          min-height: 44px;
          display: inline-flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 10px 12px;
          border: 1px solid color-mix(in srgb, var(--accent) 52%, #ffffff);
          border-radius: 8px;
          background: color-mix(in srgb, var(--accent) 11%, #ffffff);
          color: #111827;
          font-size: 14px;
          font-weight: 900;
          text-decoration: none;
        }

        .toolLink:hover {
          background: color-mix(in srgb, var(--accent) 18%, #ffffff);
          border-color: color-mix(in srgb, var(--accent) 68%, #ffffff);
        }

        .toolLinkIcon {
          width: 26px;
          height: 26px;
          flex: 0 0 auto;
          display: inline-grid;
          place-items: center;
          border-radius: 999px;
          background: var(--accent);
          color: #ffffff;
          font-size: 16px;
          line-height: 1;
        }

        @media (max-width: 980px) {
          .toolGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 620px) {
          .homeShell {
            width: min(100% - 20px, 1120px);
            padding: 18px 0 32px;
          }

          .homeHeader {
            min-height: 48px;
            margin-bottom: 14px;
          }

          .homeLogo {
            width: 162px;
            height: 54px;
          }

          .homeIntro {
            margin-bottom: 18px;
          }

          .homeIntro p {
            font-size: 14px;
            line-height: 1.75;
          }

          .toolGrid {
            grid-template-columns: 1fr;
            gap: 10px;
          }

          .toolCard {
            min-height: 0;
            padding: 14px;
          }
        }
      `}</style>
    </section>
  );
}
