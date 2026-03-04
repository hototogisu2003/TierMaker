"use client";

import React from "react";
import type { CharacterForUI } from "@/app/tier/types";

export default function DragOverlayPreview({ character }: { character: CharacterForUI }) {
  return (
    <div className="overlayCard" aria-hidden>
      <img className="overlayImg" src={character.iconUrl} alt="" />
      <style jsx>{`
        .overlayCard {
          width: 56px;
          height: 56px;
          border-radius: 0;
          border: 1px solid var(--border);
          background: rgba(255, 255, 255, 0.10);
          overflow: hidden;
        }
        .overlayImg {
          width: 100%;
          height: 100%;
          object-fit: cover;
          user-select: none;
          -webkit-user-drag: none;
        }
      `}</style>
    </div>
  );
}
