"use client";

import React from "react";
import type {
  CharacterElement,
  CharacterForUI,
  CharacterGacha,
  CharacterObtain,
  CharacterOtherCategory,
} from "@/app/tier/types";
import TierBoard from "./TierBoard";
import BoardControls from "./controls/BoardControls";

import {
  CollisionDetection,
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  rectSortingStrategy,
} from "@dnd-kit/sortable";

type TierId = string;
type ContainerId = "pool" | TierId;
type SortOrder = "asc" | "desc";
type YearValue = number | "";

type TierMeta = { id: TierId; name: string; color: string };

type Props = {
  characters: CharacterForUI[];
  initialTiers: TierId[]; // ["S","A","B","C"]
};

const DEFAULT_NAME_FILTER = "";
const DEFAULT_YEAR: YearValue = "";
const DEFAULT_SORT_ORDER: SortOrder = "desc";
const DEFAULT_ELEMENT_ORDER_ENABLED = true;
const DEFAULT_IS_ALL_ELEMENTS_MODE = false;
const DEFAULT_SELECTED_ELEMENTS = new Set<CharacterElement>(["火"]);
const DEFAULT_SELECTED_OBTAINS = new Set<CharacterObtain>(["ガチャ"]);
const DEFAULT_SELECTED_GACHAS = new Set<CharacterGacha>(["限定"]);
const DEFAULT_SELECTED_OTHER_CATEGORIES = new Set<CharacterOtherCategory>();

const ELEMENT_OPTIONS: CharacterElement[] = ["火", "水", "木", "光", "闇"];
const OBTAIN_OPTIONS: CharacterObtain[] = ["ガチャ", "降臨", "コラボパック"];
const GACHA_OPTIONS: CharacterGacha[] = ["限定", "α", "恒常", "コラボ"];
const OTHER_CATEGORY_OPTIONS: CharacterOtherCategory[] = [
  "黎絶",
  "轟絶",
  "爆絶",
  "超絶",
  "超究極",
  "コラボ",
  "その他",
];
const YEAR_OPTIONS: number[] = [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018];
const DEFAULT_TIER_COLORS = ["#ef4444", "#f97316", "#facc15", "#22c55e", "#3b82f6", "#a855f7"];

function implementationYearFromNumber(n: number): number | null {
  if (n >= 8927) return 2026;
  if (n >= 8196) return 2025;
  if (n >= 7477) return 2024;
  if (n >= 6736) return 2023;
  if (n >= 5989) return 2022;
  if (n >= 5255) return 2021;
  if (n >= 4511) return 2020;
  if (n >= 3809) return 2019;
  if (n >= 1) return 2018;
  return null;
}

function implementationYearFromCharacter(character: CharacterForUI): number | null {
  return Number.isFinite(character.sortNumber)
    ? implementationYearFromNumber(character.sortNumber)
    : null;
}

function buildInitialState(characters: CharacterForUI[], initialTiers: TierId[]) {
  const tierMeta: TierMeta[] = initialTiers.map((t, idx) => ({
    id: t,
    name: t,
    color: DEFAULT_TIER_COLORS[idx] ?? "#9ca3af",
  }));
  const pool = characters.map((c) => c.id);

  const containers: Record<ContainerId, string[]> = {
    pool,
    ...(Object.fromEntries(initialTiers.map((t) => [t, []])) as Record<TierId, string[]>),
  };

  return { tierMeta, containers };
}

function findContainerOfItem(containers: Record<string, string[]>, itemId: string): string | null {
  for (const [cid, items] of Object.entries(containers)) {
    if (items.includes(itemId)) return cid;
  }
  return null;
}

export default function TierMaker({ characters, initialTiers }: Props) {
  const boardRef = React.useRef<HTMLDivElement | null>(null);

  const [{ tierMeta, containers }, setState] = React.useState(() =>
    buildInitialState(characters, initialTiers)
  );

  // Active dragging item id
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [rankColWidth, setRankColWidth] = React.useState(80);
  const [nameFilter, setNameFilter] = React.useState(DEFAULT_NAME_FILTER);
  const [yearFrom, setYearFrom] = React.useState<YearValue>(DEFAULT_YEAR);
  const [yearTo, setYearTo] = React.useState<YearValue>(DEFAULT_YEAR);
  const [sortOrder, setSortOrder] = React.useState<SortOrder>(DEFAULT_SORT_ORDER);
  const [isElementOrderEnabled, setIsElementOrderEnabled] = React.useState(
    DEFAULT_ELEMENT_ORDER_ENABLED
  );
  const [isAllElementsMode, setIsAllElementsMode] = React.useState(DEFAULT_IS_ALL_ELEMENTS_MODE);
  const [selectedElements, setSelectedElements] = React.useState<Set<CharacterElement>>(
    () => new Set<CharacterElement>(DEFAULT_SELECTED_ELEMENTS)
  );
  const [selectedObtains, setSelectedObtains] = React.useState<Set<CharacterObtain>>(
    () => new Set<CharacterObtain>(DEFAULT_SELECTED_OBTAINS)
  );
  const [selectedGachas, setSelectedGachas] = React.useState<Set<CharacterGacha>>(
    () => new Set<CharacterGacha>(DEFAULT_SELECTED_GACHAS)
  );
  const [selectedOtherCategories, setSelectedOtherCategories] = React.useState<
    Set<CharacterOtherCategory>
  >(() => new Set<CharacterOtherCategory>(DEFAULT_SELECTED_OTHER_CATEGORIES));
  const [appliedNameFilter, setAppliedNameFilter] = React.useState(DEFAULT_NAME_FILTER);
  const [appliedYearFrom, setAppliedYearFrom] = React.useState<YearValue>(DEFAULT_YEAR);
  const [appliedYearTo, setAppliedYearTo] = React.useState<YearValue>(DEFAULT_YEAR);
  const [appliedSortOrder, setAppliedSortOrder] = React.useState<SortOrder>(DEFAULT_SORT_ORDER);
  const [appliedIsElementOrderEnabled, setAppliedIsElementOrderEnabled] = React.useState(
    DEFAULT_ELEMENT_ORDER_ENABLED
  );
  const [appliedIsAllElementsMode, setAppliedIsAllElementsMode] = React.useState(
    DEFAULT_IS_ALL_ELEMENTS_MODE
  );
  const [appliedSelectedElements, setAppliedSelectedElements] = React.useState<Set<CharacterElement>>(
    () => new Set<CharacterElement>(DEFAULT_SELECTED_ELEMENTS)
  );
  const [appliedSelectedObtains, setAppliedSelectedObtains] = React.useState<Set<CharacterObtain>>(
    () => new Set<CharacterObtain>(DEFAULT_SELECTED_OBTAINS)
  );
  const [appliedSelectedGachas, setAppliedSelectedGachas] = React.useState<Set<CharacterGacha>>(
    () => new Set<CharacterGacha>(DEFAULT_SELECTED_GACHAS)
  );
  const [appliedSelectedOtherCategories, setAppliedSelectedOtherCategories] = React.useState<
    Set<CharacterOtherCategory>
  >(() => new Set<CharacterOtherCategory>(DEFAULT_SELECTED_OTHER_CATEGORIES));

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const characterById = React.useMemo(() => {
    const m = new Map<string, CharacterForUI>();
    for (const c of characters) m.set(c.id, c);
    return m;
  }, [characters]);

  const normalizedFilter = appliedNameFilter.trim().toLowerCase();

  const visibleCharacterIds = React.useMemo(() => {
    if (normalizedFilter) {
      const ids = new Set<string>();
      for (const c of characters) {
        const name = c.name.trim().toLowerCase();
        const nameKana = c.nameKana.trim().toLowerCase();
        if (name.includes(normalizedFilter) || nameKana.includes(normalizedFilter)) {
          ids.add(c.id);
        }
      }
      return ids;
    }

    const isAllElementsSelected = appliedIsAllElementsMode;
    const isAllObtainsSelected = OBTAIN_OPTIONS.every((o) => appliedSelectedObtains.has(o));
    const isAllGachasSelected = GACHA_OPTIONS.every((g) => appliedSelectedGachas.has(g));
    const isAllOtherCategoriesSelected = OTHER_CATEGORY_OPTIONS.every((o) =>
      appliedSelectedOtherCategories.has(o)
    );
    const isYearUnselected = appliedYearFrom === "" && appliedYearTo === "";
    if (
      !normalizedFilter &&
      isAllElementsSelected &&
      isAllObtainsSelected &&
      isAllGachasSelected &&
      isAllOtherCategoriesSelected &&
      isYearUnselected
    ) {
      return null;
    }

    const ids = new Set<string>();
    for (const c of characters) {
      const isElementMatched =
        appliedIsAllElementsMode || (!!c.element && appliedSelectedElements.has(c.element));
      const isObtainMatched = !!c.obtain && appliedSelectedObtains.has(c.obtain);
      const isSubtypeMatched =
        c.obtain === "ガチャ"
          ? !!c.gachaType && appliedSelectedGachas.has(c.gachaType)
          : c.obtain === "降臨"
            ? !!c.otherCategory && appliedSelectedOtherCategories.has(c.otherCategory)
            : true;
      const implYear = implementationYearFromCharacter(c);
      const minYear = appliedYearFrom === "" ? Number.NEGATIVE_INFINITY : appliedYearFrom;
      const maxYear = appliedYearTo === "" ? Number.POSITIVE_INFINITY : appliedYearTo;
      const isYearMatched =
        (appliedYearFrom === "" && appliedYearTo === "") ||
        (implYear !== null && implYear >= minYear && implYear <= maxYear);

      if (isElementMatched && isObtainMatched && isSubtypeMatched && isYearMatched) {
        ids.add(c.id);
      }
    }
    return ids;
  }, [
    characters,
    normalizedFilter,
    appliedSelectedElements,
    appliedIsAllElementsMode,
    appliedSelectedObtains,
    appliedSelectedGachas,
    appliedSelectedOtherCategories,
    appliedYearFrom,
    appliedYearTo,
  ]);

  function toggleElementFilter(element: CharacterElement) {
    setSelectedElements((prev) => {
      const next = new Set(prev);
      if (next.has(element)) {
        next.delete(element);
      } else {
        next.add(element);
      }
      setIsAllElementsMode(next.size === 0);
      return next;
    });
  }

  function selectAllElements() {
    setIsAllElementsMode(true);
    setSelectedElements(new Set<CharacterElement>());
  }

  function toggleObtainFilter(obtain: CharacterObtain) {
    setSelectedObtains((prev) => {
      const next = new Set(prev);
      if (next.has(obtain)) {
        next.delete(obtain);
        if (obtain === "ガチャ") {
          setSelectedGachas(new Set<CharacterGacha>());
        }
        if (obtain === "降臨") {
          setSelectedOtherCategories(new Set<CharacterOtherCategory>());
        }
      } else {
        next.add(obtain);
        if (obtain === "ガチャ") {
          setSelectedGachas(new Set<CharacterGacha>(["限定"]));
        }
        if (obtain === "降臨") {
          setSelectedOtherCategories(new Set<CharacterOtherCategory>(["黎絶"]));
        }
      }
      return next;
    });
  }

  function toggleGachaFilter(gacha: CharacterGacha) {
    setSelectedGachas((prev) => {
      const next = new Set(prev);
      if (next.has(gacha)) {
        next.delete(gacha);
      } else {
        next.add(gacha);
      }
      return next;
    });
  }

  function toggleOtherCategoryFilter(category: CharacterOtherCategory) {
    setSelectedOtherCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }

  function applyFilters() {
    setAppliedNameFilter(nameFilter);
    setAppliedYearFrom(yearFrom);
    setAppliedYearTo(yearTo);
    setAppliedSortOrder(sortOrder);
    setAppliedIsElementOrderEnabled(isElementOrderEnabled);
    setAppliedIsAllElementsMode(isAllElementsMode);
    setAppliedSelectedElements(new Set(selectedElements));
    setAppliedSelectedObtains(new Set(selectedObtains));
    setAppliedSelectedGachas(
      selectedObtains.has("ガチャ")
        ? new Set(selectedGachas)
        : new Set<CharacterGacha>()
    );
    setAppliedSelectedOtherCategories(
      selectedObtains.has("降臨")
        ? new Set(selectedOtherCategories)
        : new Set<CharacterOtherCategory>()
    );
  }

  function resetFilters() {
    setNameFilter(DEFAULT_NAME_FILTER);
    setYearFrom(DEFAULT_YEAR);
    setYearTo(DEFAULT_YEAR);
    setSortOrder(DEFAULT_SORT_ORDER);
    setIsElementOrderEnabled(DEFAULT_ELEMENT_ORDER_ENABLED);
    setIsAllElementsMode(DEFAULT_IS_ALL_ELEMENTS_MODE);
    setSelectedElements(new Set<CharacterElement>(DEFAULT_SELECTED_ELEMENTS));
    setSelectedObtains(new Set<CharacterObtain>(DEFAULT_SELECTED_OBTAINS));
    setSelectedGachas(new Set<CharacterGacha>(DEFAULT_SELECTED_GACHAS));
    setSelectedOtherCategories(new Set<CharacterOtherCategory>(DEFAULT_SELECTED_OTHER_CATEGORIES));

    setAppliedNameFilter(DEFAULT_NAME_FILTER);
    setAppliedYearFrom(DEFAULT_YEAR);
    setAppliedYearTo(DEFAULT_YEAR);
    setAppliedSortOrder(DEFAULT_SORT_ORDER);
    setAppliedIsElementOrderEnabled(DEFAULT_ELEMENT_ORDER_ENABLED);
    setAppliedIsAllElementsMode(DEFAULT_IS_ALL_ELEMENTS_MODE);
    setAppliedSelectedElements(new Set<CharacterElement>(DEFAULT_SELECTED_ELEMENTS));
    setAppliedSelectedObtains(new Set<CharacterObtain>(DEFAULT_SELECTED_OBTAINS));
    setAppliedSelectedGachas(new Set<CharacterGacha>(DEFAULT_SELECTED_GACHAS));
    setAppliedSelectedOtherCategories(new Set<CharacterOtherCategory>(DEFAULT_SELECTED_OTHER_CATEGORIES));
  }

  const containerIds: ContainerId[] = React.useMemo(() => {
    return ["pool", ...tierMeta.map((t) => t.id)];
  }, [tierMeta]);

  const collisionDetection: CollisionDetection = React.useCallback((args) => {
    const byPointer = pointerWithin(args);
    return byPointer.length > 0 ? byPointer : closestCenter(args);
  }, []);

  function resetBoard() {
    setActiveId(null);
    setState(buildInitialState(characters, initialTiers));
  }

  function renameTier(tierId: TierId, nextName: string) {
    setState((prev) => ({
      ...prev,
      tierMeta: prev.tierMeta.map((t) => (t.id === tierId ? { ...t, name: nextName } : t)),
    }));
  }

  function setTierColor(tierId: TierId, nextColor: string) {
    setState((prev) => ({
      ...prev,
      tierMeta: prev.tierMeta.map((t) => (t.id === tierId ? { ...t, color: nextColor } : t)),
    }));
  }

  function addTierBelow(tierId: TierId) {
    setState((prev) => {
      const next = structuredClone(prev);
      const index = next.tierMeta.findIndex((t: TierMeta) => t.id === tierId);
      if (index === -1) return prev;
      const newTierId = `tier-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      next.tierMeta.splice(index + 1, 0, { id: newTierId, name: "新規", color: "#ffffff" });
      next.containers[newTierId] = [];
      return next;
    });
  }

  function deleteTier(tierId: TierId) {
    setState((prev) => {
      if (prev.tierMeta.length <= 1) return prev;
      const next = structuredClone(prev);
      const tierItems: string[] = next.containers[tierId] ?? [];
      next.tierMeta = next.tierMeta.filter((t: TierMeta) => t.id !== tierId);
      delete next.containers[tierId];
      next.containers.pool = [...next.containers.pool, ...tierItems];
      return next;
    });
  }

  function handleDragStart(e: DragStartEvent) {
    const id = String(e.active.id);
    setActiveId(id);
  }

  function handleDragOver(e: DragOverEvent) {
    const active = String(e.active.id);
    const over = e.over?.id ? String(e.over.id) : null;
    if (!over) return;

    setState((prev) => {
      const next = structuredClone(prev);

      const activeContainer = findContainerOfItem(next.containers, active);
      if (!activeContainer) return prev;

      // over can be a container id (e.g., "S") or an item id (e.g., "123")
      const overIsContainer = containerIds.includes(over as ContainerId);
      const overContainer = overIsContainer ? over : findContainerOfItem(next.containers, over);

      if (!overContainer) return prev;
      if (activeContainer === overContainer) return prev;

      // remove from old container
      const fromItems = next.containers[activeContainer];
      const fromIndex = fromItems.indexOf(active);
      if (fromIndex === -1) return prev;
      fromItems.splice(fromIndex, 1);

      // insert into new container near hovered item, or at end if hovering container
      const toItems = next.containers[overContainer];
      let insertIndex = toItems.length;

      if (!overIsContainer) {
        const overIndex = toItems.indexOf(over);
        insertIndex = overIndex >= 0 ? overIndex : toItems.length;
      }

      toItems.splice(insertIndex, 0, active);

      return next;
    });
  }

  function handleDragEnd(e: DragEndEvent) {
    const active = String(e.active.id);
    const over = e.over?.id ? String(e.over.id) : null;

    setActiveId(null);
    if (!over) return;

    setState((prev) => {
      const next = structuredClone(prev);

      const activeContainer = findContainerOfItem(next.containers, active);
      if (!activeContainer) return prev;

      const overIsContainer = containerIds.includes(over as ContainerId);
      const overContainer = overIsContainer ? over : findContainerOfItem(next.containers, over);
      if (!overContainer) return prev;

      // reorder within same container
      if (activeContainer === overContainer && !overIsContainer) {
        const items = next.containers[activeContainer];
        const oldIndex = items.indexOf(active);
        const newIndex = items.indexOf(over);
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          next.containers[activeContainer] = arrayMove(items, oldIndex, newIndex);
        }
      }

      return next;
    });
  }

  const activeCharacter = activeId ? characterById.get(activeId) ?? null : null;
  return (
    <div className="stack">
      <div className="controlsBand">
        <BoardControls onReset={resetBoard} exportTargetRef={boardRef} />
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {/* SortableContext is applied per container inside TierBoard */}
        <TierBoard
          ref={boardRef}
          tierMeta={tierMeta}
          containers={containers}
          charactersById={characterById}
          visibleCharacterIds={visibleCharacterIds}
          nameFilter={nameFilter}
          onNameFilterChange={setNameFilter}
          yearFrom={yearFrom}
          yearTo={yearTo}
          yearOptions={YEAR_OPTIONS}
          onYearFromChange={setYearFrom}
          onYearToChange={setYearTo}
          sortOrder={sortOrder}
          onSortOrderChange={setSortOrder}
          isElementOrderEnabled={isElementOrderEnabled}
          onElementOrderChange={setIsElementOrderEnabled}
          effectiveSortOrder={appliedSortOrder}
          effectiveElementOrderEnabled={appliedIsElementOrderEnabled}
          selectedElements={selectedElements}
          onToggleElement={toggleElementFilter}
          isAllElementsMode={isAllElementsMode}
          onSelectAllElements={selectAllElements}
          selectedObtains={selectedObtains}
          onToggleObtain={toggleObtainFilter}
          selectedGachas={selectedGachas}
          onToggleGacha={toggleGachaFilter}
          selectedOtherCategories={selectedOtherCategories}
          onToggleOtherCategory={toggleOtherCategoryFilter}
          onApplyFilters={applyFilters}
          onResetFilters={resetFilters}
          onRenameTier={renameTier}
          onSetTierColor={setTierColor}
          onAddTierBelow={addTierBelow}
          onDeleteTier={deleteTier}
          rankColWidth={rankColWidth}
          onRankColWidthChange={setRankColWidth}
          activeItemId={activeId}
          activeCharacter={activeCharacter}
        />
      </DndContext>

      <style jsx>{`
        .controlsBand {
          position: sticky;
          top: 0;
          z-index: 30;
          background: #ffffff;
          border-bottom: 1px solid #d1d5db;
          padding: 4px 8px;
          margin: 0;
        }

      `}</style>
    </div>
  );
}
