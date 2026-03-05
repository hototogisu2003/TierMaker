"use client";

import React from "react";
import type { CharacterForUI } from "@/app/tier/types";
import DraggableIcon from "./DraggableIcon";
import { useDroppable } from "@dnd-kit/core";

type Props = {
  tierId: string;
  tierName: string;
  tierIndex: number;
  tierColor: string;
  itemIds: string[];
  charactersById: Map<string, CharacterForUI>;
  onRename: (nextName: string) => void;
  onSetColor: (nextColor: string) => void;
  onAddBelow: () => void;
  onDelete: () => void;
  canDelete: boolean;
};

const COLOR_OPTIONS = [
  { label: "赤", value: "#ef4444" },
  { label: "オレンジ", value: "#f97316" },
  { label: "黄色", value: "#facc15" },
  { label: "黄緑", value: "#a3e635" },
  { label: "緑", value: "#22c55e" },
  { label: "水色", value: "#22d3ee" },
  { label: "青", value: "#3b82f6" },
  { label: "紫", value: "#a855f7" },
  { label: "グレー", value: "#9ca3af" },
] as const;

export default function TierRow({
  tierId,
  tierName,
  tierIndex,
  tierColor,
  itemIds,
  charactersById,
  onRename,
  onSetColor,
  onAddBelow,
  onDelete,
  canDelete,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: tierId });
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const menuWrapRef = React.useRef<HTMLDivElement | null>(null);
  const rowStyle: React.CSSProperties = { width: "100%" };

  React.useEffect(() => {
    if (!isMenuOpen) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (!menuWrapRef.current || !target) return;
      if (!menuWrapRef.current.contains(target)) setIsMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [isMenuOpen]);

  return (
    <div ref={setNodeRef} style={rowStyle} className="tierRow" data-over={isOver ? "1" : "0"}>
      <div className="tierLeft" style={{ backgroundColor: tierColor }}>
        <input
          className="tierNameInput"
          value={tierName}
          onChange={(e) => onRename(e.target.value)}
          aria-label={`Rename tier ${tierId}`}
        />
      </div>

      <div className="tierItems">
        {itemIds.map((id) => {
          const c = charactersById.get(id);
          if (!c) return null;
          return <DraggableIcon key={id} id={id} character={c} />;
        })}
      </div>

      <div className="tierRight">
        <div className="tierMenuWrap" ref={menuWrapRef}>
          <button
            type="button"
            className="tierMenuBtn"
            aria-label={`Tier ${tierIndex + 1} settings`}
            onClick={() => setIsMenuOpen((prev) => !prev)}
          >
            ⚙
          </button>

          {isMenuOpen ? (
            <div className="tierMenuPanel">
              <button
                type="button"
                className="tierMenuAction"
                onClick={() => {
                  onAddBelow();
                  setIsMenuOpen(false);
                }}
              >
                下に行を追加
              </button>
              <button
                type="button"
                className="tierMenuAction"
                onClick={() => {
                  onDelete();
                  setIsMenuOpen(false);
                }}
                disabled={!canDelete}
              >
                行を削除
              </button>

              <div className="tierMenuLabel">色</div>
              <div className="tierColorGrid">
                {COLOR_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className="tierColorBtn"
                    style={{ backgroundColor: opt.value }}
                    aria-label={opt.label}
                    title={opt.label}
                    data-selected={tierColor === opt.value ? "1" : "0"}
                    onClick={() => {
                      onSetColor(opt.value);
                      setIsMenuOpen(false);
                    }}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <style jsx>{`
        .tierRow {
          display: grid;
          grid-template-columns: 80px 1fr 24px;
          margin: 0;
          gap: 12px;
          align-items: stretch;
          padding: 2px 10px 2px 0;
          border: 1px solid #000000;
          border-radius: 0;
          background: var(--panel);
        }

        .tierRow[data-over="1"] {
          background: var(--panel2);
        }

        .tierLeft {
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 0;
          height: 100%;
          min-height: 100%;
          padding: 0;
        }

        .tierNameInput {
          width: 100%;
          font-size: 16px;
          font-weight: 800;
          color: #111111;
          background: transparent;
          border: 1px solid transparent;
          border-radius: 12px;
          padding: 4px 6px;
          outline: none;
          text-align: center;
        }

        .tierNameInput:focus {
          border-color: rgba(0, 0, 0, 0.25);
          background: rgba(255, 255, 255, 0.35);
        }

        .tierRight {
          display: flex;
          align-items: flex-start;
          justify-content: flex-end;
          position: relative;
        }

        .tierMenuWrap {
          position: relative;
          z-index: 5;
        }

        .tierMenuBtn {
          width: 18px;
          height: 18px;
          border: 1px solid #4b5563;
          border-radius: 50%;
          padding: 0;
          display: inline-grid;
          place-items: center;
          font-size: 11px;
          line-height: 1;
          background: rgba(255, 255, 255, 0.9);
          color: #111111;
          cursor: pointer;
        }

        .tierMenuPanel {
          position: absolute;
          top: calc(100% + 4px);
          right: 0;
          width: 152px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          background: #ffffff;
          padding: 6px;
          display: grid;
          gap: 6px;
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
        }

        .tierMenuAction {
          width: 100%;
          border: 1px solid #9ca3af;
          border-radius: 7px;
          background: #ffffff;
          color: #111111;
          padding: 5px 6px;
          font-size: 12px;
          font-weight: 700;
          text-align: left;
          cursor: pointer;
        }

        .tierMenuAction:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .tierMenuLabel {
          font-size: 11px;
          font-weight: 700;
          color: #374151;
        }

        .tierColorGrid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 4px;
        }

        .tierColorBtn {
          width: 100%;
          aspect-ratio: 1 / 1;
          border: 1px solid #6b7280;
          border-radius: 4px;
          cursor: pointer;
        }

        .tierColorBtn[data-selected="1"] {
          box-shadow: inset 0 0 0 2px #111111;
        }

        .tierItems {
          display: flex;
          flex-wrap: wrap;
          gap: 0;
          min-height: 48px;
          align-content: flex-start;
        }
      `}</style>
    </div>
  );
}
