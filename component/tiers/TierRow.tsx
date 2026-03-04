"use client";

import React from "react";
import type { CharacterForUI } from "@/app/tier/types";
import DraggableIcon from "./DraggableIcon";

import { useDroppable } from "@dnd-kit/core";

type Props = {
  tierId: string;
  tierName: string;
  tierIndex: number;
  itemIds: string[];
  charactersById: Map<string, CharacterForUI>;
  onRename: (nextName: string) => void;
};

export default function TierRow({
  tierId,
  tierName,
  tierIndex,
  itemIds,
  charactersById,
  onRename,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: tierId });
  const tierColors = ["#ef4444", "#f97316", "#facc15", "#22c55e", "#3b82f6", "#a855f7"];
  const tierColor = tierColors[tierIndex] ?? "#e5e7eb";
  const rowStyle: React.CSSProperties = {
    width: "100%",
  };

  return (
    <div
      ref={setNodeRef}
      style={rowStyle}
      className="tierRow"
      data-over={isOver ? "1" : "0"}
    >
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

      <style jsx>{`
        .tierRow {
          display: grid;
          grid-template-columns: 80px 1fr;
          margin: 0;
          gap: 12px;
          align-items: start;
          padding: 6px 10px;
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
          gap: 10px;
          border-radius: 12px;
          padding: 2px;
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
