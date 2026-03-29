"use client";

import React from "react";
import type { CharacterForUI } from "@/app/tier/types";
import { CSS } from "@dnd-kit/utilities";
import { useSortable } from "@dnd-kit/sortable";

type Props = {
  id: string;
  character: CharacterForUI;
};

export default function DraggableIcon({ id, character }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    cursor: "grab",
    touchAction: "none",
  };

  const LONG_PRESS_MS = 450;
  const MOVE_CANCEL_PX = 8;
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = React.useRef<{ x: number; y: number } | null>(null);
  const [showMobileName, setShowMobileName] = React.useState(false);

  const clearLongPress = React.useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const hideMobileName = React.useCallback(() => {
    setShowMobileName(false);
  }, []);

  const handlePointerDownCapture = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== "touch") return;
      startRef.current = { x: e.clientX, y: e.clientY };
      clearLongPress();
      timerRef.current = setTimeout(() => {
        setShowMobileName(true);
      }, LONG_PRESS_MS);
    },
    [clearLongPress]
  );

  const handlePointerMoveCapture = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== "touch") return;
      const s = startRef.current;
      if (!s) return;
      if (
        Math.abs(e.clientX - s.x) > MOVE_CANCEL_PX ||
        Math.abs(e.clientY - s.y) > MOVE_CANCEL_PX
      ) {
        clearLongPress();
        hideMobileName();
      }
    },
    [clearLongPress, hideMobileName]
  );

  const handlePointerEndCapture = React.useCallback(() => {
    clearLongPress();
    startRef.current = null;
    hideMobileName();
  }, [clearLongPress, hideMobileName]);

  React.useEffect(() => {
    if (isDragging) {
      hideMobileName();
      clearLongPress();
    }
  }, [isDragging, hideMobileName, clearLongPress]);

  React.useEffect(() => {
    return () => {
      clearLongPress();
    };
  }, [clearLongPress]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="iconCard"
      title={character.name}
      onPointerDownCapture={handlePointerDownCapture}
      onPointerMoveCapture={handlePointerMoveCapture}
      onPointerUpCapture={handlePointerEndCapture}
      onPointerCancelCapture={handlePointerEndCapture}
      {...attributes}
      {...listeners}
    >
      <img
        className="iconImg"
        src={character.iconUrl}
        alt={character.name}
        draggable={false}
      />
      {showMobileName ? <div className="mobileNameHint">{character.name}</div> : null}

      <style jsx>{`
        .iconCard {
          position: relative;
          width: clamp(48px, 3.5vw, 72px);
          height: clamp(48px, 3.5vw, 72px);
          border-radius: 0;
          border: 1px solid var(--border);
          background: rgba(255, 255, 255, 0.05);
          overflow: visible;
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

        .mobileNameHint {
          position: absolute;
          left: 50%;
          bottom: calc(100% + 4px);
          transform: translateX(-50%);
          max-width: 180px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          background: rgba(17, 24, 39, 0.92);
          color: #ffffff;
          border-radius: 6px;
          padding: 3px 6px;
          font-size: 11px;
          line-height: 1.2;
          z-index: 50;
          pointer-events: none;
          display: none;
        }

        @media (max-width: 768px) {
          .iconCard {
            width: clamp(40px, 11vw, 56px);
            height: clamp(40px, 11vw, 56px);
          }

          .mobileNameHint {
            display: block;
          }
        }
      `}</style>
    </div>
  );
}
