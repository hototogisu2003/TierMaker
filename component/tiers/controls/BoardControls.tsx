"use client";

import React from "react";
import Link from "next/link";
import ExportButton from "./ExportButton";
import { RELEASE_NOTES, type ReleaseNoteItem } from "./releaseNotes";

type Props = {
  onReset: () => void;
  exportTargetRef: React.RefObject<HTMLDivElement | null>;
};

function ReleaseNotesModal({
  notes,
  onClose,
}: {
  notes: ReleaseNoteItem[];
  onClose: () => void;
}) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="更新情報">
      <div className="panel">
        <div className="panelHeader">
          <div className="panelTitle">更新情報</div>
          <button type="button" className="closeBtn" onClick={onClose} aria-label="閉じる">
            ×
          </button>
        </div>

        <div className="panelBody">
          {notes.map((note) => (
            <section key={note.id} className="noteBlock">
              <div className="noteDate">{note.date}</div>
              {note.title ? <div className="noteTitle">{note.title}</div> : null}
              <ul className="noteList">
                {note.items.map((item, index) => (
                  <li key={`${note.id}-${index}`}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>

      <style jsx>{`
        .overlay {
          position: fixed;
          inset: 0;
          z-index: 80;
          display: grid;
          place-items: center;
          padding: 16px;
          background: rgba(0, 0, 0, 0.35);
        }

        .panel {
          width: min(92vw, 560px);
          max-height: 82vh;
          overflow: auto;
          border: 1px solid #d1d5db;
          border-radius: 12px;
          background: #ffffff;
          box-shadow: 0 12px 28px rgba(0, 0, 0, 0.18);
        }

        .panelHeader {
          position: sticky;
          top: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 12px 14px;
          border-bottom: 1px solid #e5e7eb;
          background: #ffffff;
        }

        .panelTitle {
          font-size: 15px;
          font-weight: 800;
          color: #111827;
        }

        .closeBtn {
          width: 28px;
          height: 28px;
          border: 1px solid #9ca3af;
          border-radius: 999px;
          background: #ffffff;
          color: #111827;
          font-size: 16px;
          line-height: 1;
          cursor: pointer;
        }

        .panelBody {
          display: grid;
          gap: 14px;
          padding: 14px;
        }

        .noteBlock {
          display: grid;
          gap: 6px;
        }

        .noteDate {
          font-size: 12px;
          font-weight: 800;
          color: #4b5563;
        }

        .noteTitle {
          font-size: 14px;
          font-weight: 800;
          color: #111827;
        }

        .noteList {
          margin: 0;
          padding-left: 18px;
          color: #111827;
          font-size: 13px;
          line-height: 1.5;
        }
      `}</style>
    </div>
  );
}

export default function BoardControls({ onReset, exportTargetRef }: Props) {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [isContactOpen, setIsContactOpen] = React.useState(false);
  const [isReleaseNotesOpen, setIsReleaseNotesOpen] = React.useState(false);

  return (
    <div className="controlsRow">
      <div className="left">
        <span className="homeLink">
          <Link href="/" className="homeLinkAnchor" aria-label="Home">
            <img className="headerLogo" src="/icon/icon_Header_2.png" alt="Strike-Optima" />
          </Link>
        </span>

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
                  <div>運営者名: ほととぎす</div>
                  <div>
                    X(Twitter):
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

        <div className="brandWrap">
          <div className="brandText">モンストTierMaker</div>
          <button
            type="button"
            className="releaseBtn"
            aria-label="更新情報"
            title="更新情報"
            onClick={() => setIsReleaseNotesOpen(true)}
          >
            🔔
          </button>
        </div>
      </div>

      <div className="right">
        <button className="btn" type="button" onClick={onReset}>
          リセット
        </button>
        <ExportButton targetRef={exportTargetRef} />
      </div>

      {isReleaseNotesOpen ? (
        <ReleaseNotesModal notes={RELEASE_NOTES} onClose={() => setIsReleaseNotesOpen(false)} />
      ) : null}

      <style jsx>{`
        .controlsRow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          flex-wrap: wrap;
        }

        .left,
        .right {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .brandWrap {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .homeLink {
          width: 144px;
          height: 48px;
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          overflow: hidden;
        }

        .homeLinkAnchor {
          width: 100%;
          height: 100%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .headerLogo {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: contain;
        }

        .menuWrap {
          position: relative;
        }

        .menuBtn {
          width: 32px;
          height: 32px;
          border: 1px solid #9ca3af;
          background: #ffffff;
          border-radius: 7px;
          cursor: pointer;
          display: inline-flex;
          flex-direction: column;
          justify-content: center;
          gap: 3px;
          padding: 0 8px;
        }

        .menuBtn span {
          width: 100%;
          height: 2px;
          background: #111111;
          display: block;
        }

        .releaseBtn {
          width: 32px;
          height: 32px;
          border: 1px solid #9ca3af;
          background: #ffffff;
          border-radius: 7px;
          cursor: pointer;
          display: inline-grid;
          place-items: center;
          font-size: 16px;
          line-height: 1;
        }

        .releaseBtn:hover,
        .menuBtn:hover,
        .btn:hover {
          background: #f3f4f6;
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
          font-size: 15px;
          font-weight: 800;
          color: #111111;
          letter-spacing: 0.2px;
          line-height: 1.1;
        }

        .btn {
          border: 1px solid #1f2937;
          background: #f3f4f6;
          color: #111827;
          padding: 6px 10px;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 700;
          font-size: 13px;
          line-height: 1.15;
        }
      `}</style>
    </div>
  );
}
