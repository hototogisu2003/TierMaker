"use client";

import React from "react";
import type { CharacterForUI } from "@/app/tier/types";
import DraggableIcon from "./DraggableIcon";

import { useDroppable } from "@dnd-kit/core";

type Props = {
  itemIds: string[];
  charactersById: Map<string, CharacterForUI>;
  groupByElement?: boolean;
};

export default function PoolRow({ itemIds, charactersById, groupByElement = false }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: "pool" });
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const bottomScrollRef = React.useRef<HTMLDivElement | null>(null);
  const syncingRef = React.useRef<"main" | "bottom" | null>(null);
  const [scrollLeft, setScrollLeft] = React.useState(0);
  const [viewportWidth, setViewportWidth] = React.useState(0);
  const ICON_SIZE = 48;
  const OVERSCAN_PX = ICON_SIZE * 6;
  const renderItems: React.ReactNode[] = [];
  const groupedRows: string[][] = [];

  if (groupByElement) {
    let currentRow: string[] = [];
    let prevElement: CharacterForUI["element"] | null = null;

    for (const id of itemIds) {
      const c = charactersById.get(id);
      if (!c) continue;

      if (prevElement !== null && c.element !== prevElement) {
        if (currentRow.length > 0) groupedRows.push(currentRow);
        currentRow = [];
      }

      currentRow.push(id);
      prevElement = c.element;
    }

    if (currentRow.length > 0) groupedRows.push(currentRow);
  } else {
    for (const id of itemIds) {
      const c = charactersById.get(id);
      if (!c) continue;
      renderItems.push(<DraggableIcon key={id} id={id} character={c} />);
    }
  }

  React.useEffect(() => {
    if (!groupByElement) return;
    const node = scrollRef.current;
    if (!node) return;

    const updateSize = () => setViewportWidth(node.clientWidth);
    updateSize();

    const ro = new ResizeObserver(() => updateSize());
    ro.observe(node);

    return () => {
      ro.disconnect();
    };
  }, [groupByElement]);

  const onPoolScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const next = e.currentTarget.scrollLeft;
    setScrollLeft(next);
    if (syncingRef.current === "bottom") return;
    syncingRef.current = "main";
    if (bottomScrollRef.current && bottomScrollRef.current.scrollLeft !== next) {
      bottomScrollRef.current.scrollLeft = next;
    }
    requestAnimationFrame(() => {
      if (syncingRef.current === "main") syncingRef.current = null;
    });
  }, []);

  const onBottomScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const next = e.currentTarget.scrollLeft;
    if (syncingRef.current === "main") return;
    syncingRef.current = "bottom";
    if (scrollRef.current && scrollRef.current.scrollLeft !== next) {
      scrollRef.current.scrollLeft = next;
    }
    setScrollLeft(next);
    requestAnimationFrame(() => {
      if (syncingRef.current === "bottom") syncingRef.current = null;
    });
  }, []);

  const maxRowWidth = React.useMemo(() => {
    if (!groupByElement || groupedRows.length === 0) return 0;
    return groupedRows.reduce((max, row) => Math.max(max, row.length * ICON_SIZE), 0);
  }, [groupByElement, groupedRows]);

  const scrollIndicator = React.useMemo(() => {
    const view = Math.max(viewportWidth, 0);
    const full = Math.max(maxRowWidth, view);
    const canScroll = full > view + 1;
    if (!canScroll || view <= 0) {
      return { thumbWidth: view, thumbLeft: 0 };
    }

    const rawThumbWidth = (view / full) * view;
    const thumbWidth = Math.max(40, Math.min(view, rawThumbWidth));
    const maxScrollLeft = Math.max(full - view, 1);
    const maxThumbLeft = Math.max(view - thumbWidth, 0);
    const thumbLeft = (Math.min(Math.max(scrollLeft, 0), maxScrollLeft) / maxScrollLeft) * maxThumbLeft;
    return { thumbWidth, thumbLeft };
  }, [maxRowWidth, viewportWidth, scrollLeft]);

  return (
    <div ref={setNodeRef} className="poolRow" data-over={isOver ? "1" : "0"}>
      {groupByElement ? (
        <>
          <div ref={scrollRef} className="poolElementRows" onScroll={onPoolScroll}>
            <div className="poolElementRowsInner">
              {groupedRows.map((row, rowIdx) => {
                const startIndex = Math.max(0, Math.floor((scrollLeft - OVERSCAN_PX) / ICON_SIZE));
                const endIndex = Math.min(
                  row.length,
                  Math.ceil((scrollLeft + viewportWidth + OVERSCAN_PX) / ICON_SIZE)
                );
                const visibleIds = row.slice(startIndex, endIndex);

                return (
                  <div key={`row-${rowIdx}`} className="elementRow">
                    <div className="elementItems" style={{ width: row.length * ICON_SIZE }}>
                      {visibleIds.map((id, visibleIndex) => {
                        const absoluteIndex = startIndex + visibleIndex;
                        const c = charactersById.get(id);
                        if (!c) return null;
                        return (
                          <div
                            key={id}
                            className="virtualItem"
                            style={{ left: absoluteIndex * ICON_SIZE }}
                          >
                            <DraggableIcon id={id} character={c} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div ref={bottomScrollRef} className="poolBottomScrollbar" onScroll={onBottomScroll}>
            <div
              className="poolBottomScrollbarInner"
              style={{ width: Math.max(maxRowWidth, viewportWidth) }}
            />
          </div>

          <div className="poolScrollIndicator" aria-hidden="true">
            <div
              className="poolScrollIndicatorThumb"
              style={{
                width: Math.max(scrollIndicator.thumbWidth, 0),
                transform: `translateX(${Math.max(scrollIndicator.thumbLeft, 0)}px)`,
              }}
            />
          </div>
          <div className="poolScrollHint" aria-hidden="true">左右にスワイプでスクロール</div>
        </>
      ) : (
        <div className="poolItems">{renderItems}</div>
      )}

      <style jsx>{`
        .poolRow {
          padding: 6px 12px 12px;
          border: 1px dashed var(--border);
          border-radius: var(--radius);
          background: rgba(255, 255, 255, 0.03);
          width: 100%;
          max-width: 100%;
          min-width: 0;
          overflow-x: hidden;
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

        .poolElementRows {
          display: grid;
          gap: 4px;
          width: 100%;
          max-width: 100%;
          min-width: 0;
          overflow-x: auto;
          overflow-y: hidden;
          -webkit-overflow-scrolling: touch;
        }

        .poolElementRowsInner {
          display: grid;
          gap: 4px;
          width: max-content;
          min-width: 100%;
        }

        .poolBottomScrollbar {
          display: none;
          margin-top: 4px;
          width: 100%;
          max-width: 100%;
          overflow-x: auto;
          overflow-y: hidden;
          -webkit-overflow-scrolling: touch;
          height: 18px;
        }

        .poolBottomScrollbarInner {
          height: 1px;
        }

        .poolScrollIndicator,
        .poolScrollHint {
          display: none;
        }

        @media (max-width: 768px) {
          .poolBottomScrollbar {
            display: block;
          }

          .poolBottomScrollbar {
            height: 30px;
          }

          .poolScrollIndicator {
            display: block;
            width: 100%;
            height: 6px;
            background: #d1d5db;
            border-radius: 999px;
            margin-top: 3px;
            overflow: hidden;
          }

          .poolScrollIndicatorThumb {
            height: 100%;
            background: #6b7280;
            border-radius: 999px;
          }

          .poolScrollHint {
            display: block;
            margin-top: 4px;
            font-size: 11px;
            color: #4b5563;
            line-height: 1.2;
          }
        }

        .elementRow {
          width: max-content;
        }

        .elementItems {
          position: relative;
          height: 48px;
          min-width: max-content;
        }

        .virtualItem {
          position: absolute;
          top: 0;
        }
      `}</style>
    </div>
  );
}
