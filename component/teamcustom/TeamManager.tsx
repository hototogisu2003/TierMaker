"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toPng } from "html-to-image";
import styles from "./TeamManager.module.css";
import { fetchCharactersAndQuests } from "@/lib/teamcustom/supabase";
import { deleteTeam, getArrangeIds, listTeams, putTeam, setArrangeIds as persistArrangeIds } from "@/lib/teamcustom/indexeddb";
import { CREST_OPTIONS, FRUIT_OPTIONS } from "@/lib/teamcustom/options";
import type { CharacterItem, QuestItem, TeamRecord, TeamSlot } from "@/lib/teamcustom/types";

type Tab = "memo" | "view" | "arrange";
type FruitFilter = "status" | "other";
type SortOrder = "asc" | "desc";
type YearValue = number | "";

type DraftSlot = {
  slotIndex: number;
  characterId: string;
  fruits: string[];
  crests: string[];
};

const ELEMENT_OPTIONS = ["火", "水", "木", "光", "闇"] as const;
const OBTAIN_OPTIONS = ["ガチャ", "降臨", "コラボパック"] as const;
const GACHA_OPTIONS = ["限定", "α", "恒常", "コラボ"] as const;
const FORM_OPTIONS = ["進化/神化", "獣神化", "獣神化改", "真獣神化"] as const;
const OTHER_CATEGORY_OPTIONS = ["黎絶", "轟絶", "爆絶", "超絶", "超究極", "コラボ", "その他"] as const;
const YEAR_OPTIONS: number[] = [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018];
const SLOT_LABELS = ["1st", "2nd", "3rd", "4th"] as const;
const ELEMENT_HEADER_COLOR: Record<NonNullable<CharacterItem["element"]>, string> = {
  火: "#f4a3a3",
  水: "#bfe8ff",
  木: "#c9efb4",
  光: "#fff2a8",
  闇: "#d6b2d7",
  "": "#ffffff",
};
const ELEMENT_ICON_MAP: Record<"all" | (typeof ELEMENT_OPTIONS)[number], { src: string; alt: string }> = {
  all: { src: "/icon/icon_全.avif", alt: "全属性" },
  火: { src: "/icon/icon_火.png", alt: "火属性" },
  水: { src: "/icon/icon_水.png", alt: "水属性" },
  木: { src: "/icon/icon_木.png", alt: "木属性" },
  光: { src: "/icon/icon_光.png", alt: "光属性" },
  闇: { src: "/icon/icon_闇.png", alt: "闇属性" },
};

function emptySlots(): DraftSlot[] {
  return [0, 1, 2, 3].map((slotIndex) => ({ slotIndex, characterId: "", fruits: [], crests: [] }));
}

function defaultObtains(): Set<CharacterItem["obtain"]> {
  return new Set(OBTAIN_OPTIONS);
}

function defaultGachas(): Set<CharacterItem["gachaType"]> {
  return new Set(GACHA_OPTIONS);
}

function defaultOtherCategories(): Set<CharacterItem["otherCategory"]> {
  return new Set(OTHER_CATEGORY_OPTIONS);
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowText(): string {
  return new Date().toISOString();
}

function formatDate(iso: string): string {
  const dt = new Date(iso);
  return `${dt.getFullYear()}/${String(dt.getMonth() + 1).padStart(2, "0")}/${String(dt.getDate()).padStart(2, "0")} ${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
}

function filenameDateText(date: Date): string {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}_${String(date.getHours()).padStart(2, "0")}${String(date.getMinutes()).padStart(2, "0")}`;
}

function moveItem<T>(arr: T[], from: number, to: number): T[] {
  const copy = arr.slice();
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

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

export default function TeamManager({ mode }: { mode: Tab }) {
  const tab = mode;
  const router = useRouter();
  const [editQueryId, setEditQueryId] = useState<string | null>(null);
  const [autoEditAppliedId, setAutoEditAppliedId] = useState<string | null>(null);
  const [characters, setCharacters] = useState<CharacterItem[]>([]);
  const [quests, setQuests] = useState<QuestItem[]>([]);
  const [records, setRecords] = useState<TeamRecord[]>([]);
  const [activeSlotIndex, setActiveSlotIndex] = useState(0);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [questId, setQuestId] = useState("");
  const [questKeyword, setQuestKeyword] = useState("");
  const [hasQuestSearched, setHasQuestSearched] = useState(false);
  const [memoText, setMemoText] = useState("");
  const [slots, setSlots] = useState<DraftSlot[]>(emptySlots());
  const [message, setMessage] = useState("");
  const [fruitFilter, setFruitFilter] = useState<FruitFilter>("status");

  const [nameFilter, setNameFilter] = useState("");
  const [includeUnobtainable, setIncludeUnobtainable] = useState(false);
  const [yearFrom, setYearFrom] = useState<YearValue>("");
  const [yearTo, setYearTo] = useState<YearValue>("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [isElementOrderEnabled, setIsElementOrderEnabled] = useState(true);
  const [isAllElementsMode, setIsAllElementsMode] = useState(true);
  const [selectedElements, setSelectedElements] = useState<Set<CharacterItem["element"]>>(() => new Set());
  const [selectedObtains, setSelectedObtains] = useState<Set<CharacterItem["obtain"]>>(() => defaultObtains());
  const [selectedGachas, setSelectedGachas] = useState<Set<CharacterItem["gachaType"]>>(() => defaultGachas());
  const [selectedForms, setSelectedForms] = useState<Set<CharacterItem["formType"]>>(() => new Set(FORM_OPTIONS));
  const [selectedOtherCategories, setSelectedOtherCategories] = useState<Set<CharacterItem["otherCategory"]>>(() => defaultOtherCategories());

  const [appliedNameFilter, setAppliedNameFilter] = useState("");
  const [appliedIncludeUnobtainable, setAppliedIncludeUnobtainable] = useState(false);
  const [appliedYearFrom, setAppliedYearFrom] = useState<YearValue>("");
  const [appliedYearTo, setAppliedYearTo] = useState<YearValue>("");
  const [appliedSortOrder, setAppliedSortOrder] = useState<SortOrder>("desc");
  const [appliedIsElementOrderEnabled, setAppliedIsElementOrderEnabled] = useState(true);
  const [appliedIsAllElementsMode, setAppliedIsAllElementsMode] = useState(true);
  const [appliedSelectedElements, setAppliedSelectedElements] = useState<Set<CharacterItem["element"]>>(() => new Set());
  const [appliedSelectedObtains, setAppliedSelectedObtains] = useState<Set<CharacterItem["obtain"]>>(() => defaultObtains());
  const [appliedSelectedGachas, setAppliedSelectedGachas] = useState<Set<CharacterItem["gachaType"]>>(() => defaultGachas());
  const [appliedSelectedForms, setAppliedSelectedForms] = useState<Set<CharacterItem["formType"]>>(() => new Set(FORM_OPTIONS));
  const [appliedSelectedOtherCategories, setAppliedSelectedOtherCategories] = useState<Set<CharacterItem["otherCategory"]>>(() => defaultOtherCategories());
  const [hasSearched, setHasSearched] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [mobileEditSlotIndex, setMobileEditSlotIndex] = useState<number | null>(null);
  const [arrangeIds, setArrangeIds] = useState<string[]>([]);
  const [arrangeCandidateId, setArrangeCandidateId] = useState("");
  const [arrangeRemoveId, setArrangeRemoveId] = useState("");
  const [isArrangeAddOpen, setIsArrangeAddOpen] = useState(false);
  const [isArrangeRemoveOpen, setIsArrangeRemoveOpen] = useState(false);
  const [isArrangeLoaded, setIsArrangeLoaded] = useState(false);

  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchCharactersAndQuests()
      .then((res) => {
        setCharacters(res.characters);
        setQuests(res.quests);
        if (res.questLoadError) {
          setMessage(`対象クエストの読み込みに失敗しました: ${res.questLoadError}`);
        }
      })
      .catch((error) => {
        setMessage(error instanceof Error ? error.message : "データ取得に失敗しました");
      });
  }, []);

  async function refreshRecords() {
    const rows = await listTeams();
    setRecords(rows);
  }

  useEffect(() => {
    refreshRecords().catch(() => setMessage("IndexedDBの読み込みに失敗しました"));
  }, []);
  useEffect(() => {
    getArrangeIds()
      .then((ids) => setArrangeIds(ids))
      .catch(() => setMessage("並べる画面の設定読み込みに失敗しました"))
      .finally(() => setIsArrangeLoaded(true));
  }, []);
  useEffect(() => {
    setArrangeIds((prev) => prev.filter((id) => records.some((r) => r.id === id)));
  }, [records]);
  useEffect(() => {
    if (tab !== "memo") return;
    const value = new URLSearchParams(window.location.search).get("edit");
    setEditQueryId(value);
  }, [tab]);
  useEffect(() => {
    if (tab !== "memo" || !editQueryId || autoEditAppliedId === editQueryId) return;
    const record = records.find((r) => r.id === editQueryId);
    if (!record) return;
    fillFromRecord(record);
    setAutoEditAppliedId(editQueryId);
  }, [tab, editQueryId, autoEditAppliedId, records]);
  useEffect(() => {
    if (!isArrangeLoaded) return;
    persistArrangeIds(arrangeIds).catch(() => setMessage("並べる画面の設定保存に失敗しました"));
  }, [arrangeIds, isArrangeLoaded]);

  const charMap = useMemo(() => {
    const map = new Map<string, CharacterItem>();
    for (const c of characters) map.set(c.id, c);
    return map;
  }, [characters]);

  const selectedQuest = useMemo(() => quests.find((q) => q.id === questId) ?? null, [quests, questId]);
  const filteredQuests = useMemo(() => {
    if (!hasQuestSearched) return [];
    const keyword = questKeyword.trim().toLowerCase();
    const list = keyword
      ? quests.filter((q) => q.name.toLowerCase().includes(keyword) || q.nameKana.toLowerCase().includes(keyword))
      : quests;
    return list.slice(0, 100);
  }, [quests, questKeyword, hasQuestSearched]);
  const arrangedRecords = useMemo(
    () => arrangeIds.map((id) => records.find((r) => r.id === id)).filter((x): x is TeamRecord => Boolean(x)),
    [arrangeIds, records]
  );
  const availableArrangeRecords = useMemo(
    () => records.filter((r) => !arrangeIds.includes(r.id)),
    [records, arrangeIds]
  );

  const filteredFruitOptions = useMemo(
    () => FRUIT_OPTIONS.filter((option) => (fruitFilter === "status" ? option.isStatus : !option.isStatus)),
    [fruitFilter]
  );
  const fruitOrderMap = useMemo(
    () => new Map(FRUIT_OPTIONS.map((option) => [option.name, option.id])),
    []
  );
  const crestOrderMap = useMemo<Map<string, number>>(
    () => new Map<string, number>(CREST_OPTIONS.map((option, index) => [option, index + 1])),
    []
  );

  const filteredCharacters = useMemo(() => {
    if (!hasSearched) return [];

    const normalizedFilter = appliedNameFilter.trim().toLowerCase();
    const elementIndex = new Map<CharacterItem["element"], number>(ELEMENT_OPTIONS.map((v, i) => [v, i]));

    const list = characters.filter((c) => {
      if (!appliedIncludeUnobtainable && !c.isObtainable) return false;

      if (normalizedFilter) {
        const name = c.name.toLowerCase();
        const kana = c.nameKana.toLowerCase();
        return name.includes(normalizedFilter) || kana.includes(normalizedFilter);
      }

      const isElementMatched = appliedIsAllElementsMode || (!!c.element && appliedSelectedElements.has(c.element));
      const isObtainMatched = appliedSelectedObtains.size === 0 || !c.obtain || appliedSelectedObtains.has(c.obtain);
      const isFormMatched = FORM_OPTIONS.every((v) => appliedSelectedForms.has(v)) || (!!c.formType && appliedSelectedForms.has(c.formType));
      const isSubtypeMatched =
        c.obtain === "ガチャ"
          ? appliedSelectedGachas.size === 0 || !c.gachaType || appliedSelectedGachas.has(c.gachaType)
          : c.obtain === "降臨"
            ? appliedSelectedOtherCategories.size === 0 || !c.otherCategory || appliedSelectedOtherCategories.has(c.otherCategory)
            : true;

      const implYear = implementationYearFromNumber(c.sortNumber);
      const minYear = appliedYearFrom === "" ? Number.NEGATIVE_INFINITY : appliedYearFrom;
      const maxYear = appliedYearTo === "" ? Number.POSITIVE_INFINITY : appliedYearTo;
      const isYearMatched =
        (appliedYearFrom === "" && appliedYearTo === "") || (implYear !== null && implYear >= minYear && implYear <= maxYear);

      return isElementMatched && isObtainMatched && isFormMatched && isSubtypeMatched && isYearMatched;
    });

    list.sort((a, b) => {
      if (appliedIsElementOrderEnabled) {
        const ea = a.element ? (elementIndex.get(a.element) ?? Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY;
        const eb = b.element ? (elementIndex.get(b.element) ?? Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY;
        if (ea !== eb) return ea - eb;
      }
      return appliedSortOrder === "asc" ? a.sortNumber - b.sortNumber : b.sortNumber - a.sortNumber;
    });

    return list;
  }, [
    hasSearched,
    appliedNameFilter,
    characters,
    appliedIncludeUnobtainable,
    appliedIsAllElementsMode,
    appliedSelectedElements,
    appliedSelectedObtains,
    appliedSelectedForms,
    appliedSelectedGachas,
    appliedSelectedOtherCategories,
    appliedYearFrom,
    appliedYearTo,
    appliedSortOrder,
    appliedIsElementOrderEnabled,
  ]);

  function applyFilters() {
    setAppliedNameFilter(nameFilter);
    setAppliedIncludeUnobtainable(includeUnobtainable);
    setAppliedYearFrom(yearFrom);
    setAppliedYearTo(yearTo);
    setAppliedSortOrder(sortOrder);
    setAppliedIsElementOrderEnabled(isElementOrderEnabled);
    setAppliedIsAllElementsMode(isAllElementsMode);
    setAppliedSelectedElements(new Set(selectedElements));
    setAppliedSelectedObtains(new Set(selectedObtains));
    setAppliedSelectedGachas(selectedObtains.has("ガチャ") ? new Set(selectedGachas) : new Set());
    setAppliedSelectedForms(new Set(selectedForms));
    setAppliedSelectedOtherCategories(selectedObtains.has("降臨") ? new Set(selectedOtherCategories) : new Set());
    setHasSearched(true);
  }

  function resetFilters() {
    setNameFilter("");
    setIncludeUnobtainable(false);
    setYearFrom("");
    setYearTo("");
    setSortOrder("desc");
    setIsElementOrderEnabled(true);
    setIsAllElementsMode(true);
    setSelectedElements(new Set());
    setSelectedObtains(defaultObtains());
    setSelectedGachas(defaultGachas());
    setSelectedForms(new Set(FORM_OPTIONS));
    setSelectedOtherCategories(defaultOtherCategories());

    setAppliedNameFilter("");
    setAppliedIncludeUnobtainable(false);
    setAppliedYearFrom("");
    setAppliedYearTo("");
    setAppliedSortOrder("desc");
    setAppliedIsElementOrderEnabled(true);
    setAppliedIsAllElementsMode(true);
    setAppliedSelectedElements(new Set());
    setAppliedSelectedObtains(defaultObtains());
    setAppliedSelectedGachas(defaultGachas());
    setAppliedSelectedForms(new Set(FORM_OPTIONS));
    setAppliedSelectedOtherCategories(defaultOtherCategories());
    setHasSearched(false);
  }

  function toggleElementFilter(element: CharacterItem["element"]) {
    if (!element) return;
    setSelectedElements((prev) => {
      const next = new Set(prev);
      if (next.has(element)) next.delete(element);
      else next.add(element);
      setIsAllElementsMode(next.size === 0);
      return next;
    });
  }

  function selectAllElements() {
    setIsAllElementsMode(true);
    setSelectedElements(new Set());
  }

  function toggleObtainFilter(obtain: CharacterItem["obtain"]) {
    if (!obtain) return;
    setSelectedObtains((prev) => {
      const next = new Set(prev);
      if (next.has(obtain)) {
        next.delete(obtain);
        if (obtain === "ガチャ") setSelectedGachas(new Set());
        if (obtain === "降臨") setSelectedOtherCategories(new Set());
      } else {
        next.add(obtain);
        if (obtain === "ガチャ") setSelectedGachas(new Set(["限定"]));
      }
      return next;
    });
  }

  function toggleGachaFilter(gacha: CharacterItem["gachaType"]) {
    if (!gacha) return;
    setSelectedGachas((prev) => {
      const next = new Set(prev);
      if (next.has(gacha)) next.delete(gacha);
      else next.add(gacha);
      return next;
    });
  }

  function toggleFormFilter(form: CharacterItem["formType"]) {
    if (!form) return;
    setSelectedForms((prev) => {
      const next = new Set(prev);
      if (next.has(form)) next.delete(form);
      else next.add(form);
      return next;
    });
  }

  function toggleOtherCategoryFilter(category: CharacterItem["otherCategory"]) {
    if (!category) return;
    setSelectedOtherCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }

  function updateSlot(slotIndex: number, patch: Partial<DraftSlot>) {
    setSlots((prev) => prev.map((slot) => (slot.slotIndex === slotIndex ? { ...slot, ...patch } : slot)));
  }

  function toggleOption(slotIndex: number, kind: "fruits" | "crests", value: string, max: number) {
    setSlots((prev) =>
      prev.map((slot) => {
        if (slot.slotIndex !== slotIndex) return slot;
        const current = slot[kind];
        const exists = current.includes(value);
        if (exists) return { ...slot, [kind]: current.filter((v) => v !== value) };
        if (current.length >= max) return slot;
        const next = [...current, value];
        if (kind === "fruits") {
          next.sort((a, b) => (fruitOrderMap.get(a) ?? Number.POSITIVE_INFINITY) - (fruitOrderMap.get(b) ?? Number.POSITIVE_INFINITY));
        } else {
          next.sort((a, b) => (crestOrderMap.get(a) ?? Number.POSITIVE_INFINITY) - (crestOrderMap.get(b) ?? Number.POSITIVE_INFINITY));
        }
        return { ...slot, [kind]: next };
      })
    );
  }

  function resetDraft() {
    setEditingId(null);
    setTitle("");
    setQuestId("");
    setQuestKeyword("");
    setHasQuestSearched(false);
    setMemoText("");
    setSlots(emptySlots());
    setActiveSlotIndex(0);
  }

  function fillFromRecord(record: TeamRecord) {
    setEditingId(record.id);
    setTitle(record.title);
    setQuestId(record.targetQuestId ?? "");
    setQuestKeyword(record.targetQuestName ?? "");
    setHasQuestSearched(false);
    setMemoText(record.memoText ?? "");
    setSlots(
      [0, 1, 2, 3].map((slotIndex) => {
        const found = record.slots.find((slot) => slot.slotIndex === slotIndex);
        return {
          slotIndex,
          characterId: found?.characterId ?? "",
          fruits: found?.fruits ?? [],
          crests: found?.crests ?? [],
        };
      })
    );
  }

  async function saveTeam() {
    const currentEditing = editingId ? records.find((r) => r.id === editingId) : null;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setMessage("タイトルは必須です");
      return;
    }

    const filled = slots.filter((s) => s.characterId);
    if (filled.length === 0) {
      setMessage("空編成は保存できません");
      return;
    }
    if (!editingId && records.length >= 30) {
      setMessage("保存上限(30件)に達しているため保存できません");
      return;
    }

    const finalSlots: TeamSlot[] = slots.map((slot) => {
      const c = charMap.get(slot.characterId);
      return {
        slotIndex: slot.slotIndex,
        characterId: slot.characterId,
        characterName: c?.name ?? "",
        iconUrl: c?.iconUrl ?? "",
        fruits: slot.fruits.slice(0, 4),
        crests: slot.crests.slice(0, 4),
      };
    });

    const nextId = editingId ?? makeId();
    const record: TeamRecord = {
      id: nextId,
      title: trimmedTitle,
      targetQuestId: selectedQuest?.id ?? null,
      targetQuestName: selectedQuest?.name ?? null,
      targetQuestIconUrl: selectedQuest?.iconUrl || null,
      slots: finalSlots,
      memoText,
      createdAt: currentEditing?.createdAt ?? nowText(),
    };

    await putTeam(record);
    await refreshRecords();
    if (!editingId) setEditingId(nextId);
    setMessage(editingId ? "編成を上書き保存しました" : "編成を保存しました");
  }

  async function exportCurrentAsPng() {
    if (!exportRef.current) return;
    try {
      const node = exportRef.current;
      node.style.setProperty("--export-width", "390px");
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
      const url = await toPng(node, { cacheBust: true, pixelRatio: 2 });
      const a = document.createElement("a");
      a.href = url;
      const safeTitle = (title.trim() || "編成タイトル").replace(/[\\/:*?"<>|]/g, "_");
      a.download = `${safeTitle}_${filenameDateText(new Date())}.png`;
      document.body.appendChild(a);
      a.click();
      if (a.parentNode) {
        a.parentNode.removeChild(a);
      }
    } catch {
      setMessage("PNG出力に失敗しました。再読み込み後に再試行してください");
    }
  }

  async function removeRecord(id: string) {
    await deleteTeam(id);
    await refreshRecords();
    setMessage("編成を削除しました");
    if (editingId === id) resetDraft();
  }
  function addArrangeRecord() {
    if (!arrangeCandidateId) return;
    setArrangeIds((prev) => {
      if (prev.includes(arrangeCandidateId) || prev.length >= 15) return prev;
      return [...prev, arrangeCandidateId];
    });
    setArrangeCandidateId("");
    setIsArrangeAddOpen(false);
  }
  function removeArrangeRecord(id: string) {
    if (!id) return;
    setArrangeIds((prev) => prev.filter((v) => v !== id));
    setArrangeRemoveId((prev) => (prev === id ? "" : prev));
    setIsArrangeRemoveOpen(false);
  }

  function openMobileEditor(slotIndex: number) {
    setActiveSlotIndex(slotIndex);
    setMobileEditSlotIndex(slotIndex);
  }

  const editorSlotIndex = mobileEditSlotIndex ?? activeSlotIndex;
  const editorSlot = slots[editorSlotIndex] ?? slots[0];
  const editorCharacter = editorSlot.characterId ? charMap.get(editorSlot.characterId) ?? null : null;
  const isGachaObtainEnabled = selectedObtains.has("ガチャ");
  const isQuestObtainEnabled = selectedObtains.has("降臨");

  const renderEditorPane = (className: string) => (
    <div className={className}>
      <div className={`${styles.label} ${styles.editorHeader}`}>{editorSlotIndex + 1}体目を編集</div>
      {editorCharacter ? (
        <div className={styles.editorSelectedChar}>
          <img className={styles.editorSelectedCharImg} src={editorCharacter.iconUrl} alt={editorCharacter.name} />
          <span>{editorCharacter.name}</span>
        </div>
      ) : null}

      <div className={styles.row}>
        <input
          className={styles.input}
          value={nameFilter}
          onChange={(e) => setNameFilter(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              applyFilters();
            }
          }}
          placeholder="キャラ名検索"
          style={{ minWidth: 240 }}
        />
        <button className={`${styles.btn} ${styles.searchBtn}`} type="button" onClick={applyFilters}>検索</button>
        <button
          className={styles.iconBtn}
          data-open={isFilterOpen ? "1" : "0"}
          type="button"
          aria-label="フィルター"
          title="フィルター"
          onClick={() => setIsFilterOpen((prev) => !prev)}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M3 5h18l-7 8v5l-4 2v-7L3 5z" fill="currentColor" />
          </svg>
        </button>
        <button className={styles.btn} type="button" onClick={resetFilters}>リセット</button>
      </div>

      {hasSearched ? (
        <div className={styles.pickList}>
          {filteredCharacters.map((c) => (
            <button
              key={c.id}
              type="button"
              className={styles.pickItem}
              onClick={() => {
                updateSlot(editorSlotIndex, { characterId: c.id });
                setHasSearched(false);
              }}
            >
              <img className={styles.pickItemImg} src={c.iconUrl} alt={c.name} />
              <span>{c.name}</span>
            </button>
          ))}
          {filteredCharacters.length === 0 ? <div className={styles.helper}>該当キャラがいません</div> : null}
        </div>
      ) : null}

      <div className={styles.filterPanelWrap} data-open={isFilterOpen ? "1" : "0"}>
        <div className={styles.filterPanel}>
          <div className={styles.row}>
            <span className={styles.label}>属性</span>
            <button
              className={styles.elementBtn}
              type="button"
              onClick={selectAllElements}
              data-selected={isAllElementsMode ? "1" : "0"}
              title="全属性"
            >
              <img className={styles.elementIcon} src={ELEMENT_ICON_MAP.all.src} alt={ELEMENT_ICON_MAP.all.alt} />
            </button>
            {ELEMENT_OPTIONS.map((el) => (
              <button
                key={el}
                className={styles.elementBtn}
                type="button"
                onClick={() => toggleElementFilter(el)}
                data-selected={!isAllElementsMode && selectedElements.has(el) ? "1" : "0"}
                title={`${el}属性`}
              >
                <img className={styles.elementIcon} src={ELEMENT_ICON_MAP[el].src} alt={ELEMENT_ICON_MAP[el].alt} />
              </button>
            ))}
          </div>

          <div className={styles.row}>
            <span className={styles.label}>入手方法</span>
            {OBTAIN_OPTIONS.map((ob) => (
              <button
                key={ob}
                className={styles.btn}
                type="button"
                onClick={() => toggleObtainFilter(ob)}
                style={{ background: selectedObtains.has(ob) ? "#e3f0ff" : "#fff" }}
              >
                {ob}
              </button>
            ))}
          </div>

          <div className={styles.row}>
            <span className={styles.label}>ガチャ</span>
            {GACHA_OPTIONS.map((g) => (
              <button
                key={g}
                className={styles.btn}
                type="button"
                disabled={!isGachaObtainEnabled}
                onClick={() => toggleGachaFilter(g)}
                style={{ background: selectedGachas.has(g) ? "#e3f0ff" : "#fff", opacity: isGachaObtainEnabled ? 1 : 0.5 }}
              >
                {g}
              </button>
            ))}
          </div>

          <div className={styles.row}>
            <span className={styles.label}>降臨分類</span>
            {OTHER_CATEGORY_OPTIONS.map((o) => (
              <button
                key={o}
                className={styles.btn}
                type="button"
                disabled={!isQuestObtainEnabled}
                onClick={() => toggleOtherCategoryFilter(o)}
                style={{ background: selectedOtherCategories.has(o) ? "#e3f0ff" : "#fff", opacity: isQuestObtainEnabled ? 1 : 0.5 }}
              >
                {o}
              </button>
            ))}
          </div>

          <div className={styles.row}>
            <span className={styles.label}>形態</span>
            {FORM_OPTIONS.map((f) => (
              <button
                key={f}
                className={styles.btn}
                type="button"
                onClick={() => toggleFormFilter(f)}
                style={{ background: selectedForms.has(f) ? "#e3f0ff" : "#fff" }}
              >
                {f}
              </button>
            ))}
          </div>

          <div className={styles.row}>
            <span className={styles.label}>実装年</span>
            <select className={styles.select} value={yearFrom === "" ? "" : String(yearFrom)} onChange={(e) => setYearFrom(e.target.value ? Number(e.target.value) : "")}>
              <option value="">下限なし</option>
              {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <span>〜</span>
            <select className={styles.select} value={yearTo === "" ? "" : String(yearTo)} onChange={(e) => setYearTo(e.target.value ? Number(e.target.value) : "")}>
              <option value="">上限なし</option>
              {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div className={styles.row}>
            <span className={styles.label}>並び</span>
            <button className={styles.btn} type="button" onClick={() => setSortOrder("desc")} style={{ background: sortOrder === "desc" ? "#e3f0ff" : "#fff" }}>降順</button>
            <button className={styles.btn} type="button" onClick={() => setSortOrder("asc")} style={{ background: sortOrder === "asc" ? "#e3f0ff" : "#fff" }}>昇順</button>
            <label className={styles.helper}>
              <input
                type="checkbox"
                checked={isElementOrderEnabled}
                onChange={(e) => setIsElementOrderEnabled(e.target.checked)}
                style={{ marginRight: 4 }}
              />
              属性順優先
            </label>
          </div>
        </div>
      </div>

      <div>
        <div className={styles.helper} style={{ marginBottom: 6 }}>実 (最大4つ)</div>
        <div className={styles.row} style={{ marginBottom: 8 }}>
          <button
            className={styles.btn}
            type="button"
            style={{ background: fruitFilter === "status" ? "#e3f0ff" : "#fff" }}
            onClick={() => setFruitFilter("status")}
          >
            ステータス強化
          </button>
          <button
            className={styles.btn}
            type="button"
            style={{ background: fruitFilter === "other" ? "#e3f0ff" : "#fff" }}
            onClick={() => setFruitFilter("other")}
          >
            それ以外
          </button>
        </div>
        <div className={`${styles.row} ${styles.optionGrid}`}>
          {filteredFruitOptions.map((option) => (
            <button
              key={option.id}
              className={`${styles.btn} ${styles.optionBtn}`}
              type="button"
              style={{ background: editorSlot.fruits.includes(option.name) ? "#e3f0ff" : "#fff" }}
              onClick={() => toggleOption(editorSlotIndex, "fruits", option.name, 4)}
            >
              {option.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className={styles.helper} style={{ marginBottom: 6 }}>紋章 (最大4つ)</div>
        <div className={`${styles.row} ${styles.optionGrid}`}>
          {CREST_OPTIONS.map((value) => (
            <button
              key={value}
              className={`${styles.btn} ${styles.optionBtn}`}
              type="button"
              style={{ background: editorSlot.crests.includes(value) ? "#e3f0ff" : "#fff" }}
              onClick={() => toggleOption(editorSlotIndex, "crests", value, 4)}
            >
              {value}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <section className={styles.page}>
      <div className={styles.topBand}>
        <div className={styles.topRow}>
          <div className={styles.leftGroup}>
            <div className={styles.menuWrap}>
              <button type="button" className={styles.menuBtn} aria-label="メニュー" onClick={() => setIsMenuOpen((prev) => !prev)}>
                <span />
                <span />
                <span />
              </button>

              {isMenuOpen ? (
                <div className={styles.menuPanel}>
                  <button
                    type="button"
                    className={styles.menuItem}
                    data-active={tab === "memo" ? "1" : "0"}
                    onClick={() => {
                      router.push("/TeamBuild/team");
                      setIsMenuOpen(false);
                    }}
                  >
                    編成をメモする
                  </button>
                  <button
                    type="button"
                    className={styles.menuItem}
                    data-active={tab === "view" ? "1" : "0"}
                    onClick={() => {
                      router.push("/TeamBuild/view");
                      setIsMenuOpen(false);
                    }}
                  >
                    編成を確認する
                  </button>
                  <button
                    type="button"
                    className={styles.menuItem}
                    data-active={tab === "arrange" ? "1" : "0"}
                    onClick={() => {
                      router.push("/TeamBuild/list");
                      setIsMenuOpen(false);
                    }}
                  >
                    編成を並べる
                  </button>
                </div>
              ) : null}
            </div>
            <h1 className={styles.titleText}>モンスト 編成管理ツール</h1>
          </div>
          {tab === "memo" ? (
            <div className={styles.rightGroup}>
              <button className={`${styles.btn} ${styles.primary}`} onClick={() => void saveTeam()}>保存</button>
              <button className={styles.btn} onClick={exportCurrentAsPng}>PNG出力</button>
              <button className={styles.btn} onClick={resetDraft}>入力クリア</button>
            </div>
          ) : null}
        </div>
      </div>

      {message ? <div className={styles.card}>{message}</div> : null}

      {tab === "memo" ? (
        <div className={styles.card} style={{ display: "grid", gap: 14 }}>
          <div className={styles.memoTopForm}>
            <div className={styles.row}>
              <label className={styles.label}>編成タイトル</label>
              <input className={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} style={{ minWidth: 320 }} />
            </div>
            <div className={styles.row}>
              <label className={styles.label}>対象クエスト(任意)</label>
              <div className={styles.questSearchGroup}>
                <input
                  className={styles.input}
                  value={questKeyword}
                  onChange={(e) => setQuestKeyword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      setHasQuestSearched(true);
                    }
                  }}
                  placeholder="クエスト名検索"
                  style={{ minWidth: 220 }}
                />
                <button className={`${styles.btn} ${styles.searchBtn}`} type="button" onClick={() => setHasQuestSearched(true)}>検索</button>
                <button
                  className={styles.btn}
                  type="button"
                  onClick={() => {
                    setQuestId("");
                    setQuestKeyword("");
                    setHasQuestSearched(false);
                  }}
                >
                  未設定
                </button>
                {selectedQuest?.iconUrl ? <img className={styles.icon} src={selectedQuest.iconUrl} alt={selectedQuest.name} style={{ width: 40, height: 40 }} /> : null}
              </div>
            </div>
          </div>
          {hasQuestSearched ? (
            <div className={styles.questPickList}>
              {filteredQuests.map((q) => (
                <button
                  key={q.id}
                  type="button"
                  className={styles.questPickItem}
                  onClick={() => {
                    setQuestId(q.id);
                    setQuestKeyword(q.name);
                    setHasQuestSearched(false);
                  }}
                >
                  {q.iconUrl ? <img className={styles.questPickIcon} src={q.iconUrl} alt={q.name} /> : null}
                  <span>{q.name}</span>
                </button>
              ))}
              {filteredQuests.length === 0 ? <div className={styles.helper}>該当クエストがありません</div> : null}
            </div>
          ) : null}

          <div className={styles.twoCol}>
            <div className={styles.leftPane}>

              <div className={styles.teamSheet}>
                {slots.map((slot) => {
                  const c = slot.characterId ? charMap.get(slot.characterId) : null;
                  const fruitRows = Array.from({ length: 4 }, (_, i) => slot.fruits[i] ?? "");
                  const crestRows = Array.from({ length: 4 }, (_, i) => slot.crests[i] ?? "");

                  return (
                    <button
                      key={slot.slotIndex}
                      type="button"
                      className={styles.teamBlock}
                      data-active={activeSlotIndex === slot.slotIndex ? "1" : "0"}
                      onClick={() => setActiveSlotIndex(slot.slotIndex)}
                    >
                      <div className={styles.teamHeader} style={{ backgroundColor: ELEMENT_HEADER_COLOR[c?.element ?? ""] }}>
                        <div className={styles.teamRank}>{SLOT_LABELS[slot.slotIndex]}</div>
                        <div className={styles.teamNameWrap}>
                          <div className={styles.teamName}>{c?.name || ""}</div>
                          <span
                            className={styles.mobileEditBtn}
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              openMobileEditor(slot.slotIndex);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                e.stopPropagation();
                                openMobileEditor(slot.slotIndex);
                              }
                            }}
                          >
                            編集
                          </span>
                        </div>
                      </div>
                      <div className={styles.teamBody}>
                        <div className={styles.iconCell}>
                          {c?.iconUrl ? (
                            <img className={styles.sheetIcon} src={c.iconUrl} alt={c.name} />
                          ) : (
                            <span className={styles.sheetSelectText}>選択</span>
                          )}
                        </div>
                        <div className={styles.detailTable}>
                          <div className={styles.tableHead}>わくわくの実</div>
                          <div className={styles.tableHead}>紋章</div>
                          {fruitRows.map((fruit, idx) => (
                            <Fragment key={`${slot.slotIndex}-row-${idx}`}>
                              <div className={`${styles.tableCell} ${fruit ? "" : styles.tableCellEmpty}`}>{fruit || "　"}</div>
                              <div className={`${styles.tableCell} ${crestRows[idx] ? "" : styles.tableCellEmpty}`}>{crestRows[idx] || "　"}</div>
                            </Fragment>
                          ))}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

            </div>

            {renderEditorPane(styles.rightPane)}
          </div>
          <div>
            <textarea
              className={styles.memoTextarea}
              value={memoText}
              onChange={(e) => setMemoText(e.target.value)}
              placeholder="メモ"
            />
          </div>
          {mobileEditSlotIndex !== null ? (
            <div className={styles.mobileEditorOverlay} onClick={() => setMobileEditSlotIndex(null)}>
              <div className={styles.mobileEditorModal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.mobileEditorHeader}>
                  <div className={styles.label}>{mobileEditSlotIndex + 1}体目 編集</div>
                  <button className={styles.btn} type="button" onClick={() => setMobileEditSlotIndex(null)}>
                    閉じる
                  </button>
                </div>
                {renderEditorPane(styles.rightPaneMobile)}
              </div>
            </div>
          ) : null}
          <div className={styles.exportCapture} aria-hidden="true">
            <div ref={exportRef} className={styles.exportSheet}>
              <div className={styles.exportHeader}>
                <div className={styles.exportTitle}>{title.trim() || "編成"}</div>
                {selectedQuest?.iconUrl ? (
                  <img className={styles.exportQuestIcon} src={selectedQuest.iconUrl} alt={selectedQuest.name} />
                ) : null}
              </div>
              <div className={styles.exportTeamSheet}>
                {slots.map((slot) => {
                  const c = slot.characterId ? charMap.get(slot.characterId) : null;
                  const fruitRows = Array.from({ length: 4 }, (_, i) => slot.fruits[i] ?? "");
                  const crestRows = Array.from({ length: 4 }, (_, i) => slot.crests[i] ?? "");
                  return (
                    <div key={`export-${slot.slotIndex}`} className={styles.teamBlock}>
                      <div className={styles.teamHeader} style={{ backgroundColor: ELEMENT_HEADER_COLOR[c?.element ?? ""] }}>
                        <div className={styles.teamRank}>{SLOT_LABELS[slot.slotIndex]}</div>
                        <div className={styles.teamNameWrap}>
                          <div className={styles.teamName}>{c?.name || ""}</div>
                        </div>
                      </div>
                      <div className={styles.teamBody}>
                        <div className={styles.iconCell}>
                          {c?.iconUrl ? (
                            <img className={styles.sheetIcon} src={c.iconUrl} alt={c.name} />
                          ) : (
                            <span className={styles.sheetSelectText}>選択</span>
                          )}
                        </div>
                        <div className={styles.detailTable}>
                          <div className={styles.tableHead}>わくわくの実</div>
                          <div className={styles.tableHead}>紋章</div>
                          {fruitRows.map((fruit, idx) => (
                            <Fragment key={`export-${slot.slotIndex}-row-${idx}`}>
                              <div className={`${styles.tableCell} ${fruit ? "" : styles.tableCellEmpty}`}>{fruit || "　"}</div>
                              <div className={`${styles.tableCell} ${crestRows[idx] ? "" : styles.tableCellEmpty}`}>{crestRows[idx] || "　"}</div>
                            </Fragment>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className={styles.exportMemoBlock}>
                <div className={styles.exportMemoTitle}>メモ</div>
                <div className={styles.exportMemo}>{memoText || " "}</div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {tab === "view" ? (
        <div className={styles.card} style={{ display: "grid", gap: 10 }}>
          <div className={styles.label}>保存済み編成 ({records.length}件)</div>
          {records.map((record) => (
            <div key={record.id} className={styles.compareRow}>
              <div className={styles.questMeta}>
                {record.targetQuestIconUrl ? (
                  <img className={styles.questMetaIcon} src={record.targetQuestIconUrl} alt={record.targetQuestName || "対象クエスト"} />
                ) : (
                  <div className={styles.questMetaBlank} />
                )}
                <div>
                  <div style={{ fontWeight: 800 }}>{record.title}</div>
                  <div className={styles.helper}>{formatDate(record.createdAt)}</div>
                  <div className={styles.helper}>対象: {record.targetQuestName || "未設定"}</div>
                </div>
              </div>
              <div className={styles.row}>
                <button className={styles.btn} onClick={() => router.push(`/TeamBuild/team?edit=${record.id}`)}>編集</button>
                <button className={styles.btn} onClick={() => void removeRecord(record.id)}>削除</button>
              </div>
            </div>
          ))}
          {records.length === 0 ? <div className={styles.helper}>保存データがありません</div> : null}
        </div>
      ) : null}

      {tab === "arrange" ? (
        <div className={styles.card} style={{ display: "grid", gap: 10 }}>
          <div className={styles.label}>並べる画面 (最大15件)</div>
          <div className={styles.row}>
            <button className={styles.btn} type="button" onClick={() => setIsArrangeAddOpen(true)} disabled={arrangeIds.length >= 15 || availableArrangeRecords.length === 0}>
              追加
            </button>
            <button className={styles.btn} type="button" onClick={() => setIsArrangeRemoveOpen(true)} disabled={arrangedRecords.length === 0}>
              削除
            </button>
            <span className={styles.helper}>{arrangeIds.length}/15件</span>
          </div>
          <div className={`${styles.compareBoard} ${styles.arrangeBoard}`}>
            {arrangedRecords.map((record, idx) => (
              <div key={record.id} className={`${styles.compareRow} ${styles.arrangeRow}`}>
                <div className={styles.arrangeTitleRow}>
                  <div className={styles.arrangeTitle}>{record.title}</div>
                  <button
                    className={`${styles.iconBtn} ${styles.arrangeGearBtn}`}
                    type="button"
                    aria-label="編成を編集"
                    title="編成を編集"
                    onClick={() => router.push(`/TeamBuild/team?edit=${record.id}`)}
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                      <path
                        d="M19.14 12.94c.04-.31.06-.62.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.14 7.14 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.57.23-1.12.54-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.62-.06.94s.02.63.06.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.13.22.39.31.6.22l2.39-.96c.51.4 1.06.71 1.63.94l.36 2.54c.04.24.25.42.5.42h3.84c.25 0 .46-.18.5-.42l.36-2.54c.57-.23 1.12-.54 1.63-.94l2.39.96c.22.09.47 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58zM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5z"
                        fill="currentColor"
                      />
                    </svg>
                  </button>
                </div>
                <div className={styles.arrangeBottomRow}>
                  <div className={styles.arrangeVisualRow}>
                    {record.targetQuestIconUrl ? (
                      <img className={styles.questMetaIcon} src={record.targetQuestIconUrl} alt={record.targetQuestName || "対象クエスト"} />
                    ) : (
                      <div className={styles.questMetaBlank} />
                    )}
                    <div className={`${styles.compareIcons} ${styles.arrangeIcons}`}>
                      {[0, 1, 2, 3].map((slotIndex) => {
                        const slot = record.slots.find((s) => s.slotIndex === slotIndex);
                        return slot?.iconUrl ? (
                          <img key={slotIndex} className={styles.compareIcon} src={slot.iconUrl} alt={slot.characterName} title={slot.characterName} />
                        ) : (
                          <div key={slotIndex} className={styles.blankIcon} />
                        );
                      })}
                    </div>
                  </div>
                  <div className={styles.arrangeActions}>
                    <div className={styles.arrangeMoveRow}>
                      <button
                        className={`${styles.btn} ${styles.arrangeMiniBtn}`}
                        disabled={idx === 0}
                        onClick={() => setArrangeIds((prev) => moveItem(prev, idx, idx - 1))}
                      >
                        ↑
                      </button>
                      <button
                        className={`${styles.btn} ${styles.arrangeMiniBtn}`}
                        disabled={idx === arrangedRecords.length - 1}
                        onClick={() => setArrangeIds((prev) => moveItem(prev, idx, idx + 1))}
                      >
                        ↓
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {arrangedRecords.length === 0 ? <div className={styles.helper}>追加ボタンで編成を並べてください</div> : null}
          {isArrangeAddOpen ? (
            <div className={styles.arrangeOverlay} onClick={() => setIsArrangeAddOpen(false)}>
              <div className={styles.arrangeDialog} onClick={(e) => e.stopPropagation()}>
                <div className={styles.label}>追加する編成を選択</div>
                <select className={styles.select} value={arrangeCandidateId} onChange={(e) => setArrangeCandidateId(e.target.value)}>
                  <option value="">選択してください</option>
                  {availableArrangeRecords.map((record) => (
                    <option key={record.id} value={record.id}>{record.title}</option>
                  ))}
                </select>
                <div className={styles.row} style={{ justifyContent: "flex-end" }}>
                  <button className={styles.btn} type="button" onClick={() => setIsArrangeAddOpen(false)}>閉じる</button>
                  <button className={styles.btn} type="button" onClick={addArrangeRecord} disabled={!arrangeCandidateId || arrangeIds.length >= 15}>追加</button>
                </div>
              </div>
            </div>
          ) : null}
          {isArrangeRemoveOpen ? (
            <div className={styles.arrangeOverlay} onClick={() => setIsArrangeRemoveOpen(false)}>
              <div className={styles.arrangeDialog} onClick={(e) => e.stopPropagation()}>
                <div className={styles.label}>削除する編成を選択</div>
                <select className={styles.select} value={arrangeRemoveId} onChange={(e) => setArrangeRemoveId(e.target.value)}>
                  <option value="">選択してください</option>
                  {arrangedRecords.map((record) => (
                    <option key={record.id} value={record.id}>{record.title}</option>
                  ))}
                </select>
                <div className={styles.row} style={{ justifyContent: "flex-end" }}>
                  <button className={styles.btn} type="button" onClick={() => setIsArrangeRemoveOpen(false)}>閉じる</button>
                  <button className={styles.btn} type="button" onClick={() => removeArrangeRecord(arrangeRemoveId)} disabled={!arrangeRemoveId}>削除</button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}


