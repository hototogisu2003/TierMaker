"use client";

import React from "react";
import type {
  CharacterElement,
  CharacterForUI,
  CharacterGacha,
  CharacterObtain,
  CharacterOtherCategory,
} from "@/app/tier/types";
import TierRow from "./TierRow";
import PoolRow from "./PoolRow";
import DragOverlayPreview from "./DragOverlayPreview";
import Input from "@/component/ui/Input";
import iconFire from "@/icon/icon_火.png";
import iconWater from "@/icon/icon_水.png";
import iconWood from "@/icon/icon_木.png";
import iconLight from "@/icon/icon_光.png";
import iconDark from "@/icon/icon_闇.png";

import { DragOverlay } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";

type TierMeta = { id: string; name: string };
type YearValue = number | "";
type Props = {
  tierMeta: TierMeta[];
  containers: Record<string, string[]>; // { pool: [...], S: [...], ... }
  charactersById: Map<string, CharacterForUI>;
  visibleCharacterIds: Set<string> | null;
  nameFilter: string;
  onNameFilterChange: (next: string) => void;
  yearFrom: YearValue;
  yearTo: YearValue;
  yearOptions: number[];
  onYearFromChange: (next: YearValue) => void;
  onYearToChange: (next: YearValue) => void;
  sortOrder: "asc" | "desc";
  onSortOrderChange: (next: "asc" | "desc") => void;
  isElementOrderEnabled: boolean;
  onElementOrderChange: (next: boolean) => void;
  isAllElementsMode: boolean;
  onSelectAllElements: () => void;
  selectedElements: Set<CharacterElement>;
  onToggleElement: (element: CharacterElement) => void;
  selectedObtains: Set<CharacterObtain>;
  onToggleObtain: (obtain: CharacterObtain) => void;
  selectedGachas: Set<CharacterGacha>;
  onToggleGacha: (gacha: CharacterGacha) => void;
  selectedOtherCategories: Set<CharacterOtherCategory>;
  onToggleOtherCategory: (category: CharacterOtherCategory) => void;
  onRenameTier: (tierId: string, nextName: string) => void;
  activeCharacter: CharacterForUI | null;
};

const TierBoard = React.forwardRef<HTMLDivElement, Props>(function TierBoard(
  {
    tierMeta,
    containers,
    charactersById,
    visibleCharacterIds,
    nameFilter,
    onNameFilterChange,
    yearFrom,
    yearTo,
    yearOptions,
    onYearFromChange,
    onYearToChange,
    sortOrder,
    onSortOrderChange,
    isElementOrderEnabled,
    onElementOrderChange,
    isAllElementsMode,
    onSelectAllElements,
    selectedElements,
    onToggleElement,
    selectedObtains,
    onToggleObtain,
    selectedGachas,
    onToggleGacha,
    selectedOtherCategories,
    onToggleOtherCategory,
    onRenameTier,
    activeCharacter,
  },
  ref
) {
  const [isElementFilterOpen, setIsElementFilterOpen] = React.useState(false);
  const elementOrder: CharacterElement[] = ["火", "水", "木", "光", "闇"];
  const obtainOrder: CharacterObtain[] = ["ガチャ", "その他"];
  const gachaOrder: CharacterGacha[] = ["限定", "α", "恒常", "コラボ"];
  const otherCategoryOrder: CharacterOtherCategory[] = [
    "黎絶",
    "轟絶",
    "爆絶",
    "超絶",
    "コラボ",
    "その他",
  ];
  const elementIconMap: Record<CharacterElement, { src: string; alt: string }> = {
    火: { src: iconFire.src, alt: "火属性" },
    水: { src: iconWater.src, alt: "水属性" },
    木: { src: iconWood.src, alt: "木属性" },
    光: { src: iconLight.src, alt: "光属性" },
    闇: { src: iconDark.src, alt: "闇属性" },
  };

  const filterPoolItems = React.useCallback(
    (itemIds: string[]) => {
      if (!visibleCharacterIds) return itemIds;
      return itemIds.filter((id) => visibleCharacterIds.has(id));
    },
    [visibleCharacterIds]
  );

  const sortedPoolItems = React.useMemo(() => {
    const items = filterPoolItems(containers.pool ?? []).slice();
    const elementIndex = new Map<CharacterElement, number>(
      elementOrder.map((el, idx) => [el, idx])
    );

    items.sort((a, b) => {
      const ca = charactersById.get(a);
      const cb = charactersById.get(b);
      if (isElementOrderEnabled) {
        const ea = ca?.element ? (elementIndex.get(ca.element) ?? Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY;
        const eb = cb?.element ? (elementIndex.get(cb.element) ?? Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY;
        if (ea !== eb) return ea - eb;
      }
      const na = ca?.sortNumber ?? Number.POSITIVE_INFINITY;
      const nb = cb?.sortNumber ?? Number.POSITIVE_INFINITY;
      if (na !== nb) return sortOrder === "asc" ? na - nb : nb - na;
      const an = ca?.name ?? "";
      const bn = cb?.name ?? "";
      return an.localeCompare(bn, "ja");
    });

    return items;
  }, [filterPoolItems, containers, charactersById, sortOrder, isElementOrderEnabled]);
  const estimatedRowHeight = 78;
  const tiersHeightPx = Math.max(estimatedRowHeight * tierMeta.length, 420);
  const tiersWidthPx = Math.round((tiersHeightPx * 16) / 9);
  const tiersFrameStyle: React.CSSProperties = {
    width: `min(100%, ${tiersWidthPx}px)`,
    margin: "0 auto",
    height: "auto",
  };

  return (
    <div className="tierBoardRoot">
      <div className="tierBoardInner">
        <div ref={ref} className="tiersFrame" style={tiersFrameStyle}>
          {tierMeta.map((tier, index) => {
            const tierItems = containers[tier.id] ?? [];

            return (
              <SortableContext
                key={tier.id}
                id={tier.id}
                items={tierItems}
                strategy={rectSortingStrategy}
              >
                <TierRow
                  tierId={tier.id}
                  tierName={tier.name}
                  tierIndex={index}
                  itemIds={tierItems}
                  charactersById={charactersById}
                  onRename={(next) => onRenameTier(tier.id, next)}
                />
              </SortableContext>
            );
          })}
        </div>

        <div className="betweenTiersAndFilter" />

        <div className="filterRow">
          <Input
            placeholder="キャラクターを検索"
            value={nameFilter}
            onChange={(e) => onNameFilterChange(e.target.value)}
            aria-label="キャラクターを検索"
          />

          <button
            type="button"
            className="filterIconBtn"
            aria-label="属性フィルター"
            onClick={() => setIsElementFilterOpen((prev) => !prev)}
          >
            <svg viewBox="0 0 24 24" aria-hidden focusable="false">
              <path d="M3 5h18l-7 8v6l-4-2v-4L3 5z" fill="currentColor" />
            </svg>
          </button>
        </div>

        {isElementFilterOpen ? (
          <div className="elementFilterPanel">
            <div className="filterColumns">
              <div className="filterLeftCol">
                <div className="labelRow">
                  <span className="filterLabel">属性</span>
                    <div className="inlineBtns">
                      <button
                        type="button"
                        className="elementBtn"
                        data-selected={isAllElementsMode ? "1" : "0"}
                        onClick={onSelectAllElements}
                        aria-label="全属性"
                      >
                        <img className="elementBtnIcon" src="/icon/icon_全.avif" alt="全属性" />
                      </button>

                      {elementOrder.map((el) => {
                        const selected = selectedElements.has(el);
                      return (
                        <button
                          key={el}
                          type="button"
                          className="elementBtn"
                          data-selected={selected ? "1" : "0"}
                          onClick={() => onToggleElement(el)}
                          aria-label={`${el}属性`}
                        >
                          <img
                            className="elementBtnIcon"
                            src={elementIconMap[el].src}
                            alt={elementIconMap[el].alt}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="labelRow">
                  <span className="filterLabel">入手方法</span>
                  <div className="inlineBtns obtainRow">
                    {obtainOrder.map((ob) => {
                      const selected = selectedObtains.has(ob);
                      return (
                        <button
                          key={ob}
                          type="button"
                          className="obtainBtn"
                          data-selected={selected ? "1" : "0"}
                          onClick={() => onToggleObtain(ob)}
                        >
                          {ob}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {selectedObtains.has("ガチャ") ? (
                  <div className="gachaRow">
                    {gachaOrder.map((g) => {
                      const selected = selectedGachas.has(g);
                      return (
                        <button
                          key={g}
                          type="button"
                          className="gachaBtn"
                          data-selected={selected ? "1" : "0"}
                          onClick={() => onToggleGacha(g)}
                        >
                          {g}
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                {selectedObtains.has("その他") ? (
                  <div className="otherCategoryRow">
                    {otherCategoryOrder.map((category) => {
                      const selected = selectedOtherCategories.has(category);
                      return (
                        <button
                          key={category}
                          type="button"
                          className="otherCategoryBtn"
                          data-selected={selected ? "1" : "0"}
                          onClick={() => onToggleOtherCategory(category)}
                        >
                          {category}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              <div className="filterRightCol">
                <div className="labelRow">
                  <span className="filterLabel">実装年</span>
                  <div className="yearRow">
                    <select
                      className="yearSelect"
                      value={yearFrom === "" ? "" : String(yearFrom)}
                      onChange={(e) => {
                        const v = e.target.value;
                        onYearFromChange(v === "" ? "" : Number(v));
                      }}
                    >
                      <option value="">開始年</option>
                      {yearOptions.map((y) => (
                        <option key={`from-${y}`} value={String(y)}>
                          {y}年
                        </option>
                      ))}
                    </select>

                    <span className="yearSep">〜</span>

                    <select
                      className="yearSelect"
                      value={yearTo === "" ? "" : String(yearTo)}
                      onChange={(e) => {
                        const v = e.target.value;
                        onYearToChange(v === "" ? "" : Number(v));
                      }}
                    >
                      <option value="">終了年</option>
                      {yearOptions.map((y) => (
                        <option key={`to-${y}`} value={String(y)}>
                          {y}年
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="sortRow">
                  <span className="filterLabel">並び順</span>
                  <button
                    type="button"
                    className="sortBtn"
                    data-selected={isElementOrderEnabled ? "1" : "0"}
                    onClick={() => onElementOrderChange(!isElementOrderEnabled)}
                  >
                    属性順
                  </button>
                  <span className="sortSpacer" aria-hidden="true" />
                  <button
                    type="button"
                    className="sortBtn"
                    data-selected={sortOrder === "asc" ? "1" : "0"}
                    onClick={() => onSortOrderChange("asc")}
                  >
                    昇順
                  </button>
                  <button
                    type="button"
                    className="sortBtn"
                    data-selected={sortOrder === "desc" ? "1" : "0"}
                    onClick={() => onSortOrderChange("desc")}
                  >
                    降順
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="betweenFilterAndPool" />

        <SortableContext id="pool" items={sortedPoolItems} strategy={rectSortingStrategy}>
          <PoolRow itemIds={sortedPoolItems} charactersById={charactersById} />
        </SortableContext>
      </div>

      <DragOverlay>
        {activeCharacter ? <DragOverlayPreview character={activeCharacter} /> : null}
      </DragOverlay>

      <style jsx>{`
        .tierBoardRoot {
          width: 100%;
        }

        .tierBoardInner {
          display: grid;
          gap: 0;
        }

        .tiersFrame {
          border: 1px solid #d1d5db;
          background: #ffffff;
        }

        .filterRow {
          max-width: 420px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .filterIconBtn {
          width: 36px;
          height: 36px;
          border: 1px solid #9ca3af;
          background: #ffffff;
          color: #111111;
          border-radius: 8px;
          cursor: pointer;
          display: inline-grid;
          place-items: center;
          padding: 0;
        }

        .filterIconBtn svg {
          width: 18px;
          height: 18px;
        }

        .filterIconBtn:hover {
          background: #f3f4f6;
        }

        .elementFilterPanel {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 8px;
        }

        .filterColumns {
          width: 100%;
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 12px 20px;
          align-items: start;
        }

        .filterLeftCol,
        .filterRightCol {
          display: grid;
          gap: 8px;
        }

        .labelRow {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .filterLabel {
          min-width: 56px;
          color: #111111;
          font-weight: 700;
        }

        .inlineBtns {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .sortRow {
          width: auto;
          margin-left: 0;
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .sortSpacer {
          width: 14px;
          height: 1px;
          display: inline-block;
        }

        .yearRow {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .yearSelect {
          min-width: 110px;
          border: 1px solid #9ca3af;
          background: #ffffff;
          color: #111111;
          border-radius: 8px;
          padding: 6px 8px;
          font-weight: 600;
        }

        .yearSep {
          color: #374151;
          font-weight: 700;
        }

        .sortBtn {
          min-width: 64px;
          border: 1px solid #9ca3af;
          background: #ffffff;
          color: #111111;
          border-radius: 8px;
          padding: 6px 10px;
          cursor: pointer;
          font-weight: 700;
        }

        .sortBtn[data-selected="1"] {
          background: #dbeafe;
          border-color: #2563eb;
        }

        .obtainRow,
        .gachaRow,
        .otherCategoryRow {
          width: 100%;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .gachaRow,
        .otherCategoryRow {
          width: auto;
          margin-left: 64px;
        }

        .labelRow .obtainRow,
        .labelRow .yearRow {
          width: auto;
        }

        .obtainBtn,
        .gachaBtn,
        .otherCategoryBtn {
          min-width: 64px;
          border: 1px solid #9ca3af;
          background: #ffffff;
          color: #111111;
          border-radius: 8px;
          padding: 6px 10px;
          cursor: pointer;
          font-weight: 700;
        }

        .obtainBtn[data-selected="1"],
        .gachaBtn[data-selected="1"],
        .otherCategoryBtn[data-selected="1"] {
          background: #dbeafe;
          border-color: #2563eb;
        }

        .elementBtn {
          width: 40px;
          height: 40px;
          border: 1px solid #9ca3af;
          background: #ffffff;
          color: #111111;
          border-radius: 8px;
          padding: 0;
          cursor: pointer;
          display: inline-grid;
          place-items: center;
        }

        .elementBtn[data-selected="1"] {
          background: #dbeafe;
          border-color: #2563eb;
        }

        .elementBtnIcon {
          width: 24px;
          height: 24px;
          display: block;
        }

        .betweenTiersAndFilter {
          height: 6px;
        }

        .betweenFilterAndPool {
          height: 0;
        }
      `}</style>
    </div>
  );
});

export default TierBoard;
