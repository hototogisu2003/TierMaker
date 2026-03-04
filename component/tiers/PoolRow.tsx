"use client";

import React from "react";
import type { CharacterForUI } from "@/app/tier/types";
import DraggableIcon from "./DraggableIcon";

import { useDroppable } from "@dnd-kit/core";

type Props = {
  itemIds: string[];
  charactersById: Map<string, CharacterForUI>;
};

export default function PoolRow({ itemIds, charactersById }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: "pool" });

  return (
    <div ref={setNodeRef} className="poolRow" data-over={isOver ? "1" : "0"}>
      <div className="poolItems">
        {itemIds.map((id) => {
          const c = charactersById.get(id);
          if (!c) return null;
          return <DraggableIcon key={id} id={id} character={c} />;
        })}
      </div>

      <style jsx>{`
        .poolRow {
          padding: 6px 12px 12px;
          border: 1px dashed var(--border);
          border-radius: var(--radius);
          background: rgba(255, 255, 255, 0.03);
        }

        .poolRow[data-over="1"] {
          background: rgba(255, 255, 255, 0.07);
        }

        .poolItems {
          display: flex;
          flex-wrap: wrap;
          gap: 0;
          min-height: 72px;
        }
      `}</style>
    </div>
  );
}
