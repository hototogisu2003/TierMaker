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
import TierBoard from "./TierBoard";
import BoardControls from "./controls/BoardControls";
import {
  BOARD_STORAGE_KEY,
  DEFAULT_RANK_COL_WIDTH,
  readSavedBoards,
  writeSavedBoards,
  type BoardState,
  type SavedBoardRecord,
  type TierMeta,
} from "./boardStorage";

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
} from "@dnd-kit/sortable";

type TierId = string;
type ContainerId = "pool" | TierId;
type SortOrder = "asc" | "desc";
type YearValue = number | "";

type Props = {
  characters: CharacterForUI[];
  shugoju: CharacterForUI[];
  initialTiers: TierId[]; // ["S","A","B","C"]
};

const DEFAULT_NAME_FILTER = "";
const DEFAULT_POOL_SOURCE: PoolSourceType = "character";
const DEFAULT_YEAR: YearValue = "";
const DEFAULT_SORT_ORDER: SortOrder = "desc";
const DEFAULT_ELEMENT_ORDER_ENABLED = true;
const DEFAULT_IS_ALL_ELEMENTS_MODE = true;
const DEFAULT_INCLUDE_UNOBTAINABLE = false;
const DEFAULT_SELECTED_ELEMENTS = new Set<CharacterElement>();
const DEFAULT_SELECTED_OBTAINS = new Set<CharacterObtain>();
const DEFAULT_SELECTED_GACHAS = new Set<CharacterGacha>(["限定"]);
const FORM_OPTIONS: CharacterForm[] = ["進化/神化", "獣神化", "獣神化改", "真獣神化"];
const CONTENT_OPTIONS: CharacterContent[] = ["破界の星墓", "天魔の孤城", "禁忌の獄"];
const DEFAULT_SELECTED_FORMS = new Set<CharacterForm>();
const DEFAULT_SELECTED_CONTENTS = new Set<CharacterContent>();
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

function buildInitialState(characters: CharacterForUI[], initialTiers: TierId[]): BoardState {
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

function normalizeBoardState(
  persisted: Partial<BoardState> | null | undefined,
  characters: CharacterForUI[],
  initialTiers: TierId[]
): BoardState {
  const fallback = buildInitialState(characters, initialTiers);
  if (!persisted || !Array.isArray(persisted.tierMeta) || typeof persisted.containers !== "object") {
    return fallback;
  }

  const tierMeta = persisted.tierMeta
    .filter(
      (tier): tier is TierMeta =>
        !!tier &&
        typeof tier.id === "string" &&
        typeof tier.name === "string" &&
        typeof tier.color === "string"
    )
    .map((tier) => ({
      id: tier.id,
      name: tier.name,
      color: tier.color,
    }));

  if (tierMeta.length === 0) {
    return fallback;
  }

  const validIds = new Set(characters.filter((c) => !c.isLocalUpload).map((c) => c.id));
  const legacyCharacterIdMap = new Map<string, string>();
  for (const character of characters) {
    if (character.isLocalUpload || character.sourceType !== "character") continue;
    const legacyId = character.id.replace(/^character:/, "");
    if (!legacyCharacterIdMap.has(legacyId)) {
      legacyCharacterIdMap.set(legacyId, character.id);
    }
  }
  const seen = new Set<string>();
  const normalizedContainers: Record<string, string[]> = {};

  const appendIds = (source: unknown): string[] => {
    if (!Array.isArray(source)) return [];
    const next: string[] = [];
    for (const item of source) {
      if (typeof item !== "string") continue;
      const normalizedId = validIds.has(item)
        ? item
        : legacyCharacterIdMap.get(item) ?? null;
      if (!normalizedId || seen.has(normalizedId)) continue;
      seen.add(normalizedId);
      next.push(normalizedId);
    }
    return next;
  };

  normalizedContainers.pool = appendIds(persisted.containers?.pool);
  for (const tier of tierMeta) {
    normalizedContainers[tier.id] = appendIds(persisted.containers?.[tier.id]);
  }

  for (const character of characters) {
    if (character.isLocalUpload) continue;
    if (seen.has(character.id)) continue;
    normalizedContainers.pool.push(character.id);
    seen.add(character.id);
  }

  return {
    tierMeta,
    containers: normalizedContainers,
  };
}

function findContainerOfItem(containers: Record<string, string[]>, itemId: string): string | null {
  for (const [cid, items] of Object.entries(containers)) {
    if (items.includes(itemId)) return cid;
  }
  return null;
}

export default function TierMaker({ characters, shugoju, initialTiers }: Props) {
  const boardRef = React.useRef<HTMLDivElement | null>(null);
  const localUploadUrlsRef = React.useRef<string[]>([]);
  const hasLoadedPersistedBoardRef = React.useRef(false);
  const [localCharacters, setLocalCharacters] = React.useState<CharacterForUI[]>([]);
  const allCharacters = React.useMemo(
    () => [...characters, ...shugoju, ...localCharacters],
    [characters, shugoju, localCharacters]
  );

  const [{ tierMeta, containers }, setState] = React.useState(() =>
    buildInitialState(allCharacters, initialTiers)
  );

  // Active dragging item id
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [rankColWidth, setRankColWidth] = React.useState(DEFAULT_RANK_COL_WIDTH);
  const [boardTitle, setBoardTitle] = React.useState("");
  const [savedBoardId, setSavedBoardId] = React.useState<string | null>(null);
  const [nameFilter, setNameFilter] = React.useState(DEFAULT_NAME_FILTER);
  const [selectedPoolSource, setSelectedPoolSource] =
    React.useState<PoolSourceType>(DEFAULT_POOL_SOURCE);
  const [includeUnobtainable, setIncludeUnobtainable] = React.useState(
    DEFAULT_INCLUDE_UNOBTAINABLE
  );
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
  const [selectedForms, setSelectedForms] = React.useState<Set<CharacterForm>>(
    () => new Set<CharacterForm>(DEFAULT_SELECTED_FORMS)
  );
  const [selectedContents, setSelectedContents] = React.useState<Set<CharacterContent>>(
    () => new Set<CharacterContent>(DEFAULT_SELECTED_CONTENTS)
  );
  const [selectedOtherCategories, setSelectedOtherCategories] = React.useState<
    Set<CharacterOtherCategory>
  >(() => new Set<CharacterOtherCategory>(DEFAULT_SELECTED_OTHER_CATEGORIES));
  const [appliedNameFilter, setAppliedNameFilter] = React.useState(DEFAULT_NAME_FILTER);
  const [appliedPoolSource, setAppliedPoolSource] =
    React.useState<PoolSourceType>(DEFAULT_POOL_SOURCE);
  const [appliedIncludeUnobtainable, setAppliedIncludeUnobtainable] = React.useState(
    DEFAULT_INCLUDE_UNOBTAINABLE
  );
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
  const [appliedSelectedForms, setAppliedSelectedForms] = React.useState<Set<CharacterForm>>(
    () => new Set<CharacterForm>(DEFAULT_SELECTED_FORMS)
  );
  const [appliedSelectedContents, setAppliedSelectedContents] = React.useState<
    Set<CharacterContent>
  >(() => new Set<CharacterContent>(DEFAULT_SELECTED_CONTENTS));
  const [appliedSelectedOtherCategories, setAppliedSelectedOtherCategories] = React.useState<
    Set<CharacterOtherCategory>
  >(() => new Set<CharacterOtherCategory>(DEFAULT_SELECTED_OTHER_CATEGORIES));
  const [hasAppliedFiltersOnce, setHasAppliedFiltersOnce] = React.useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const characterById = React.useMemo(() => {
    const m = new Map<string, CharacterForUI>();
    for (const c of allCharacters) m.set(c.id, c);
    return m;
  }, [allCharacters]);

  React.useEffect(() => {
    return () => {
      for (const url of localUploadUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  React.useEffect(() => {
    if (hasLoadedPersistedBoardRef.current) return;
    hasLoadedPersistedBoardRef.current = true;

    try {
      const raw = window.localStorage.getItem(BOARD_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<BoardState & { rankColWidth?: number; savedBoardId?: string }>;
      const normalized = normalizeBoardState(parsed, allCharacters, initialTiers);
      setState(normalized);
      if (typeof parsed.boardTitle === "string") {
        setBoardTitle(parsed.boardTitle);
      }
      if (typeof parsed.savedBoardId === "string") {
        setSavedBoardId(parsed.savedBoardId);
      }
      if (typeof parsed.rankColWidth === "number" && Number.isFinite(parsed.rankColWidth)) {
        setRankColWidth(Math.max(56, Math.min(180, parsed.rankColWidth)));
      }
    } catch {
      // Ignore malformed localStorage data and use defaults.
    }
  }, [allCharacters, initialTiers]);

  React.useEffect(() => {
    if (!hasLoadedPersistedBoardRef.current) return;

    try {
      const persistable = normalizeBoardState({ tierMeta, containers }, allCharacters, initialTiers);
      window.localStorage.setItem(
        BOARD_STORAGE_KEY,
        JSON.stringify({
          ...persistable,
          boardTitle,
          savedBoardId,
          rankColWidth,
        })
      );
    } catch {
      // Ignore localStorage write failures.
    }
  }, [tierMeta, containers, boardTitle, savedBoardId, rankColWidth, allCharacters, initialTiers]);

  const normalizedFilter = appliedNameFilter.trim().toLowerCase();

  const visibleCharacterIds = React.useMemo(() => {
    if (!hasAppliedFiltersOnce) {
      return new Set<string>();
    }

    if (normalizedFilter) {
      const ids = new Set<string>();
      for (const c of allCharacters) {
        if (c.sourceType !== appliedPoolSource) continue;
        if (appliedPoolSource === "character" && !appliedIncludeUnobtainable && !c.isObtainable) {
          continue;
        }
        const name = c.name.trim().toLowerCase();
        const nameKana = c.nameKana.trim().toLowerCase();
        if (name.includes(normalizedFilter) || nameKana.includes(normalizedFilter)) {
          ids.add(c.id);
        }
      }
      return ids;
    }

    if (appliedPoolSource === "shugoju") {
      const ids = new Set<string>();
      for (const c of allCharacters) {
        if (c.sourceType === "shugoju") {
          ids.add(c.id);
        }
      }
      return ids;
    }

    const isAllElementsSelected = appliedIsAllElementsMode;

    const ids = new Set<string>();
    for (const c of allCharacters) {
      if (c.sourceType !== "character") continue;
      if (!appliedIncludeUnobtainable && !c.isObtainable) continue;
      const isElementMatched =
        appliedIsAllElementsMode || (!!c.element && appliedSelectedElements.has(c.element));
      const isObtainMatched =
        appliedSelectedObtains.size === 0 ||
        (!!c.obtain && appliedSelectedObtains.has(c.obtain));
      const isFormMatched =
        appliedSelectedForms.size === 0 ||
        (!!c.formType && appliedSelectedForms.has(c.formType));
      const isContentMatched =
        appliedSelectedContents.size === 0 ||
        (!!c.contentType && appliedSelectedContents.has(c.contentType));
      const isSubtypeMatched =
        appliedSelectedObtains.size === 0
          ? true
          : c.obtain === "ガチャ"
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

      if (
        isElementMatched &&
        isObtainMatched &&
        isFormMatched &&
        isContentMatched &&
        isSubtypeMatched &&
        isYearMatched
      ) {
        ids.add(c.id);
      }
    }
    return ids;
  }, [
    allCharacters,
    hasAppliedFiltersOnce,
    normalizedFilter,
    appliedPoolSource,
    appliedIncludeUnobtainable,
    appliedSelectedElements,
    appliedIsAllElementsMode,
    appliedSelectedObtains,
    appliedSelectedGachas,
    appliedSelectedForms,
    appliedSelectedContents,
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
          setSelectedOtherCategories(new Set<CharacterOtherCategory>());
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

  function toggleFormFilter(form: CharacterForm) {
    setSelectedForms((prev) => {
      const next = new Set(prev);
      if (next.has(form)) {
        next.delete(form);
      } else {
        next.add(form);
      }
      return next;
    });
  }

  function toggleContentFilter(content: CharacterContent) {
    setSelectedContents((prev) => {
      const next = new Set(prev);
      if (next.has(content)) {
        next.delete(content);
      } else {
        next.add(content);
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
    setHasAppliedFiltersOnce(true);
    setAppliedNameFilter(nameFilter);
    setAppliedPoolSource(selectedPoolSource);
    setAppliedIncludeUnobtainable(includeUnobtainable);
    setAppliedYearFrom(yearFrom);
    setAppliedYearTo(yearTo);
    setAppliedSortOrder(sortOrder);
    setAppliedIsElementOrderEnabled(
      selectedPoolSource === "shugoju" ? false : isElementOrderEnabled
    );
    setAppliedIsAllElementsMode(isAllElementsMode);
    setAppliedSelectedElements(new Set(selectedElements));
    setAppliedSelectedObtains(new Set(selectedObtains));
    setAppliedSelectedGachas(
      selectedObtains.has("ガチャ")
        ? new Set(selectedGachas)
        : new Set<CharacterGacha>()
    );
    setAppliedSelectedForms(new Set(selectedForms));
    setAppliedSelectedContents(new Set(selectedContents));
    setAppliedSelectedOtherCategories(
      selectedObtains.has("降臨")
        ? new Set(selectedOtherCategories)
        : new Set<CharacterOtherCategory>()
    );
  }

  function resetFilters() {
    setHasAppliedFiltersOnce(false);
    setNameFilter(DEFAULT_NAME_FILTER);
    setSelectedPoolSource(DEFAULT_POOL_SOURCE);
    setIncludeUnobtainable(DEFAULT_INCLUDE_UNOBTAINABLE);
    setYearFrom(DEFAULT_YEAR);
    setYearTo(DEFAULT_YEAR);
    setSortOrder(DEFAULT_SORT_ORDER);
    setIsElementOrderEnabled(DEFAULT_ELEMENT_ORDER_ENABLED);
    setIsAllElementsMode(DEFAULT_IS_ALL_ELEMENTS_MODE);
    setSelectedElements(new Set<CharacterElement>(DEFAULT_SELECTED_ELEMENTS));
    setSelectedObtains(new Set<CharacterObtain>(DEFAULT_SELECTED_OBTAINS));
    setSelectedGachas(new Set<CharacterGacha>(DEFAULT_SELECTED_GACHAS));
    setSelectedForms(new Set<CharacterForm>(DEFAULT_SELECTED_FORMS));
    setSelectedContents(new Set<CharacterContent>(DEFAULT_SELECTED_CONTENTS));
    setSelectedOtherCategories(new Set<CharacterOtherCategory>(DEFAULT_SELECTED_OTHER_CATEGORIES));

    setAppliedNameFilter(DEFAULT_NAME_FILTER);
    setAppliedPoolSource(DEFAULT_POOL_SOURCE);
    setAppliedIncludeUnobtainable(DEFAULT_INCLUDE_UNOBTAINABLE);
    setAppliedYearFrom(DEFAULT_YEAR);
    setAppliedYearTo(DEFAULT_YEAR);
    setAppliedSortOrder(DEFAULT_SORT_ORDER);
    setAppliedIsElementOrderEnabled(DEFAULT_ELEMENT_ORDER_ENABLED);
    setAppliedIsAllElementsMode(DEFAULT_IS_ALL_ELEMENTS_MODE);
    setAppliedSelectedElements(new Set<CharacterElement>(DEFAULT_SELECTED_ELEMENTS));
    setAppliedSelectedObtains(new Set<CharacterObtain>(DEFAULT_SELECTED_OBTAINS));
    setAppliedSelectedGachas(new Set<CharacterGacha>(DEFAULT_SELECTED_GACHAS));
    setAppliedSelectedForms(new Set<CharacterForm>(DEFAULT_SELECTED_FORMS));
    setAppliedSelectedContents(new Set<CharacterContent>(DEFAULT_SELECTED_CONTENTS));
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
    setSavedBoardId(null);
    setBoardTitle("");
    setNameFilter(DEFAULT_NAME_FILTER);
    setAppliedNameFilter(DEFAULT_NAME_FILTER);
    setHasAppliedFiltersOnce(false);
    setState(buildInitialState(allCharacters, initialTiers));
  }

  function saveBoard() {
    const title = boardTitle.trim();
    if (!title) {
      window.alert("タイトルを入力してください。");
      return;
    }

    const hasLocalUploads =
      localCharacters.length > 0 &&
      Object.values(containers).some((ids) =>
        ids.some((id) => characterById.get(id)?.isLocalUpload)
      );

    if (hasLocalUploads) {
      window.alert("ローカルアップロード画像は保存対象に含まれません。");
    }

    const persistable = normalizeBoardState({ tierMeta, containers }, allCharacters, initialTiers);
    const nextId = savedBoardId ?? `saved-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const savedBoards = readSavedBoards();
    const previousRecord = savedBoardId
      ? savedBoards.find((record) => record.id === savedBoardId) ?? null
      : null;
    const nextRecord: SavedBoardRecord = {
      id: nextId,
      title,
      createdAt: previousRecord?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      board: {
        ...persistable,
        boardTitle: title,
        savedBoardId: nextId,
        rankColWidth,
      },
    };

    const nextBoards = savedBoardId
      ? [...savedBoards.filter((record) => record.id !== savedBoardId), nextRecord]
      : [nextRecord, ...savedBoards];
    writeSavedBoards(nextBoards);
    setSavedBoardId(nextId);
    window.alert(savedBoardId ? "表を上書き保存しました。" : "表を保存しました。");
  }

  function uploadLocalImages(files: FileList | File[]) {
    const fileArray = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (fileArray.length === 0) return;

    const uploadedCharacters = fileArray.map((file, index) => {
      const objectUrl = URL.createObjectURL(file);
      localUploadUrlsRef.current.push(objectUrl);
      const fileName = file.name.replace(/\.[^.]+$/, "") || `upload-${Date.now()}-${index + 1}`;

      return {
        id: `local-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
        name: fileName,
        nameKana: fileName,
        element: "",
        obtain: "",
        gachaType: "",
        formType: "",
        contentType: "",
        otherCategory: "",
        isObtainable: true,
        sortNumber: Number.POSITIVE_INFINITY,
        iconPath: file.name,
        iconUrl: objectUrl,
        sourceType: selectedPoolSource,
        isLocalUpload: true,
      } satisfies CharacterForUI;
    });

    setLocalCharacters((prev) => [...prev, ...uploadedCharacters]);
    setState((prev) => ({
      ...prev,
      containers: {
        ...prev.containers,
        pool: [...prev.containers.pool, ...uploadedCharacters.map((character) => character.id)],
      },
    }));
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
    // Keep drag-over state calculation inside dnd-kit only.
    // We intentionally avoid mutating containers here because doing so while the
    // pool is virtualized can unmount sortable DOM nodes mid-drag and trigger
    // client-side exceptions.
    void e;
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

      if (activeContainer === overContainer) {
        if (activeContainer === "pool") {
          return prev;
        }
        if (!overIsContainer) {
          const items = next.containers[activeContainer];
          const oldIndex = items.indexOf(active);
          const newIndex = items.indexOf(over);
          if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
            next.containers[activeContainer] = arrayMove(items, oldIndex, newIndex);
          }
        }
        return next;
      }

      const fromItems = next.containers[activeContainer];
      const fromIndex = fromItems.indexOf(active);
      if (fromIndex === -1) return prev;
      fromItems.splice(fromIndex, 1);

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

  const activeCharacter = activeId ? characterById.get(activeId) ?? null : null;
  return (
    <div className="stack">
      <div className="controlsBand">
        <BoardControls
          onSave={saveBoard}
          onReset={resetBoard}
          exportTargetRef={boardRef}
          exportTitle={boardTitle}
        />
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
          boardTitle={boardTitle}
          onBoardTitleChange={setBoardTitle}
          tierMeta={tierMeta}
          containers={containers}
          charactersById={characterById}
          visibleCharacterIds={visibleCharacterIds}
          nameFilter={nameFilter}
          onNameFilterChange={setNameFilter}
          selectedPoolSource={selectedPoolSource}
          onPoolSourceChange={setSelectedPoolSource}
          includeUnobtainable={includeUnobtainable}
          onIncludeUnobtainableChange={setIncludeUnobtainable}
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
          selectedForms={selectedForms}
          onToggleForm={toggleFormFilter}
          selectedContents={selectedContents}
          onToggleContent={toggleContentFilter}
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
          onUploadLocalImages={uploadLocalImages}
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
