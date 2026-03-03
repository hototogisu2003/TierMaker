"use client";

import React from "react";
import type {
  CharacterElement,
  CharacterForUI,
  CharacterGacha,
  CharacterObtain,
  CharacterOtherCategory,
} from "@/app/page";
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

type TierMeta = { id: TierId; name: string };

type Props = {
  characters: CharacterForUI[];
  initialTiers: TierId[]; // ["S","A","B","C"]
};

const ELEMENT_OPTIONS: CharacterElement[] = ["火", "水", "木", "光", "闇"];
const OBTAIN_OPTIONS: CharacterObtain[] = ["ガチャ", "その他"];
const GACHA_OPTIONS: CharacterGacha[] = ["限定", "α", "恒常", "コラボ"];
const OTHER_CATEGORY_OPTIONS: CharacterOtherCategory[] = ["黎絶", "轟絶", "爆絶", "コラボ", "その他"];
const YEAR_OPTIONS: number[] = [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018];

function implementationYearFromNumber(n: number): number | null {
  if (n >= 8927) return 2026;
  if (n >= 8196) return 2025;
  if (n >= 7477) return 2024;
  if (n >= 6736) return 2023;
  if (n >= 5989) return 2022;
  if (n >= 5255) return 2021;
  if (n >= 4511) return 2020;
  if (n >= 3811) return 2019;
  if (n >= 3086) return 2018;
  return null;
}

function buildInitialState(characters: CharacterForUI[], initialTiers: TierId[]) {
  const tierMeta: TierMeta[] = initialTiers.map((t) => ({ id: t, name: t }));
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
  const [nameFilter, setNameFilter] = React.useState("");
  const [yearFrom, setYearFrom] = React.useState<YearValue>("");
  const [yearTo, setYearTo] = React.useState<YearValue>("");
  const [sortOrder, setSortOrder] = React.useState<SortOrder>("desc");
  const [isElementOrderEnabled, setIsElementOrderEnabled] = React.useState(true);
  const [selectedElements, setSelectedElements] = React.useState<Set<CharacterElement>>(
    () => new Set(ELEMENT_OPTIONS)
  );
  const [selectedObtains, setSelectedObtains] = React.useState<Set<CharacterObtain>>(
    () => new Set<CharacterObtain>(["ガチャ"])
  );
  const [selectedGachas, setSelectedGachas] = React.useState<Set<CharacterGacha>>(
    () => new Set<CharacterGacha>(["限定"])
  );
  const [selectedOtherCategories, setSelectedOtherCategories] = React.useState<
    Set<CharacterOtherCategory>
  >(() => new Set(OTHER_CATEGORY_OPTIONS));

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

  const normalizedFilter = nameFilter.trim().toLowerCase();

  const visibleCharacterIds = React.useMemo(() => {
    const isAllElementsSelected = ELEMENT_OPTIONS.every((el) => selectedElements.has(el));
    const isAllObtainsSelected = OBTAIN_OPTIONS.every((o) => selectedObtains.has(o));
    const isAllGachasSelected = GACHA_OPTIONS.every((g) => selectedGachas.has(g));
    const isAllOtherCategoriesSelected = OTHER_CATEGORY_OPTIONS.every((o) =>
      selectedOtherCategories.has(o)
    );
    const isYearUnselected = yearFrom === "" && yearTo === "";
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
      const name = c.name.trim().toLowerCase();
      const nameKana = c.nameKana.trim().toLowerCase();
      const isNameMatched =
        !normalizedFilter || name.includes(normalizedFilter) || nameKana.includes(normalizedFilter);
      const isElementMatched = !!c.element && selectedElements.has(c.element);
      const isObtainMatched = !!c.obtain && selectedObtains.has(c.obtain);
      const isSubtypeMatched =
        c.obtain === "ガチャ"
          ? !!c.gachaType && selectedGachas.has(c.gachaType)
          : c.obtain === "その他"
            ? !!c.otherCategory && selectedOtherCategories.has(c.otherCategory)
            : true;
      const implYear = implementationYearFromNumber(c.sortNumber);
      const minYear = yearFrom === "" ? Number.NEGATIVE_INFINITY : yearFrom;
      const maxYear = yearTo === "" ? Number.POSITIVE_INFINITY : yearTo;
      const isYearMatched =
        (yearFrom === "" && yearTo === "") ||
        (implYear !== null && implYear >= minYear && implYear <= maxYear);

      if (isNameMatched && isElementMatched && isObtainMatched && isSubtypeMatched && isYearMatched) {
        ids.add(c.id);
      }
    }
    return ids;
  }, [
    characters,
    normalizedFilter,
    selectedElements,
    selectedObtains,
    selectedGachas,
    selectedOtherCategories,
    yearFrom,
    yearTo,
  ]);

  function toggleElementFilter(element: CharacterElement) {
    setSelectedElements((prev) => {
      const next = new Set(prev);
      if (next.has(element)) {
        next.delete(element);
      } else {
        next.add(element);
      }
      return next;
    });
  }

  function toggleObtainFilter(obtain: CharacterObtain) {
    setSelectedObtains((prev) => {
      const next = new Set(prev);
      if (next.has(obtain)) {
        next.delete(obtain);
      } else {
        next.add(obtain);
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
          selectedElements={selectedElements}
          onToggleElement={toggleElementFilter}
          selectedObtains={selectedObtains}
          onToggleObtain={toggleObtainFilter}
          selectedGachas={selectedGachas}
          onToggleGacha={toggleGachaFilter}
          selectedOtherCategories={selectedOtherCategories}
          onToggleOtherCategory={toggleOtherCategoryFilter}
          onRenameTier={renameTier}
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
          padding: 8px 10px;
          margin: 0;
        }

      `}</style>
    </div>
  );
}
