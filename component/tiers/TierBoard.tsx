"use client";

import React from "react";
import type {
  CharacterContent,
  CharacterElement,
  CharacterForm,
  CharacterForUI,
  CharacterGacha,
  CharacterObtain,
  CharacterOtherCategory,
  PoolSourceType,
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

type TierMeta = { id: string; name: string; color: string };
type YearValue = number | "";
type Props = {
  boardTitle: string;
  onBoardTitleChange: (next: string) => void;
  tierMeta: TierMeta[];
  containers: Record<string, string[]>; // { pool: [...], S: [...], ... }
  charactersById: Map<string, CharacterForUI>;
  visibleCharacterIds: Set<string>;
  nameFilter: string;
  onNameFilterChange: (next: string) => void;
  selectedPoolSource: PoolSourceType;
  onPoolSourceChange: (next: PoolSourceType) => void;
  includeUnobtainable: boolean;
  onIncludeUnobtainableChange: (next: boolean) => void;
  yearFrom: YearValue;
  yearTo: YearValue;
  yearOptions: number[];
  onYearFromChange: (next: YearValue) => void;
  onYearToChange: (next: YearValue) => void;
  sortOrder: "asc" | "desc";
  onSortOrderChange: (next: "asc" | "desc") => void;
  isElementOrderEnabled: boolean;
  onElementOrderChange: (next: boolean) => void;
  effectiveSortOrder: "asc" | "desc";
  effectiveElementOrderEnabled: boolean;
  isAllElementsMode: boolean;
  onSelectAllElements: () => void;
  selectedElements: Set<CharacterElement>;
  onToggleElement: (element: CharacterElement) => void;
  selectedObtains: Set<CharacterObtain>;
  onToggleObtain: (obtain: CharacterObtain) => void;
  selectedGachas: Set<CharacterGacha>;
  onToggleGacha: (gacha: CharacterGacha) => void;
  selectedForms: Set<CharacterForm>;
  onToggleForm: (form: CharacterForm) => void;
  selectedContents: Set<CharacterContent>;
  onToggleContent: (content: CharacterContent) => void;
  selectedOtherCategories: Set<CharacterOtherCategory>;
  onToggleOtherCategory: (category: CharacterOtherCategory) => void;
  onApplyFilters: () => void;
  onResetFilters: () => void;
  onRenameTier: (tierId: string, nextName: string) => void;
  onSetTierColor: (tierId: string, nextColor: string) => void;
  onAddTierBelow: (tierId: string) => void;
  onDeleteTier: (tierId: string) => void;
  rankColWidth: number;
  onRankColWidthChange: (next: number) => void;
  activeItemId: string | null;
  activeCharacter: CharacterForUI | null;
  onUploadLocalImages: (files: FileList | File[]) => void;
};

const TierBoard = React.forwardRef<HTMLDivElement, Props>(function TierBoard(
  {
    boardTitle,
    onBoardTitleChange,
    tierMeta,
    containers,
    charactersById,
    visibleCharacterIds,
    nameFilter,
    onNameFilterChange,
    selectedPoolSource,
    onPoolSourceChange,
    includeUnobtainable,
    onIncludeUnobtainableChange,
    yearFrom,
    yearTo,
    yearOptions,
    onYearFromChange,
    onYearToChange,
    sortOrder,
    onSortOrderChange,
    isElementOrderEnabled,
    onElementOrderChange,
    effectiveSortOrder,
    effectiveElementOrderEnabled,
    isAllElementsMode,
    onSelectAllElements,
    selectedElements,
    onToggleElement,
    selectedObtains,
    onToggleObtain,
    selectedGachas,
    onToggleGacha,
    selectedForms,
    onToggleForm,
    selectedContents,
    onToggleContent,
    selectedOtherCategories,
    onToggleOtherCategory,
    onApplyFilters,
    onResetFilters,
    onRenameTier,
    onSetTierColor,
    onAddTierBelow,
    onDeleteTier,
    rankColWidth,
    onRankColWidthChange,
    activeItemId,
    activeCharacter,
    onUploadLocalImages,
  },
  ref
) {
  const [isElementFilterOpen, setIsElementFilterOpen] = React.useState(true);
  const [isMobileViewport, setIsMobileViewport] = React.useState(false);
  const uploadInputRef = React.useRef<HTMLInputElement | null>(null);
  const isShugojuMode = selectedPoolSource === "shugoju";
  const isGachaObtainEnabled = selectedObtains.has("ガチャ");
  const isOtherObtainEnabled = selectedObtains.has("降臨");
  const elementOrder: CharacterElement[] = ["火", "水", "木", "光", "闇"];
  const obtainOrder: CharacterObtain[] = ["ガチャ", "降臨", "コラボパック"];
  const gachaOrder: CharacterGacha[] = ["限定", "α", "恒常", "コラボ"];
  const formOrder: CharacterForm[] = ["進化/神化", "獣神化", "獣神化改", "真獣神化"];
  const contentOrder: CharacterContent[] = ["破界の星墓", "天魔の孤城", "禁忌の獄"];
  const otherCategoryRow1: CharacterOtherCategory[] = ["黎絶", "轟絶", "爆絶", "超絶"];
  const otherCategoryRow2: CharacterOtherCategory[] = ["超究極", "コラボ", "その他"];
  const elementIconMap: Record<CharacterElement, { src: string; alt: string }> = {
    火: { src: iconFire.src, alt: "火属性" },
    水: { src: iconWater.src, alt: "水属性" },
    木: { src: iconWood.src, alt: "木属性" },
    光: { src: iconLight.src, alt: "光属性" },
    闇: { src: iconDark.src, alt: "闇属性" },
  };

  const filterPoolItems = React.useCallback(
    (itemIds: string[]) => itemIds.filter((id) => visibleCharacterIds.has(id)),
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
      if (effectiveElementOrderEnabled) {
        const ea = ca?.element ? (elementIndex.get(ca.element) ?? Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY;
        const eb = cb?.element ? (elementIndex.get(cb.element) ?? Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY;
        if (ea !== eb) return ea - eb;
      }
      const na = ca?.sortNumber ?? Number.POSITIVE_INFINITY;
      const nb = cb?.sortNumber ?? Number.POSITIVE_INFINITY;
      if (na !== nb) return effectiveSortOrder === "asc" ? na - nb : nb - na;
      const an = ca?.name ?? "";
      const bn = cb?.name ?? "";
      return an.localeCompare(bn, "ja");
    });

    return items;
  }, [filterPoolItems, containers, charactersById, effectiveSortOrder, effectiveElementOrderEnabled]);
  const estimatedRowHeight = 78;
  const tiersHeightPx = Math.max(estimatedRowHeight * tierMeta.length, 420);
  const tiersWidthPx = Math.round((tiersHeightPx * 16) / 9);
  React.useEffect(() => {
    const updateViewport = () => setIsMobileViewport(window.innerWidth <= 768);
    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  const tiersFrameStyle: React.CSSProperties = {
    width: isMobileViewport
      ? `min(90%, ${tiersWidthPx}px)`
      : "100%",
    margin: isMobileViewport ? "0 auto 0 0" : "0",
    height: "auto",
  };
  const poolAreaStyle: React.CSSProperties = {
    width: isMobileViewport ? `min(90%, ${tiersWidthPx}px)` : "calc((100% - 16px) * 0.7)",
    margin: isMobileViewport ? "0 auto 0 0" : "0",
    height: "auto",
  };

  return (
    <div className="tierBoardRoot">
      <div className="tierBoardInner">
        <div className="topLayout">
          <div className="boardColumn" style={tiersFrameStyle}>
            <label className="boardTitleField">
              <span className="boardTitleLabel">タイトル</span>
              <input
                className="boardTitleInput"
                type="text"
                value={boardTitle}
                onChange={(event) => onBoardTitleChange(event.target.value)}
                placeholder="タイトルを入力"
                aria-label="表のタイトル"
              />
            </label>
            <div ref={ref} className="tiersFrame">
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
                    tierColor={tier.color}
                    itemIds={tierItems}
                    charactersById={charactersById}
                    onRename={(next) => onRenameTier(tier.id, next)}
                  onSetColor={(nextColor) => onSetTierColor(tier.id, nextColor)}
                  onAddBelow={() => onAddTierBelow(tier.id)}
                  onDelete={() => onDeleteTier(tier.id)}
                  canDelete={tierMeta.length > 1}
                  rankColWidth={rankColWidth}
                  onRankColWidthChange={onRankColWidthChange}
                />
              </SortableContext>
            );
            })}
            </div>
          </div>

          <div className="filterArea">
            <div className="betweenTiersAndFilter" />

            <div className="filterRow">
              <Input
                placeholder="名前を検索"
                value={nameFilter}
                onChange={(e) => onNameFilterChange(e.target.value)}
                aria-label="名前を検索"
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
              <button type="button" className="searchBtn" onClick={onApplyFilters}>
                検索
              </button>
            </div>

            {isElementFilterOpen ? (
              <div className="elementFilterPanel">
                <div className="blockRow">
                  <span className="filterLabel">表示対象</span>
                  <div className="sourceRow">
                    <button
                      type="button"
                      className="sourceBtn"
                      data-selected={selectedPoolSource === "character" ? "1" : "0"}
                      onClick={() => onPoolSourceChange("character")}
                    >
                      キャラクター
                    </button>
                    <button
                      type="button"
                      className="sourceBtn"
                      data-selected={selectedPoolSource === "shugoju" ? "1" : "0"}
                      onClick={() => onPoolSourceChange("shugoju")}
                    >
                      守護獣
                    </button>
                  </div>
                </div>
                <div className="filterColumns">
                  <div className="filterLeftCol" data-disabled={isShugojuMode ? "1" : "0"}>
                    <div className="labelRow attributeRow">
                      <span className="filterLabel">属性</span>
                      <div className="inlineBtns">
                        <button
                          type="button"
                          className="elementBtn"
                          data-selected={isAllElementsMode ? "1" : "0"}
                          onClick={onSelectAllElements}
                          aria-label="全属性"
                          disabled={isShugojuMode}
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
                              disabled={isShugojuMode}
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

                    <div className="blockRow">
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
                              disabled={isShugojuMode}
                            >
                              {ob}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="gachaRow" data-enabled={isGachaObtainEnabled ? "1" : "0"}>
                        {gachaOrder.map((g) => {
                          const selected = selectedGachas.has(g);
                          return (
                            <button
                              key={g}
                              type="button"
                              className="gachaBtn"
                              data-selected={selected ? "1" : "0"}
                              disabled={isShugojuMode || !isGachaObtainEnabled}
                              onClick={() => onToggleGacha(g)}
                            >
                              {g}
                            </button>
                          );
                        })}
                    </div>

                <div className="otherCategoryRow" data-enabled={isOtherObtainEnabled ? "1" : "0"}>
                    {otherCategoryRow1.map((category) => {
                      const selected = selectedOtherCategories.has(category);
                      return (
                        <button
                          key={category}
                          type="button"
                          className="otherCategoryBtn"
                          data-selected={selected ? "1" : "0"}
                          disabled={isShugojuMode || !isOtherObtainEnabled}
                          onClick={() => onToggleOtherCategory(category)}
                        >
                          {category}
                        </button>
                      );
                    })}
                    <div className="otherCategorySubRow">
                      {otherCategoryRow2.map((category) => {
                        const selected = selectedOtherCategories.has(category);
                        return (
                          <button
                            key={category}
                            type="button"
                            className="otherCategoryBtn"
                            data-selected={selected ? "1" : "0"}
                            disabled={isShugojuMode || !isOtherObtainEnabled}
                            onClick={() => onToggleOtherCategory(category)}
                          >
                            {category}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                    <div className="blockRow">
                      <span className="filterLabel">クエスト</span>
                      <div className="contentRow">
                        {contentOrder.map((content) => {
                          const selected = selectedContents.has(content);
                          return (
                            <button
                              key={content}
                              type="button"
                              className="contentBtn"
                              data-selected={selected ? "1" : "0"}
                              onClick={() => onToggleContent(content)}
                              disabled={isShugojuMode}
                            >
                              {content}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="blockRow">
                      <span className="filterLabel">形態</span>
                      <div className="formRow">
                        {formOrder.map((form) => {
                          const selected = selectedForms.has(form);
                          return (
                            <button
                              key={form}
                              type="button"
                              className="formBtn"
                              data-selected={selected ? "1" : "0"}
                              onClick={() => onToggleForm(form)}
                              disabled={isShugojuMode}
                            >
                              {form}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="filterRightCol" data-disabled={isShugojuMode ? "1" : "0"}>
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
                          disabled={isShugojuMode}
                        >
                          <option value="">開始年</option>
                          {yearOptions.map((y) => (
                            <option key={`from-${y}`} value={String(y)}>
                              {y === 2018 ? "2018年以前" : `${y}年`}
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
                          disabled={isShugojuMode}
                        >
                          <option value="">終了年</option>
                          {yearOptions.map((y) => (
                            <option key={`to-${y}`} value={String(y)}>
                              {y === 2018 ? "2018年以前" : `${y}年`}
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
                        disabled={isShugojuMode}
                      >
                        属性順
                      </button>
                      <span className="sortSpacer" aria-hidden="true" />
                      <button
                        type="button"
                        className="sortBtn"
                        data-selected={sortOrder === "asc" ? "1" : "0"}
                        onClick={() => onSortOrderChange("asc")}
                        disabled={isShugojuMode}
                      >
                        昇順
                      </button>
                      <button
                        type="button"
                        className="sortBtn"
                        data-selected={sortOrder === "desc" ? "1" : "0"}
                        onClick={() => onSortOrderChange("desc")}
                        disabled={isShugojuMode}
                      >
                        降順
                      </button>
                    </div>
                  </div>
                </div>
                <label className="unobtainableToggle">
                  <input
                    type="checkbox"
                    checked={includeUnobtainable}
                    onChange={(e) => onIncludeUnobtainableChange(e.target.checked)}
                    disabled={isShugojuMode}
                  />
                  <span>入手不可能キャラ（コラボ超究極の一部ボスなど）を含む</span>
                </label>
                <button
                  type="button"
                  className="resetFiltersBtn"
                  onClick={onResetFilters}
                >
                  絞り込みをリセット
                </button>
              </div>
            ) : null}

            <div className="betweenFilterAndPool" />
          </div>
        </div>

        <div className="poolArea" style={poolAreaStyle}>
          <PoolRow
            itemIds={sortedPoolItems}
            charactersById={charactersById}
            groupByElement={effectiveElementOrderEnabled}
            activeItemId={activeItemId}
          />
          <div className="uploadArea">
            <input
              ref={uploadInputRef}
              className="uploadInput"
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                if (!e.target.files || e.target.files.length === 0) return;
                onUploadLocalImages(e.target.files);
                e.currentTarget.value = "";
              }}
            />
            <button
              type="button"
              className="uploadBtn"
              onClick={() => uploadInputRef.current?.click()}
            >
              画像をアップロード
            </button>
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeCharacter ? <DragOverlayPreview character={activeCharacter} /> : null}
      </DragOverlay>

      <style jsx>{`
        .tierBoardRoot {
          width: 100%;
          max-width: 100%;
          overflow-x: hidden;
        }

        .tierBoardInner {
          display: grid;
          gap: 8px;
          min-width: 0;
          width: 100%;
          max-width: 100%;
          overflow-x: hidden;
        }

        .topLayout {
          width: 100%;
          max-width: 100%;
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 8px;
          align-items: start;
        }

        .filterArea {
          width: 100%;
          max-width: 100%;
          min-width: 0;
          overflow: hidden;
        }

        .boardColumn {
          display: grid;
          gap: 8px;
        }

        .boardTitleField {
          display: grid;
          gap: 4px;
          width: 100%;
          max-width: 360px;
        }

        .boardTitleLabel {
          color: #111111;
          font-size: 13px;
          font-weight: 700;
          line-height: 1.2;
        }

        .boardTitleInput {
          width: 100%;
          border: 1px solid #9ca3af;
          border-radius: 8px;
          padding: 8px 10px;
          font-size: 14px;
          color: #111111;
          background: #ffffff;
          box-sizing: border-box;
        }

        .poolArea {
          max-width: 100%;
          overflow: hidden;
        }

        .uploadArea {
          margin-top: 8px;
          display: flex;
          justify-content: flex-start;
        }

        .uploadInput {
          display: none;
        }

        .uploadBtn {
          border: 1px solid #6b7280;
          background: #ffffff;
          color: #111111;
          padding: 6px 12px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 700;
          font-size: 13px;
          line-height: 1.2;
        }

        .uploadBtn:hover {
          background: #f3f4f6;
        }

        .tiersFrame {
          border: 1px solid #d1d5db;
          background: #ffffff;
        }

        .filterRow {
          width: 100%;
          max-width: 420px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding-right: 12px;
          box-sizing: border-box;
        }

        .filterRow :global(.uiInput) {
          flex: 0 1 260px;
          max-width: 260px;
          min-width: 0;
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

        .searchBtn {
          height: 36px;
          min-width: 72px;
          border: 1px solid #1d4ed8;
          background: #3b82f6;
          color: #ffffff;
          border-radius: 8px;
          padding: 0 12px;
          font-weight: 700;
          white-space: nowrap;
          cursor: pointer;
        }

        .searchBtn:hover {
          background: #2563eb;
        }

        .elementFilterPanel {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 8px;
          max-width: 100%;
          overflow-x: hidden;
        }

        .resetFiltersBtn {
          align-self: flex-start;
          border: none;
          background: transparent;
          color: #2563eb;
          font-size: 13px;
          font-weight: 700;
          padding: 0;
          cursor: pointer;
          text-decoration: underline;
        }

        .resetFiltersBtn:hover {
          color: #1d4ed8;
        }

        .filterColumns {
          width: 100%;
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 10px;
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

        .blockRow {
          width: 100%;
          display: grid;
          gap: 6px;
        }

        .filterLabel {
          min-width: 56px;
          color: #111111;
          font-weight: 700;
        }

        .unobtainableToggle {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          color: #374151;
          font-size: 11px;
          line-height: 1.2;
          user-select: none;
        }

        .unobtainableToggle input {
          margin: 0;
        }

        .inlineBtns {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .sourceRow {
          width: 100%;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .sourceBtn {
          min-width: 96px;
          border: 1px solid #9ca3af;
          background: #ffffff;
          color: #111111;
          border-radius: 8px;
          padding: 6px 12px;
          cursor: pointer;
          font-weight: 700;
        }

        .sourceBtn[data-selected="1"] {
          background: #dbeafe;
          border-color: #2563eb;
        }

        .attributeRow .inlineBtns {
          flex-wrap: nowrap;
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
        .contentRow,
        .formRow,
        .otherCategoryRow,
        .otherCategorySubRow {
          width: 100%;
          display: flex;
          align-items: flex-start;
          gap: 8px;
          flex-wrap: wrap;
        }

        .gachaRow,
        .otherCategoryRow {
          margin-left: 0;
        }

        .obtainRow {
          padding-bottom: 6px;
          border-bottom: 1px solid #d1d5db;
        }

        .otherCategorySubRow {
          flex-basis: 100%;
        }

        .labelRow .obtainRow,
        .labelRow .yearRow {
          width: auto;
        }

        .obtainBtn,
        .gachaBtn,
        .contentBtn,
        .formBtn,
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
        .contentBtn[data-selected="1"],
        .formBtn[data-selected="1"],
        .otherCategoryBtn[data-selected="1"] {
          background: #dbeafe;
          border-color: #2563eb;
        }

        .otherCategoryRow[data-enabled="0"] .otherCategoryBtn {
          background: #f3f4f6;
          color: #9ca3af;
          border-color: #d1d5db;
          cursor: not-allowed;
        }

        .gachaRow[data-enabled="0"] .gachaBtn {
          background: #f3f4f6;
          color: #9ca3af;
          border-color: #d1d5db;
          cursor: not-allowed;
        }

        .filterLeftCol[data-disabled="1"],
        .filterRightCol[data-disabled="1"] {
          opacity: 0.5;
        }

        .elementBtn:disabled,
        .obtainBtn:disabled,
        .gachaBtn:disabled,
        .contentBtn:disabled,
        .formBtn:disabled,
        .otherCategoryBtn:disabled,
        .sortBtn:disabled,
        .yearSelect:disabled {
          cursor: not-allowed;
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

        @media (min-width: 1024px) {
          .topLayout {
            grid-template-columns: minmax(0, 7fr) minmax(320px, 3fr);
            gap: 16px;
            align-items: start;
          }

          .filterArea {
            position: relative;
            padding-top: 2px;
            padding-left: 12px;
            max-width: none;
            box-sizing: border-box;
            overflow: visible;
          }

          .filterRow {
            max-width: 100%;
          }

          .elementFilterPanel {
            position: absolute;
            top: 46px;
            left: 12px;
            right: 0;
            z-index: 25;
            margin-top: 0;
            padding: 10px;
            border: 1px solid #d1d5db;
            border-radius: 10px;
            background: #ffffff;
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
            max-height: none;
            overflow: visible;
          }
        }

        @media (max-width: 768px) {
          .topLayout {
            display: contents;
          }

          .tiersFrame {
            order: 1;
          }

          .poolArea {
            order: 2;
          }

          .filterArea {
            order: 3;
          }

          .gachaRow {
            margin-left: 0;
            flex-wrap: nowrap;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }

          .otherCategoryRow {
            margin-left: 0;
            flex-wrap: wrap;
            overflow: visible;
          }
        }
      `}</style>
    </div>
  );
});

export default TierBoard;
