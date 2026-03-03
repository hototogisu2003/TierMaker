"use client";

import React from "react";
import type { CharacterForUI } from "@/app/page";
import { CSS } from "@dnd-kit/utilities";
import { useSortable } from "@dnd-kit/sortable";

type Props = {
  id: string; // character id
  character: CharacterForUI;
};

export default function DraggableIcon({ id, character }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    cursor: "grab",
    touchAction: "none",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="iconCard"
      title={character.name}
      {...attributes}
      {...listeners}
    >
      {/* next/image にすると remotePatterns 設定が必要なので、まずは img で */}
      <img className="iconImg" src={character.iconUrl} alt={character.name} draggable={false} />
      <style jsx>{`
        .iconCard {
          width: 48px;
          height: 48px;
          border-radius: 0;
          border: 1px solid var(--border);
          background: rgba(255, 255, 255, 0.05);
          overflow: hidden;
          display: grid;
          place-items: center;
        }

        .iconImg {
          width: 100%;
          height: 100%;
          object-fit: cover;
          user-select: none;
          -webkit-user-drag: none;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
