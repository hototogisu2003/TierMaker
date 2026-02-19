"use client";

import React from "react";
import type { CharacterForUI } from "@/app/page";

export default function DragOverlayPreview({ character }: { character: CharacterForUI }) {
  return (
    <div className="overlayCard" aria-hidden>
      <img className="overlayImg" src={character.iconUrl} alt="" />
      <style jsx>{`
        .overlayCard {
          width: 64px;
          height: 64px;
          border-radius: 16px;
          border: 1px solid var(--border);
          background: rgba(255, 255, 255, 0.10);
          overflow: hidden;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
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
