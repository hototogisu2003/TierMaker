"use client";

import React from "react";
import type { CharacterForUI } from "@/app/tier/types";
import DraggableIcon from "./DraggableIcon";
import { useDroppable } from "@dnd-kit/core";

type Props = {
  itemIds: string[];
  charactersById: Map<string, CharacterForUI>;
  groupByElement?: boolean;
  activeItemId?: string | null;
};

const ICON_SIZE = 48;
const MOBILE_RENDER_COUNT = 80;
const PC_RENDER_COUNT = 200;

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export default function PoolRow({
  itemIds,
  charactersById,
  groupByElement = false,
  activeItemId = null,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: "pool" });
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const bottomScrollRef = React.useRef<HTMLDivElement | null>(null);
  const gridRef = React.useRef<HTMLDivElement | null>(null);
  const syncingRef = React.useRef<"main" | "bottom" | null>(null);
  const [scrollLeft, setScrollLeft] = React.useState(0);
  const [viewportWidth, setViewportWidth] = React.useState(0);
  const [viewportHeight, setViewportHeight] = React.useState(0);
  const [windowScrollY, setWindowScrollY] = React.useState(0);
  const [gridTopAbs, setGridTopAbs] = React.useState(0);
  const [gridWidth, setGridWidth] = React.useState(0);

  const maxRenderCount = React.useMemo(() => {
    if (typeof window === "undefined") return PC_RENDER_COUNT;
    return window.innerWidth <= 768 ? MOBILE_RENDER_COUNT : PC_RENDER_COUNT;
  }, [viewportWidth]);

  const groupedRows = React.useMemo(() => {
    if (!groupByElement) return [] as string[][];
    const rows: string[][] = [];
    let current: string[] = [];
    let prevElement: CharacterForUI["element"] | null = null;

    for (const id of itemIds) {
      const c = charactersById.get(id);
      if (!c) continue;
      if (prevElement !== null && c.element !== prevElement) {
        if (current.length > 0) rows.push(current);
        current = [];
      }
      current.push(id);
      prevElement = c.element;
    }
    if (current.length > 0) rows.push(current);
    return rows;
  }, [groupByElement, itemIds, charactersById]);

  React.useEffect(() => {
    const updateWindowMetrics = () => {
      setViewportHeight(window.innerHeight);
      setWindowScrollY(window.scrollY);
    };

    updateWindowMetrics();
    window.addEventListener("scroll", updateWindowMetrics, { passive: true });
    window.addEventListener("resize", updateWindowMetrics);
    return () => {
      window.removeEventListener("scroll", updateWindowMetrics);
      window.removeEventListener("resize", updateWindowMetrics);
    };
  }, []);

  React.useEffect(() => {
    if (!groupByElement) return;
    const node = scrollRef.current;
    if (!node) return;

    const updateSize = () => setViewportWidth(node.clientWidth);
    updateSize();

    const ro = new ResizeObserver(() => updateSize());
    ro.observe(node);
    return () => ro.disconnect();
  }, [groupByElement]);

  React.useEffect(() => {
    if (groupByElement) return;
    const node = gridRef.current;
    if (!node) return;

    const updateGridMetrics = () => {
      const rect = node.getBoundingClientRect();
      setGridTopAbs(rect.top + window.scrollY);
      setGridWidth(rect.width);
    };

    updateGridMetrics();
    const ro = new ResizeObserver(() => updateGridMetrics());
    ro.observe(node);
    window.addEventListener("scroll", updateGridMetrics, { passive: true });
    window.addEventListener("resize", updateGridMetrics);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", updateGridMetrics);
      window.removeEventListener("resize", updateGridMetrics);
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
    if (!canScroll || view <= 0) return { thumbWidth: view, thumbLeft: 0 };

    const rawThumbWidth = (view / full) * view;
    const thumbWidth = Math.max(40, Math.min(view, rawThumbWidth));
    const maxScrollLeft = Math.max(full - view, 1);
    const maxThumbLeft = Math.max(view - thumbWidth, 0);
    const thumbLeft =
      (Math.min(Math.max(scrollLeft, 0), maxScrollLeft) / maxScrollLeft) * maxThumbLeft;
    return { thumbWidth, thumbLeft };
  }, [maxRowWidth, viewportWidth, scrollLeft]);

  const flatIds = React.useMemo(() => {
    const ids: string[] = [];
    for (const id of itemIds) {
      if (charactersById.has(id)) ids.push(id);
    }
    return ids;
  }, [itemIds, charactersById]);

  const nonGroupWindow = React.useMemo(() => {
    const columns = Math.max(1, Math.floor(Math.max(gridWidth, ICON_SIZE) / ICON_SIZE));
    const total = flatIds.length;
    const totalRows = Math.max(1, Math.ceil(total / columns));
    const rowsToRender = Math.max(1, Math.ceil(maxRenderCount / columns));

    const viewportCenterY = windowScrollY + viewportHeight * 0.5;
    const anchorRow = clamp(
      Math.floor((viewportCenterY - gridTopAbs) / ICON_SIZE),
      0,
      Math.max(0, totalRows - 1)
    );
    let startRow = clamp(
      anchorRow - Math.floor(rowsToRender / 2),
      0,
      Math.max(0, totalRows - rowsToRender)
    );
    let endRow = Math.min(totalRows, startRow + rowsToRender);
    if (activeItemId) {
      const activeIndex = flatIds.indexOf(activeItemId);
      if (activeIndex >= 0) {
        const activeRow = Math.floor(activeIndex / columns);
        if (activeRow < startRow || activeRow >= endRow) {
          startRow = clamp(
            activeRow - Math.floor(rowsToRender / 2),
            0,
            Math.max(0, totalRows - rowsToRender)
          );
          endRow = Math.min(totalRows, startRow + rowsToRender);
        }
      }
    }
    const startIndex = startRow * columns;
    const endIndex = Math.min(total, endRow * columns);

    return {
      visibleIds: flatIds.slice(startIndex, endIndex),
      topSpacer: startRow * ICON_SIZE,
      bottomSpacer: Math.max(0, (totalRows - endRow) * ICON_SIZE),
    };
  }, [flatIds, gridWidth, gridTopAbs, viewportHeight, windowScrollY, maxRenderCount, activeItemId]);

  return (
    <div ref={setNodeRef} className="poolRow" data-over={isOver ? "1" : "0"}>
      {groupByElement ? (
        <>
          <div ref={scrollRef} className="poolElementRows" onScroll={onPoolScroll}>
            <div className="poolElementRowsInner">
              {groupedRows.map((row, rowIdx) => {
                const perRowCount = Math.max(1, Math.ceil(maxRenderCount / Math.max(groupedRows.length, 1)));
                const centerIndex = Math.floor(scrollLeft / ICON_SIZE);
                const rawStart = centerIndex - Math.floor(perRowCount / 2);
                let startIndex = clamp(rawStart, 0, Math.max(0, row.length - perRowCount));
                let endIndex = Math.min(row.length, startIndex + perRowCount);
                if (activeItemId) {
                  const activeIndex = row.indexOf(activeItemId);
                  if (activeIndex >= 0 && (activeIndex < startIndex || activeIndex >= endIndex)) {
                    startIndex = clamp(
                      activeIndex - Math.floor(perRowCount / 2),
                      0,
                      Math.max(0, row.length - perRowCount)
                    );
                    endIndex = Math.min(row.length, startIndex + perRowCount);
                  }
                }
                const visibleIds = row.slice(startIndex, endIndex);

                return (
                  <div key={`row-${rowIdx}`} className="elementRow">
                    <div className="elementItems" style={{ width: row.length * ICON_SIZE }}>
                      {visibleIds.map((id, visibleIndex) => {
                        const c = charactersById.get(id);
                        if (!c) return null;
                        const absoluteIndex = startIndex + visibleIndex;
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
        <div ref={gridRef} className="poolItems">
          {nonGroupWindow.topSpacer > 0 ? (
            <div className="gridSpacer" style={{ height: nonGroupWindow.topSpacer }} />
          ) : null}
          {nonGroupWindow.visibleIds.map((id) => {
            const c = charactersById.get(id);
            if (!c) return null;
            return <DraggableIcon key={id} id={id} character={c} />;
          })}
          {nonGroupWindow.bottomSpacer > 0 ? (
            <div className="gridSpacer" style={{ height: nonGroupWindow.bottomSpacer }} />
          ) : null}
        </div>
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
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(${ICON_SIZE}px, ${ICON_SIZE}px));
          grid-auto-rows: ${ICON_SIZE}px;
          justify-content: start;
          gap: 0;
          min-height: 72px;
        }

        .gridSpacer {
          grid-column: 1 / -1;
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
          height: ${ICON_SIZE}px;
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
