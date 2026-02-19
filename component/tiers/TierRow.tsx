"use client";

import React from "react";
import type { CharacterForUI } from "@/app/page";
import DraggableIcon from "./DraggableIcon";

import { useDroppable } from "@dnd-kit/core";

type Props = {
  tierId: string;
  tierName: string;
  itemIds: string[];
  charactersById: Map<string, CharacterForUI>;
  onRename: (nextName: string) => void;
};

export default function TierRow({
  tierId,
  tierName,
  itemIds,
  charactersById,
  onRename,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: tierId });

  return (
    <div
      ref={setNodeRef}
      className="tierRow"
      data-over={isOver ? "1" : "0"}
    >
      <div className="tierLeft">
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
          grid-template-columns: 140px 1fr;
          gap: 12px;
          align-items: start;
          padding: 12px;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--panel);
        }

        .tierRow[data-over="1"] {
          background: var(--panel2);
        }

        .tierLeft {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .tierNameInput {
          width: 100%;
          font-size: 18px;
          font-weight: 800;
          color: var(--text);
          background: transparent;
          border: 1px solid transparent;
          border-radius: 12px;
          padding: 8px 10px;
          outline: none;
        }

        .tierNameInput:focus {
          border-color: var(--border);
          background: rgba(255, 255, 255, 0.06);
        }

        .tierItems {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          min-height: 56px;
          align-content: flex-start;
        }
      `}</style>
    </div>
  );
}
