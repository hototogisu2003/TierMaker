"use client";

import React from "react";
import Link from "next/link";
import ExportButton from "./ExportButton";

type Props = {
  onReset: () => void;
  exportTargetRef: React.RefObject<HTMLDivElement | null>;
};

export default function BoardControls({ onReset, exportTargetRef }: Props) {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [isContactOpen, setIsContactOpen] = React.useState(false);

  return (
    <div className="controlsRow">
      <div className="left">
        <div className="menuWrap">
          <button
            type="button"
            className="menuBtn"
            aria-label="メニュー"
            onClick={() => setIsMenuOpen((prev) => !prev)}
          >
            <span />
            <span />
            <span />
          </button>

          {isMenuOpen ? (
            <div className="menuPanel">
              <button
                type="button"
                className="contactToggle"
                onClick={() => setIsContactOpen((prev) => !prev)}
              >
                お問い合わせ
              </button>

              <div className="menuDivider" />

              <Link
                href="/privacy"
                className="menuItemLink"
                style={{ color: "#111111" }}
                onClick={() => setIsMenuOpen(false)}
              >
                プライバシーポリシー
              </Link>

              {isContactOpen ? (
                <div className="contactPanel">
                  <div>運営者名：ほととぎす</div>
                  <div>
                    X（Twitter）：
                    <a
                      className="xLink"
                      href="https://x.com/hototogisu2003"
                      target="_blank"
                      rel="noreferrer"
                    >
                      @hototogisu2003
                    </a>
                  </div>
                  <a
                    className="contactBtn"
                    href="https://marshmallow-qa.com/di9n1qu75lvijbl?t=L0oYf4&utm_medium=url_text&utm_source=promotion"
                    target="_blank"
                    rel="noreferrer"
                  >
                    お問い合わせフォーム
                  </a>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="brandText">モンストTierMaker</div>
      </div>

      <div className="right">
        <button className="btn" type="button" onClick={onReset}>
          リセット
        </button>
        <ExportButton targetRef={exportTargetRef} />
      </div>

      <style jsx>{`
        .controlsRow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }

        .left,
        .right {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .menuWrap {
          position: relative;
        }

        .menuBtn {
          width: 36px;
          height: 36px;
          border: 1px solid #9ca3af;
          background: #ffffff;
          border-radius: 8px;
          cursor: pointer;
          display: inline-flex;
          flex-direction: column;
          justify-content: center;
          gap: 4px;
          padding: 0 9px;
        }

        .menuBtn span {
          width: 100%;
          height: 2px;
          background: #111111;
          display: block;
        }

        .menuPanel {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          z-index: 40;
          min-width: 220px;
          border: 1px solid #d1d5db;
          border-radius: 10px;
          background: #ffffff;
          padding: 8px;
          display: grid;
          gap: 6px;
        }

        .contactToggle,
        .menuItemLink {
          border: none;
          background: transparent;
          color: #111111;
          border-radius: 0;
          padding: 4px 2px;
          font-family: inherit;
          font-size: 15px;
          font-weight: 700;
          text-align: left;
          text-decoration: none;
          cursor: pointer;
        }

        .contactToggle:hover,
        .menuItemLink:hover {
          background: transparent;
          text-decoration: underline;
        }

        .menuDivider {
          height: 1px;
          background: #d1d5db;
          margin: 2px 0;
        }

        .contactPanel {
          border: 1px solid #e5e7eb;
          background: #f9fafb;
          border-radius: 8px;
          padding: 8px 10px;
          color: #111111;
          display: grid;
          gap: 6px;
          font-size: 14px;
        }

        .xLink {
          margin-left: 4px;
          color: #2563eb;
          text-decoration: underline;
        }

        .contactBtn {
          display: inline-block;
          width: fit-content;
          border: 1px solid #1d4ed8;
          background: #3b82f6;
          color: #ffffff;
          border-radius: 8px;
          padding: 6px 10px;
          font-weight: 700;
          text-decoration: none;
        }

        .brandText {
          font-size: 18px;
          font-weight: 800;
          color: #111111;
          letter-spacing: 0.2px;
        }

        .btn {
          border: 1px solid #1f2937;
          background: #f3f4f6;
          color: #111827;
          padding: 10px 12px;
          border-radius: 14px;
          cursor: pointer;
          font-weight: 700;
        }

        .btn:hover {
          background: #e5e7eb;
        }
      `}</style>
    </div>
  );
}
