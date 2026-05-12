"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CharacterForUI } from "@/app/tier/types";
import {
  BOARD_STORAGE_KEY,
  readSavedBoards,
  writeSavedBoards,
  type SavedBoardRecord,
} from "./boardStorage";
import { RELEASE_NOTES, type ReleaseNoteItem } from "./controls/releaseNotes";

type Props = {
  characters: CharacterForUI[];
};

const PREVIEW_ICON_LIMIT = 6;

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

function SavedPageHeader() {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [isReleaseNotesOpen, setIsReleaseNotesOpen] = React.useState(false);

  return (
    <div className="controlsBand">
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
              <div className="menuOverlay" onClick={() => setIsMenuOpen(false)}>
                <div className="sideMenu" onClick={(event) => event.stopPropagation()}>
                  <div className="sideMenuHeader">
                    <div className="sideMenuTitle">メニュー</div>
                    <button
                      type="button"
                      className="sideMenuClose"
                      aria-label="閉じる"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      ×
                    </button>
                  </div>

                  <div className="sideMenuList">
                    <Link
                      href="/tier"
                      className="sideMenuItem"
                      style={{ color: "#111111" }}
                      onClick={() => setIsMenuOpen(false)}
                    >
                      表を作成する
                    </Link>

                    <Link
                      href="/tier/list"
                      className="sideMenuItem"
                      style={{ color: "#111111" }}
                      onClick={() => setIsMenuOpen(false)}
                    >
                      表を確認する
                    </Link>
                  </div>
                </div>
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
      </div>

      {isReleaseNotesOpen ? (
        <ReleaseNotesModal notes={RELEASE_NOTES} onClose={() => setIsReleaseNotesOpen(false)} />
      ) : null}

      <style jsx>{`
        .controlsBand {
          position: sticky;
          top: 0;
          z-index: 30;
          background: #ffffff;
          border-bottom: 1px solid #d1d5db;
          padding: 4px 8px;
          margin: 0;
        }

        .controlsRow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          flex-wrap: wrap;
        }

        .left {
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
        .menuBtn:hover {
          background: #f3f4f6;
        }

        .menuOverlay {
          position: fixed;
          inset: 0;
          z-index: 80;
          background: rgba(15, 23, 42, 0.35);
        }

        .sideMenu {
          width: min(340px, 90vw);
          height: 100%;
          background: #ffffff;
          border-right: 1px solid #d0d7e2;
          box-shadow: 0 12px 24px rgba(15, 23, 42, 0.18);
          padding: 10px;
          display: grid;
          grid-template-rows: auto 1fr;
          gap: 8px;
        }

        .sideMenuHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .sideMenuTitle {
          font-size: 15px;
          font-weight: 800;
          color: #111827;
        }

        .sideMenuClose {
          width: 30px;
          height: 30px;
          border: 1px solid #9ca3af;
          border-radius: 7px;
          background: #ffffff;
          color: #111827;
          cursor: pointer;
          font-size: 18px;
          line-height: 1;
        }

        .sideMenuList {
          display: grid;
          align-content: start;
          gap: 2px;
        }

        .sideMenuItem {
          border: none;
          background: transparent;
          color: #111111;
          padding: 8px 4px;
          font-family: inherit;
          font-size: 15px;
          font-weight: 700;
          text-align: left;
          text-decoration: none;
          display: block;
          cursor: pointer;
        }

        .sideMenuItem:hover {
          background: transparent;
          text-decoration: underline;
        }

        .brandText {
          font-size: 15px;
          font-weight: 800;
          color: #111111;
          letter-spacing: 0.2px;
          line-height: 1.1;
        }
      `}</style>
    </div>
  );
}

function formatDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function MiniPreview({
  board,
  charactersById,
}: {
  board: SavedBoardRecord["board"];
  charactersById: Map<string, CharacterForUI>;
}) {
  return (
    <div className="previewFrame">
      {board.tierMeta.map((tier) => {
        const ids = board.containers[tier.id] ?? [];
        const visibleIds = ids.slice(0, PREVIEW_ICON_LIMIT);
        const overflowCount = Math.max(0, ids.length - visibleIds.length);

        return (
          <div key={tier.id} className="previewRow">
            <div className="previewLabel" style={{ backgroundColor: tier.color }}>
              {tier.name}
            </div>
            <div className="previewIcons">
              {visibleIds.map((id) => {
                const character = charactersById.get(id);
                if (!character) return null;
                return (
                  <img
                    key={id}
                    className="previewIcon"
                    src={character.iconUrl}
                    alt={character.name}
                    draggable={false}
                  />
                );
              })}
              {overflowCount > 0 ? <div className="moreBadge">+{overflowCount}</div> : null}
            </div>
          </div>
        );
      })}

      <style jsx>{`
        .previewFrame {
          border: 1px solid #d1d5db;
          border-radius: 10px;
          overflow: hidden;
          background: #ffffff;
        }

        .previewRow {
          display: grid;
          grid-template-columns: 72px 1fr;
          min-height: 42px;
          border-bottom: 1px solid #e5e7eb;
        }

        .previewRow:last-child {
          border-bottom: none;
        }

        .previewLabel {
          display: flex;
          align-items: center;
          justify-content: center;
          color: #111111;
          font-size: 13px;
          font-weight: 800;
          padding: 4px;
        }

        .previewIcons {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          overflow: hidden;
          min-width: 0;
        }

        .previewIcon {
          width: 31px;
          height: 31px;
          object-fit: cover;
          border: 1px solid #d1d5db;
          flex: 0 0 auto;
        }

        .moreBadge {
          height: 31px;
          padding: 0 8px;
          border-radius: 999px;
          background: #f3f4f6;
          border: 1px solid #d1d5db;
          color: #374151;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 700;
          flex: 0 0 auto;
        }
      `}</style>
    </div>
  );
}

export default function SavedBoardsPage({ characters }: Props) {
  const router = useRouter();
  const [savedBoards, setSavedBoards] = React.useState<SavedBoardRecord[]>([]);
  const [isRemoveOpen, setIsRemoveOpen] = React.useState(false);
  const [removeId, setRemoveId] = React.useState("");

  const charactersById = React.useMemo(() => {
    const map = new Map<string, CharacterForUI>();
    for (const character of characters) {
      map.set(character.id, character);
    }
    return map;
  }, [characters]);

  React.useEffect(() => {
    setSavedBoards(readSavedBoards());
  }, []);

  React.useEffect(() => {
    if (savedBoards.some((record) => record.id === removeId)) return;
    setRemoveId("");
  }, [removeId, savedBoards]);

  const openBoard = React.useCallback(
    (record: SavedBoardRecord) => {
      window.localStorage.setItem(
        BOARD_STORAGE_KEY,
        JSON.stringify({
          ...record.board,
          boardTitle: record.title,
          savedBoardId: record.id,
        })
      );
      router.push("/tier");
    },
    [router]
  );

  const removeBoard = React.useCallback(() => {
    if (!removeId) return;
    const nextBoards = savedBoards.filter((record) => record.id !== removeId);
    writeSavedBoards(nextBoards);
    setSavedBoards(nextBoards);
    setRemoveId("");
    setIsRemoveOpen(false);
  }, [removeId, savedBoards]);

  return (
    <>
      <SavedPageHeader />
      <section className="savedRoot">
        <div className="manageRow">
          <div className="manageLabel">表を管理する</div>
          <button
            className="manageBtn"
            type="button"
            onClick={() => setIsRemoveOpen(true)}
            disabled={savedBoards.length === 0}
          >
            削除
          </button>
          <span className="manageHelper">{savedBoards.length}件</span>
        </div>

        {savedBoards.length === 0 ? (
          <div className="emptyState">保存された表はまだありません</div>
        ) : (
          <div className="savedGrid">
            {savedBoards.map((record) => (
              <button
                key={record.id}
                type="button"
                className="savedCard"
                onClick={() => openBoard(record)}
              >
                <div className="cardHeader">
                  <div className="cardTitle">{record.title}</div>
                  <div className="cardDate">{formatDate(record.updatedAt)}</div>
                </div>
                <MiniPreview board={record.board} charactersById={charactersById} />
              </button>
            ))}
          </div>
        )}

        {isRemoveOpen ? (
          <div className="dialogOverlay" onClick={() => setIsRemoveOpen(false)}>
            <div className="dialogPanel" onClick={(event) => event.stopPropagation()}>
              <div className="dialogTitle">保存データから削除する表を選択</div>
              <select className="dialogSelect" value={removeId} onChange={(event) => setRemoveId(event.target.value)}>
                <option value="">選択してください</option>
                {savedBoards.map((record) => (
                  <option key={record.id} value={record.id}>
                    {record.title}
                  </option>
                ))}
              </select>
              <div className="dialogActions">
                <button className="dialogBtn" type="button" onClick={() => setIsRemoveOpen(false)}>
                  閉じる
                </button>
                <button className="dialogBtn" type="button" onClick={removeBoard} disabled={!removeId}>
                  削除
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <style jsx>{`
          .savedRoot {
            display: grid;
            gap: 16px;
            padding: 16px;
          }

          .manageRow {
            display: flex;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;
          }

          .manageLabel {
            font-size: 18px;
            font-weight: 800;
            color: #111827;
          }

          .manageBtn {
            min-width: 72px;
            height: 34px;
            border: 1px solid #c7cdd8;
            border-radius: 10px;
            background: #ffffff;
            color: #111827;
            font-size: 14px;
            font-weight: 700;
            cursor: pointer;
          }

          .manageBtn:disabled {
            cursor: default;
            color: #9ca3af;
            background: #f3f4f6;
          }

          .manageHelper {
            font-size: 13px;
            font-weight: 700;
            color: #6b7280;
          }

          .emptyState {
            border: 1px dashed #d1d5db;
            border-radius: 12px;
            background: #ffffff;
            color: #4b5563;
            padding: 20px;
            text-align: center;
            font-weight: 600;
          }

          .savedGrid {
            display: grid;
            gap: 12px;
          }

          @media (min-width: 1024px) {
            .savedGrid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
              align-items: start;
            }
          }

          .savedCard {
            display: grid;
            gap: 10px;
            width: 100%;
            border: 1px solid #d1d5db;
            border-radius: 14px;
            padding: 12px;
            background: #ffffff;
            text-align: left;
            cursor: pointer;
          }

          .savedCard:hover {
            background: #f9fafb;
            border-color: #9ca3af;
          }

          .cardHeader {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            align-items: baseline;
            flex-wrap: wrap;
          }

          .cardTitle {
            font-size: 16px;
            font-weight: 800;
            color: #111827;
          }

          .cardDate {
            font-size: 12px;
            color: #6b7280;
          }

          .dialogOverlay {
            position: fixed;
            inset: 0;
            z-index: 90;
            display: grid;
            place-items: center;
            padding: 16px;
            background: rgba(15, 23, 42, 0.35);
          }

          .dialogPanel {
            width: min(92vw, 420px);
            display: grid;
            gap: 12px;
            border: 1px solid #d1d5db;
            border-radius: 12px;
            background: #ffffff;
            padding: 16px;
            box-shadow: 0 12px 28px rgba(15, 23, 42, 0.18);
          }

          .dialogTitle {
            font-size: 15px;
            font-weight: 800;
            color: #111827;
          }

          .dialogSelect {
            width: 100%;
            height: 40px;
            border: 1px solid #c7cdd8;
            border-radius: 10px;
            background: #ffffff;
            color: #111827;
            font-size: 14px;
            padding: 0 12px;
          }

          .dialogActions {
            display: flex;
            justify-content: flex-end;
            gap: 8px;
          }

          .dialogBtn {
            min-width: 72px;
            height: 34px;
            border: 1px solid #c7cdd8;
            border-radius: 10px;
            background: #ffffff;
            color: #111827;
            font-size: 14px;
            font-weight: 700;
            cursor: pointer;
          }

          .dialogBtn:disabled {
            cursor: default;
            color: #9ca3af;
            background: #f3f4f6;
          }
        `}</style>
      </section>
    </>
  );
}
