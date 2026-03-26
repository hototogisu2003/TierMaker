"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toPng } from "html-to-image";
import styles from "./TeamManager.module.css";
import { fetchCharactersAndQuests } from "@/lib/teamcustom/supabase";
import { deleteTeam, getArrangeIds, listTeams, putTeam, setArrangeIds as persistArrangeIds } from "@/lib/teamcustom/indexeddb";
import { CREST_AVAILABLE_GRADES_BY_ID, CREST_GRADE_LABEL, CREST_ID_BY_NAME, CREST_OPTIONS, FRUIT_OPTIONS } from "@/lib/teamcustom/options";
import type { CharacterItem, CrestGrade, FruitGrade, QuestItem, ShugojuItem, SpotKey, TeamRecord, TeamSlot } from "@/lib/teamcustom/types";

type Tab = "memo" | "arrange";
type FruitFilter = "status" | "other";
type SortOrder = "asc" | "desc";
type YearValue = number | "";

type DraftSlot = {
  slotIndex: number;
  characterId: string;
  fruits: string[];
  fruitGrades: FruitGrade[];
  crests: string[];
  crestGrades: Record<string, CrestGrade>;
  slotMemo: string;
};

type SharePayload = {
  v?: number;
  title?: string;
  targetQuestId?: string;
  targetQuestName?: string;
  targetQuestIconUrl?: string;
  shugojuId?: string;
  shugojuName?: string;
  shugojuIconUrl?: string;
  mainSpot?: SpotKey;
  subSpot?: SpotKey;
  memoText?: string;
  slots?: Array<{
    slotIndex?: number;
    characterId?: string;
    fruits?: string[];
    fruitGrades?: Record<string, FruitGrade>;
    fruitGradesList?: FruitGrade[];
    crests?: string[];
    crestGrades?: Record<string, CrestGrade>;
    slotMemo?: string;
  }>;
};

type CompactShareSlot = [string?, number[]?, number[]?, string?];
type CompactSharePayloadV2 = {
  v: 2;
  t?: string;
  q?: string;
  s?: string;
  pm?: SpotKey;
  ps?: SpotKey;
  m?: string;
  a?: CompactShareSlot[];
};

const ELEMENT_OPTIONS = ["火", "水", "木", "光", "闇"] as const;
const OBTAIN_OPTIONS = ["ガチャ", "降臨", "コラボパック"] as const;
const GACHA_OPTIONS = ["限定", "α", "恒常", "コラボ"] as const;
const FORM_OPTIONS = ["進化/神化", "獣神化", "獣神化改", "真獣神化"] as const;
const OTHER_CATEGORY_OPTIONS = ["黎絶", "轟絶", "爆絶", "超絶", "超究極", "コラボ", "その他"] as const;
const QUEST_FILTER_OPTIONS = ["破界の星墓", "天魔の孤城", "禁忌の獄", "黎絶", "轟絶", "爆絶", "超絶"] as const;
const TEAM_RECORD_LIMIT = 50;
const EXPORT_IMAGE_WIDTH_PX = 1280;
const EXPORT_IMAGE_HEIGHT_PX = 960;
const QUEST_GRID_COLS = 3;
const QUEST_ROW_HEIGHT = 86;
const QUEST_VISIBLE_ROWS = 5;
const CHARACTER_ITEM_WIDTH = 82;
const CHARACTER_VISIBLE_ITEMS = 12;
const SHUGOJU_GRID_COLS = 3;
const SHUGOJU_ROW_HEIGHT = 90;
const SHUGOJU_VISIBLE_ROWS = 5;
const SPOT_OPTIONS = ["火", "水", "木", "光", "闇", "王者"] as const satisfies readonly SpotKey[];
const SPOT_MAIN_BONUS = { hp: 2000, attack: 2000, speed: 40.8 } as const;
const SPOT_SUB_BONUS = { hp: 1500, attack: 1500, speed: 30.6 } as const;
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
const FRUIT_ID_BY_NAME = new Map<string, number>(FRUIT_OPTIONS.map((option) => [option.name, option.id]));
const FRUIT_NAME_BY_ID = new Map<number, string>(FRUIT_OPTIONS.map((option) => [option.id, option.name]));
const CREST_NAME_BY_ID = new Map<number, string>(
  Object.entries(CREST_ID_BY_NAME).map(([name, id]) => [id, name])
);

function emptySlots(): DraftSlot[] {
  return [0, 1, 2, 3].map((slotIndex) => ({
    slotIndex,
    characterId: "",
    fruits: [],
    fruitGrades: [],
    crests: [],
    crestGrades: {},
    slotMemo: "",
  }));
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

function toBase64Url(input: string): string {
  if (typeof window === "undefined") return "";
  const bytes = new TextEncoder().encode(input);
  return bytesToBase64Url(bytes);
}

function bytesToBase64Url(bytes: Uint8Array): string {
  if (typeof window === "undefined") return "";
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  const base64 = window.btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(input: string): Uint8Array {
  if (typeof window === "undefined") return new Uint8Array();
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((input.length + 3) % 4);
  const binary = window.atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function encodeSharePayload(input: string): Promise<string> {
  if (typeof window === "undefined") return "";
  try {
    const CompressionCtor = (window as Window & { CompressionStream?: new (format: "gzip") => CompressionStream }).CompressionStream;
    if (CompressionCtor) {
      const source = new Blob([input]).stream();
      const compressedStream = source.pipeThrough(new CompressionCtor("gzip"));
      const compressedBuffer = await new Response(compressedStream).arrayBuffer();
      return `gz.${bytesToBase64Url(new Uint8Array(compressedBuffer))}`;
    }
  } catch {
    // fallback to non-compressed encoding
  }
  return `b64.${toBase64Url(input)}`;
}

async function decodeSharePayload(input: string): Promise<SharePayload> {
  if (typeof window === "undefined") throw new Error("share decode unavailable");
  const [prefix, value] = input.includes(".") ? input.split(".", 2) : ["b64", input];
  if (!value) throw new Error("invalid share payload");

  if (prefix === "gz") {
    const DecompressionCtor = (window as Window & { DecompressionStream?: new (format: "gzip") => DecompressionStream }).DecompressionStream;
    if (!DecompressionCtor) throw new Error("browser does not support gzip decode");
    const compressed = fromBase64Url(value);
    const compressedBuffer = new ArrayBuffer(compressed.byteLength);
    new Uint8Array(compressedBuffer).set(compressed);
    const source = new Blob([compressedBuffer]).stream();
    const decompressedStream = source.pipeThrough(new DecompressionCtor("gzip"));
    const text = await new Response(decompressedStream).text();
    return normalizeSharePayload(JSON.parse(text));
  }

  const decodedText = new TextDecoder().decode(fromBase64Url(value));
  return normalizeSharePayload(JSON.parse(decodedText));
}

function normalizeSharePayload(raw: unknown): SharePayload {
  if (!raw || typeof raw !== "object") return {};
  const data = raw as Record<string, unknown>;
  if (data.v === 2) {
    const v2 = data as unknown as CompactSharePayloadV2;
    const slots = Array.isArray(v2.a) ? v2.a : [];
    return {
      v: 2,
      title: typeof v2.t === "string" ? v2.t : "",
      targetQuestId: typeof v2.q === "string" ? v2.q : "",
      shugojuId: typeof v2.s === "string" ? v2.s : "",
      mainSpot: SPOT_OPTIONS.includes(v2.pm as SpotKey) ? (v2.pm as SpotKey) : undefined,
      subSpot: SPOT_OPTIONS.includes(v2.ps as SpotKey) ? (v2.ps as SpotKey) : undefined,
      memoText: typeof v2.m === "string" ? v2.m : "",
      slots: [0, 1, 2, 3].map((slotIndex) => {
        const tuple = slots[slotIndex];
        const characterId = Array.isArray(tuple) && typeof tuple[0] === "string" ? tuple[0] : "";
        const fruitNums = Array.isArray(tuple) && Array.isArray(tuple[1]) ? tuple[1] : [];
        const crestNums = Array.isArray(tuple) && Array.isArray(tuple[2]) ? tuple[2] : [];
        const slotMemo = Array.isArray(tuple) && typeof tuple[3] === "string" ? tuple[3] : "";
        const fruits: string[] = [];
        const fruitGradesList: FruitGrade[] = [];
        for (const n of fruitNums) {
          if (typeof n !== "number" || !Number.isFinite(n)) continue;
          const id = Math.abs(Math.trunc(n));
          const name = FRUIT_NAME_BY_ID.get(id);
          if (!name) continue;
          fruits.push(name);
          fruitGradesList.push(n < 0 ? "EL" : "L");
        }
        const crests: string[] = [];
        const crestGrades: Record<string, CrestGrade> = {};
        for (const n of crestNums) {
          if (typeof n !== "number" || !Number.isFinite(n)) continue;
          const encoded = Math.trunc(n);
          const id = Math.trunc(Math.abs(encoded) / 10);
          const gradeRaw = Math.abs(encoded) % 10;
          const grade = (gradeRaw === 1 || gradeRaw === 2 ? gradeRaw : 0) as CrestGrade;
          const name = CREST_NAME_BY_ID.get(id);
          if (!name) continue;
          crests.push(name);
          const available = CREST_AVAILABLE_GRADES_BY_ID[id] ?? [0];
          crestGrades[name] = (available.includes(grade) ? grade : available[available.length - 1]) as CrestGrade;
        }
        return {
          slotIndex,
          characterId,
          fruits,
          fruitGradesList,
          crests,
          crestGrades,
          slotMemo,
        };
      }),
    };
  }
  return data as unknown as SharePayload;
}

function moveItem<T>(arr: T[], from: number, to: number): T[] {
  const copy = arr.slice();
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

async function triggerImageSave(dataUrl: string, fileName: string): Promise<void> {
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent);
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  if (a.parentNode) a.parentNode.removeChild(a);

  if (isIOS) {
    window.open(dataUrl, "_blank", "noopener,noreferrer");
  }
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

function normalizeFruitGradeList(
  fruits: string[],
  fruitGradesList?: FruitGrade[],
  fruitGradesMap?: Record<string, FruitGrade>
): FruitGrade[] {
  if (Array.isArray(fruitGradesList)) {
    return fruits.map((_, index) => (fruitGradesList[index] === "EL" ? "EL" : "L"));
  }
  return fruits.map((name) => (fruitGradesMap?.[name] === "EL" ? "EL" : "L"));
}

function trimStatText(value: number, digits: number): string {
  return value.toFixed(digits).replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
}

function formatSpeedText(value: number, digits: number): string {
  const fixed = value.toFixed(digits);
  return fixed.replace(/(\.\d*[1-9])0+$/, "$1").replace(/\.00$/, ".0");
}

function fruitGradeRank(grade: FruitGrade): number {
  return grade === "EL" ? 2 : 1;
}

export default function TeamManager({ mode }: { mode: Tab }) {
  const tab = mode;
  const router = useRouter();
  const [editQueryId, setEditQueryId] = useState<string | null>(null);
  const [shareQuery, setShareQuery] = useState<string | null>(null);
  const [autoEditAppliedId, setAutoEditAppliedId] = useState<string | null>(null);
  const [appliedShareQuery, setAppliedShareQuery] = useState<string | null>(null);
  const [characters, setCharacters] = useState<CharacterItem[]>([]);
  const [quests, setQuests] = useState<QuestItem[]>([]);
  const [shugojus, setShugojus] = useState<ShugojuItem[]>([]);
  const [records, setRecords] = useState<TeamRecord[]>([]);
  const [activeSlotIndex, setActiveSlotIndex] = useState(0);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [questId, setQuestId] = useState("");
  const [questKeyword, setQuestKeyword] = useState("");
  const [questFilter, setQuestFilter] = useState<(typeof QUEST_FILTER_OPTIONS)[number] | "">("");
  const [appliedQuestKeyword, setAppliedQuestKeyword] = useState("");
  const [appliedQuestFilter, setAppliedQuestFilter] = useState<(typeof QUEST_FILTER_OPTIONS)[number] | "">("");
  const [isQuestModalOpen, setIsQuestModalOpen] = useState(false);
  const [hasQuestSearched, setHasQuestSearched] = useState(false);
  const [questListScrollTop, setQuestListScrollTop] = useState(0);
  const [characterListScrollLeft, setCharacterListScrollLeft] = useState(0);
  const [shugojuId, setShugojuId] = useState("");
  const [shugojuKeyword, setShugojuKeyword] = useState("");
  const [isShugojuModalOpen, setIsShugojuModalOpen] = useState(false);
  const [mainSpot, setMainSpot] = useState<SpotKey | "">("");
  const [subSpot, setSubSpot] = useState<SpotKey | "">("");
  const [isSpotModalOpen, setIsSpotModalOpen] = useState(false);
  const [shugojuListScrollTop, setShugojuListScrollTop] = useState(0);
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
  const [modalSlotIndex, setModalSlotIndex] = useState<number | null>(null);
  const [isCharacterModalOpen, setIsCharacterModalOpen] = useState(false);
  const [isFruitModalOpen, setIsFruitModalOpen] = useState(false);
  const [isCrestModalOpen, setIsCrestModalOpen] = useState(false);
  const [arrangeIds, setArrangeIds] = useState<string[]>([]);
  const [arrangeRemoveId, setArrangeRemoveId] = useState("");
  const [isArrangeRemoveOpen, setIsArrangeRemoveOpen] = useState(false);
  const [isArrangeLoaded, setIsArrangeLoaded] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState("");
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const exportRef = useRef<HTMLDivElement>(null);
  const characterListRef = useRef<HTMLDivElement>(null);
  const questListRef = useRef<HTMLDivElement>(null);
  const shugojuListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchCharactersAndQuests()
      .then((res) => {
        setCharacters(res.characters);
        setQuests(res.quests);
        setShugojus(res.shugojus);
        if (res.questLoadError) {
          setMessage(`対象クエストの読み込みに失敗しました: ${res.questLoadError}`);
        }
        if (res.shugojuLoadError) {
          setMessage(`守護獣の読み込みに失敗しました: ${res.shugojuLoadError}`);
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
    setArrangeIds((prev) => {
      const filtered = prev.filter((id) => records.some((r) => r.id === id));
      const append = records.map((r) => r.id).filter((id) => !filtered.includes(id));
      return [...filtered, ...append].slice(0, TEAM_RECORD_LIMIT);
    });
  }, [records]);
  useEffect(() => {
    if (tab !== "memo") return;
    const params = new URLSearchParams(window.location.search);
    setEditQueryId(params.get("edit"));
    setShareQuery(params.get("share"));
  }, [tab]);
  useEffect(() => {
    if (tab !== "memo" || !editQueryId || autoEditAppliedId === editQueryId) return;
    const record = records.find((r) => r.id === editQueryId);
    if (!record) return;
    fillFromRecord(record);
    setAutoEditAppliedId(editQueryId);
  }, [tab, editQueryId, autoEditAppliedId, records]);
  useEffect(() => {
    if (tab !== "memo" || !shareQuery || appliedShareQuery === shareQuery) return;
    let canceled = false;
    decodeSharePayload(shareQuery)
      .then((payload) => {
        if (canceled) return;
        applyShareData(payload);
        setAppliedShareQuery(shareQuery);
        setMessage("共有URLから編成を読み込みました");
      })
      .catch(() => {
        if (canceled) return;
        setMessage("共有URLの読み込みに失敗しました");
      });
    return () => {
      canceled = true;
    };
  }, [tab, shareQuery, appliedShareQuery]);
  useEffect(() => {
    if (!isArrangeLoaded) return;
    persistArrangeIds(arrangeIds).catch(() => setMessage("並べる画面の設定保存に失敗しました"));
  }, [arrangeIds, isArrangeLoaded]);
  useEffect(() => {
    if (!isShugojuModalOpen) return;
    setShugojuListScrollTop(0);
    if (shugojuListRef.current) shugojuListRef.current.scrollTop = 0;
  }, [isShugojuModalOpen]);
  useEffect(() => {
    const updateViewport = () => setIsMobileViewport(window.innerWidth <= 768);
    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  const charMap = useMemo(() => {
    const map = new Map<string, CharacterItem>();
    for (const c of characters) map.set(c.id, c);
    return map;
  }, [characters]);

  const selectedQuest = useMemo(() => quests.find((q) => q.id === questId) ?? null, [quests, questId]);
  const selectedShugoju = useMemo(() => shugojus.find((s) => s.id === shugojuId) ?? null, [shugojus, shugojuId]);
  const spotIconSrc = (spot: SpotKey | "", kind: "main" | "sub") => (spot ? `/spot/${spot}_${kind}.png` : "");
  const fruitGradeIconSrc = (grade: FruitGrade) => (grade === "EL" ? "/calc-legacy/特級EL.png" : "/calc-legacy/特級L.png");
  const fruitGradeOf = (slot: DraftSlot, fruitIndex: number): FruitGrade => slot.fruitGrades[fruitIndex] ?? "L";
  const crestIdOf = (crestName: string): number | null => {
    const id = CREST_ID_BY_NAME[crestName as keyof typeof CREST_ID_BY_NAME];
    return id ?? null;
  };
  const crestAvailableGradesOf = (crestName: string): CrestGrade[] => {
    const id = crestIdOf(crestName);
    if (!id) return [0];
    return (CREST_AVAILABLE_GRADES_BY_ID[id] ?? [0]) as CrestGrade[];
  };
  const crestDefaultGradeOf = (crestName: string): CrestGrade => {
    const grades = crestAvailableGradesOf(crestName);
    return grades[grades.length - 1] ?? 0;
  };
  const crestGradeOf = (slot: DraftSlot, crestName: string): CrestGrade => {
    const grade = slot.crestGrades[crestName];
    if (typeof grade === "number") return grade;
    return crestDefaultGradeOf(crestName);
  };
  const crestLabel = (crestName: string, grade: CrestGrade): string => `${crestName}${CREST_GRADE_LABEL[grade]}`;
  const crestIconSrc = (crestName: string, grade: CrestGrade) => {
    const id = crestIdOf(crestName);
    return id ? `/soulskill/skill_${id}_${grade}.png` : "";
  };
  const fruitOptionByName = useMemo(() => new Map(FRUIT_OPTIONS.map((option) => [option.name, option])), []);
  const fruitBonusTotalsOf = (slot: DraftSlot) => {
    const currentCharacter = slot.characterId ? charMap.get(slot.characterId) ?? null : null;
    if (!currentCharacter) return { hp: 0, attack: 0, speed: 0 };

    const totals = { hp: 0, attack: 0, speed: 0 };
    const sharedGroups: Array<{
      ids: number[];
      value: string;
      getValue: (character: CharacterItem) => string;
    }> = [
      { ids: [1, 2, 3, 10, 11, 12], value: currentCharacter.shuzoku, getValue: (character) => character.shuzoku },
      { ids: [4, 5, 6, 13, 14, 15], value: currentCharacter.gekishu, getValue: (character) => character.gekishu },
      { ids: [7, 8, 9, 16, 17, 18], value: currentCharacter.senkei, getValue: (character) => character.senkei },
    ];
    const sharedFruitIds = new Set(sharedGroups.flatMap((group) => group.ids));

    const addBonus = (optionId: number, grade: FruitGrade) => {
      const option = FRUIT_OPTIONS.find((item) => item.id === optionId);
      const bonus = option?.bonuses[grade] ?? { hp: 0, attack: 0, speed: 0 };
      totals.hp += bonus.hp;
      totals.attack += bonus.attack;
      totals.speed += bonus.speed;
    };

    slot.fruits.forEach((fruitName, index) => {
      const option = fruitOptionByName.get(fruitName);
      if (!option) return;
      if (sharedFruitIds.has(option.id)) return;
      addBonus(option.id, slot.fruitGrades[index] ?? "L");
    });

    sharedGroups.forEach((group) => {
      if (!group.value) return;
      const bestById = new Map<number, FruitGrade>();
      slots.forEach((otherSlot) => {
        const otherCharacter = otherSlot.characterId ? charMap.get(otherSlot.characterId) ?? null : null;
        if (!otherCharacter || group.getValue(otherCharacter) !== group.value) return;
        otherSlot.fruits.forEach((fruitName, index) => {
          const option = fruitOptionByName.get(fruitName);
          if (!option || !group.ids.includes(option.id)) return;
          const grade = otherSlot.fruitGrades[index] ?? "L";
          const currentBest = bestById.get(option.id);
          if (!currentBest || fruitGradeRank(grade) > fruitGradeRank(currentBest)) {
            bestById.set(option.id, grade);
          }
        });
      });
      bestById.forEach((grade, optionId) => addBonus(optionId, grade));
    });

    return totals;
  };
  const spotBonusTotalsOf = (slot: DraftSlot) => {
    const currentCharacter = slot.characterId ? charMap.get(slot.characterId) ?? null : null;
    if (!currentCharacter || !currentCharacter.element) return { hp: 0, attack: 0, speed: 0 };

    const mainApplies = Boolean(mainSpot) && (mainSpot === "王者" || mainSpot === currentCharacter.element);
    const subApplies = Boolean(subSpot) && (subSpot === "王者" || subSpot === currentCharacter.element);
    const subBlocked = mainApplies && subApplies;

    return {
      hp: (mainApplies ? SPOT_MAIN_BONUS.hp : 0) + (!subBlocked && subApplies ? SPOT_SUB_BONUS.hp : 0),
      attack: (mainApplies ? SPOT_MAIN_BONUS.attack : 0) + (!subBlocked && subApplies ? SPOT_SUB_BONUS.attack : 0),
      speed: (mainApplies ? SPOT_MAIN_BONUS.speed : 0) + (!subBlocked && subApplies ? SPOT_SUB_BONUS.speed : 0),
    };
  };
  const statusBonusTotalsOf = (slot: DraftSlot) => {
    const fruit = fruitBonusTotalsOf(slot);
    const spot = spotBonusTotalsOf(slot);
    return {
      hp: fruit.hp + spot.hp,
      attack: fruit.attack + spot.attack,
      speed: fruit.speed + spot.speed,
    };
  };
  const formatStatValue = (label: "HP" | "攻撃" | "スピード", value: number | null) => {
    if (value === null) return "";
    return label === "スピード" ? formatSpeedText(value, 2) : String(Math.round(value));
  };
  const formatGaugeAttackValue = (value: number | null, hasGauge: boolean) => {
    if (value === null || !hasGauge) return "";
    return String(Math.floor(value * 1.2));
  };
  const formatStatBonus = (label: "HP" | "攻撃" | "スピード", value: number, enabled: boolean) => {
    if (!enabled || value === 0) return "";
    const text = label === "スピード" ? formatSpeedText(value, 1) : String(Math.round(value));
    return `(+${text})`;
  };
  const filteredQuests = useMemo(() => {
    if (!hasQuestSearched) return [];
    const keyword = appliedQuestKeyword.trim().toLowerCase();
    const elementIndex = new Map<CharacterItem["element"], number>(ELEMENT_OPTIONS.map((v, i) => [v, i]));
    const list = quests.filter((q) => {
      const isKeywordMatched = !keyword || q.name.toLowerCase().includes(keyword) || q.nameKana.toLowerCase().includes(keyword);
      const isFilterMatched = !appliedQuestFilter || q.questTag === appliedQuestFilter || q.contentTag === appliedQuestFilter;
      return isKeywordMatched && isFilterMatched;
    });
    list.sort((a, b) => (elementIndex.get(a.element) ?? Number.POSITIVE_INFINITY) - (elementIndex.get(b.element) ?? Number.POSITIVE_INFINITY));
    return list.slice(0, 50);
  }, [quests, appliedQuestKeyword, appliedQuestFilter, hasQuestSearched]);
  const questVirtual = useMemo(() => {
    const totalRows = Math.ceil(filteredQuests.length / QUEST_GRID_COLS);
    const startRow = Math.max(0, Math.floor(questListScrollTop / QUEST_ROW_HEIGHT) - 1);
    const endRow = Math.min(totalRows, startRow + QUEST_VISIBLE_ROWS + 2);
    const startIndex = startRow * QUEST_GRID_COLS;
    const endIndex = Math.min(filteredQuests.length, endRow * QUEST_GRID_COLS);
    const visible = filteredQuests.slice(startIndex, endIndex);
    const paddingTop = startRow * QUEST_ROW_HEIGHT;
    const paddingBottom = Math.max(0, (totalRows - endRow) * QUEST_ROW_HEIGHT);
    return { visible, paddingTop, paddingBottom };
  }, [filteredQuests, questListScrollTop]);
  const filteredShugojus = useMemo(() => {
    const keyword = shugojuKeyword.trim().toLowerCase();
    const list = keyword ? shugojus.filter((s) => s.name.toLowerCase().includes(keyword) || s.nameKana.toLowerCase().includes(keyword)) : shugojus;
    return list.slice(0, 200);
  }, [shugojus, shugojuKeyword]);
  const shugojuVirtual = useMemo(() => {
    const totalRows = Math.ceil(filteredShugojus.length / SHUGOJU_GRID_COLS);
    const startRow = Math.max(0, Math.floor(shugojuListScrollTop / SHUGOJU_ROW_HEIGHT));
    const endRow = Math.min(totalRows, startRow + SHUGOJU_VISIBLE_ROWS);
    const startIndex = startRow * SHUGOJU_GRID_COLS;
    const endIndex = Math.min(filteredShugojus.length, endRow * SHUGOJU_GRID_COLS);
    const visible = filteredShugojus.slice(startIndex, endIndex);
    const paddingTop = startRow * SHUGOJU_ROW_HEIGHT;
    const paddingBottom = Math.max(0, (totalRows - endRow) * SHUGOJU_ROW_HEIGHT);
    return { visible, paddingTop, paddingBottom };
  }, [filteredShugojus, shugojuListScrollTop]);
  const arrangedRecords = useMemo(
    () => arrangeIds.map((id) => records.find((r) => r.id === id)).filter((x): x is TeamRecord => Boolean(x)).slice(0, TEAM_RECORD_LIMIT),
    [arrangeIds, records]
  );
  const exportColumns = useMemo(() => [slots.slice(0, 2), slots.slice(2, 4)], [slots]);

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

    return list.slice(0, 50);
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
  const characterVirtual = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(characterListScrollLeft / CHARACTER_ITEM_WIDTH) - 2);
    const endIndex = Math.min(filteredCharacters.length, startIndex + CHARACTER_VISIBLE_ITEMS + 4);
    const visible = filteredCharacters.slice(startIndex, endIndex);
    const paddingLeft = startIndex * CHARACTER_ITEM_WIDTH;
    const paddingRight = Math.max(0, (filteredCharacters.length - endIndex) * CHARACTER_ITEM_WIDTH);
    return { visible, paddingLeft, paddingRight };
  }, [filteredCharacters, characterListScrollLeft]);

  function applyFilters(nextNameFilter?: string) {
    setAppliedNameFilter(nextNameFilter ?? nameFilter);
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
    setCharacterListScrollLeft(0);
    if (characterListRef.current) characterListRef.current.scrollLeft = 0;
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
    setCharacterListScrollLeft(0);
    if (characterListRef.current) characterListRef.current.scrollLeft = 0;
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

  function moveDraftSlot(fromIndex: number, toIndex: number) {
    if (toIndex < 0 || toIndex > 3) return;
    setSlots((prev) => {
      const from = prev.find((s) => s.slotIndex === fromIndex);
      const to = prev.find((s) => s.slotIndex === toIndex);
      if (!from || !to) return prev;
      return prev.map((slot) => {
        if (slot.slotIndex === fromIndex) {
          return {
            ...slot,
            characterId: to.characterId,
            fruits: [...to.fruits],
            fruitGrades: [...to.fruitGrades],
            crests: [...to.crests],
            crestGrades: { ...to.crestGrades },
            slotMemo: to.slotMemo,
          };
        }
        if (slot.slotIndex === toIndex) {
          return {
            ...slot,
            characterId: from.characterId,
            fruits: [...from.fruits],
            fruitGrades: [...from.fruitGrades],
            crests: [...from.crests],
            crestGrades: { ...from.crestGrades },
            slotMemo: from.slotMemo,
          };
        }
        return slot;
      });
    });
    setActiveSlotIndex(toIndex);
  }

  function clearSlot(slotIndex: number) {
    setSlots((prev) =>
      prev.map((slot) =>
        slot.slotIndex === slotIndex
          ? { ...slot, characterId: "", fruits: [], fruitGrades: [], crests: [], crestGrades: {}, slotMemo: "" }
          : slot
      )
    );
  }

  function setSlotMemo(slotIndex: number, value: string) {
    setSlots((prev) => prev.map((slot) => (slot.slotIndex === slotIndex ? { ...slot, slotMemo: value } : slot)));
  }

  function toggleOption(slotIndex: number, kind: "fruits" | "crests", value: string, max: number) {
    setSlots((prev) =>
      prev.map((slot) => {
        if (slot.slotIndex !== slotIndex) return slot;
        const current = slot[kind];
        if (kind === "fruits") {
          if (current.length >= max) return slot;
          const next = [...current, value];
          const nextGrades = [...slot.fruitGrades, "L" as FruitGrade];
          const paired = next.map((name, idx) => ({ name, grade: nextGrades[idx] ?? "L", order: fruitOrderMap.get(name) ?? Number.POSITIVE_INFINITY }));
          paired.sort((a, b) => a.order - b.order);
          return { ...slot, fruits: paired.map((p) => p.name), fruitGrades: paired.map((p) => p.grade) };
        }
        const exists = current.includes(value);
        if (exists) {
          if (kind === "crests") {
            const nextCrestGrades = { ...slot.crestGrades };
            delete nextCrestGrades[value];
            return { ...slot, [kind]: current.filter((v) => v !== value), crestGrades: nextCrestGrades };
          }
          return { ...slot, [kind]: current.filter((v) => v !== value) };
        }
        const next = [...current, value];
        if (current.length >= max) return slot;
        next.sort((a, b) => (crestOrderMap.get(a) ?? Number.POSITIVE_INFINITY) - (crestOrderMap.get(b) ?? Number.POSITIVE_INFINITY));
        return { ...slot, [kind]: next, crestGrades: { ...slot.crestGrades, [value]: crestDefaultGradeOf(value) } };
      })
    );
  }

  function removeFruitAt(slotIndex: number, fruitIndex: number) {
    setSlots((prev) =>
      prev.map((slot) => {
        if (slot.slotIndex !== slotIndex) return slot;
        if (fruitIndex < 0 || fruitIndex >= slot.fruits.length) return slot;
        const nextFruits = slot.fruits.filter((_, idx) => idx !== fruitIndex);
        const nextGrades = slot.fruitGrades.filter((_, idx) => idx !== fruitIndex);
        return { ...slot, fruits: nextFruits, fruitGrades: nextGrades };
      })
    );
  }

  function setFruitGrade(slotIndex: number, fruitIndex: number, grade: FruitGrade) {
    setSlots((prev) =>
      prev.map((slot) => {
        if (slot.slotIndex !== slotIndex) return slot;
        if (fruitIndex < 0 || fruitIndex >= slot.fruits.length) return slot;
        const nextGrades = [...slot.fruitGrades];
        nextGrades[fruitIndex] = grade;
        return { ...slot, fruitGrades: nextGrades };
      })
    );
  }

  function setCrestGrade(slotIndex: number, crestName: string, grade: CrestGrade) {
    setSlots((prev) =>
      prev.map((slot) => (slot.slotIndex === slotIndex ? { ...slot, crestGrades: { ...slot.crestGrades, [crestName]: grade } } : slot))
    );
  }

  function removeCrest(slotIndex: number, crestName: string) {
    setSlots((prev) =>
      prev.map((slot) => {
        if (slot.slotIndex !== slotIndex) return slot;
        const nextCrests = slot.crests.filter((v) => v !== crestName);
        const nextCrestGrades = { ...slot.crestGrades };
        delete nextCrestGrades[crestName];
        return { ...slot, crests: nextCrests, crestGrades: nextCrestGrades };
      })
    );
  }

  function resetDraft() {
    if (records.length >= TEAM_RECORD_LIMIT) {
      setMessage(`保存上限(${TEAM_RECORD_LIMIT}件)に達しています。新規保存するには既存編成を削除してください`);
    }
    setEditingId(null);
    setEditQueryId(null);
    setAutoEditAppliedId(null);
    setShareQuery(null);
    setAppliedShareQuery(null);
    setTitle("");
    setQuestId("");
    setQuestKeyword("");
    setQuestFilter("");
    setAppliedQuestKeyword("");
    setAppliedQuestFilter("");
    setIsQuestModalOpen(false);
    setHasQuestSearched(false);
    setShugojuId("");
    setShugojuKeyword("");
    setIsShugojuModalOpen(false);
    setMainSpot("");
    setSubSpot("");
    setIsSpotModalOpen(false);
    setMemoText("");
    setSlots(emptySlots());
    setActiveSlotIndex(0);
    setModalSlotIndex(null);
    setIsCharacterModalOpen(false);
    setIsFruitModalOpen(false);
    setIsCrestModalOpen(false);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("edit");
      url.searchParams.delete("share");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  }

  function fillFromRecord(record: TeamRecord) {
    setEditingId(record.id);
    setTitle(record.title);
    setQuestId(record.targetQuestId ?? "");
    setQuestKeyword(record.targetQuestName ?? "");
    setQuestFilter("");
    setAppliedQuestKeyword("");
    setAppliedQuestFilter("");
    setIsQuestModalOpen(false);
    setHasQuestSearched(false);
    setShugojuId(record.shugojuId ?? "");
    setShugojuKeyword(record.shugojuName ?? "");
    setIsShugojuModalOpen(false);
    setMainSpot(record.mainSpot ?? "");
    setSubSpot(record.subSpot ?? "");
    setIsSpotModalOpen(false);
    setMemoText(record.memoText ?? "");
    setSlots(
      [0, 1, 2, 3].map((slotIndex) => {
        const found = record.slots.find((slot) => slot.slotIndex === slotIndex);
        return {
          slotIndex,
          characterId: found?.characterId ?? "",
          fruits: found?.fruits ?? [],
          fruitGrades: normalizeFruitGradeList(found?.fruits ?? [], found?.fruitGradesList, found?.fruitGrades),
          crests: found?.crests ?? [],
          crestGrades:
            found?.crestGrades ??
            Object.fromEntries(((found?.crests ?? []) as string[]).map((name) => [name, crestDefaultGradeOf(name)])),
          slotMemo: found?.slotMemo ?? "",
        };
      })
    );
  }

  function applyShareData(payload: SharePayload) {
    setEditingId(null);
    setTitle((payload.title ?? "").trim());
    setQuestId(payload.targetQuestId ?? "");
    setQuestKeyword(payload.targetQuestName ?? "");
    setQuestFilter("");
    setAppliedQuestKeyword(payload.targetQuestName ?? "");
    setAppliedQuestFilter("");
    setHasQuestSearched(Boolean((payload.targetQuestName ?? "").trim()));
    setShugojuId(payload.shugojuId ?? "");
    setShugojuKeyword(payload.shugojuName ?? "");
    setMainSpot(payload.mainSpot ?? "");
    setSubSpot(payload.subSpot ?? "");
    setMemoText(payload.memoText ?? "");
    setActiveSlotIndex(0);
    setModalSlotIndex(null);
    setIsCharacterModalOpen(false);
    setIsFruitModalOpen(false);
    setIsCrestModalOpen(false);

    const sharedSlots = Array.isArray(payload.slots) ? payload.slots : [];
    setSlots(
      [0, 1, 2, 3].map((slotIndex) => {
        const found = sharedSlots.find((slot) => Number(slot.slotIndex ?? -1) === slotIndex);
        const fruits = Array.isArray(found?.fruits) ? found!.fruits!.slice(0, 4) : [];
        const fruitGrades = normalizeFruitGradeList(
          fruits,
          Array.isArray(found?.fruitGradesList) ? found.fruitGradesList.slice(0, 4) : undefined,
          found?.fruitGrades && typeof found.fruitGrades === "object" ? found.fruitGrades : undefined
        );
        const crests = Array.isArray(found?.crests) ? found!.crests!.slice(0, 4) : [];
        const crestGrades =
          found?.crestGrades && typeof found.crestGrades === "object"
            ? found.crestGrades
            : Object.fromEntries(crests.map((name) => [name, crestDefaultGradeOf(name)]));
        return {
          slotIndex,
          characterId: (found?.characterId ?? "").toString(),
          fruits,
          fruitGrades,
          crests,
          crestGrades,
          slotMemo: (found?.slotMemo ?? "").toString(),
        };
      })
    );
  }

  async function saveTeam() {
    const activeEditingId = editingId ?? editQueryId;
    const currentEditing = activeEditingId ? records.find((r) => r.id === activeEditingId) : null;
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
    if (!currentEditing && records.length >= TEAM_RECORD_LIMIT) {
      setMessage(`保存上限(${TEAM_RECORD_LIMIT}件)に達しているため保存できません`);
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
        fruitGradesList: slot.fruitGrades.slice(0, 4),
        fruitGrades: Object.fromEntries(slot.fruits.slice(0, 4).map((name, index) => [name, slot.fruitGrades[index] ?? "L"])),
        crests: slot.crests.slice(0, 4),
        crestGrades: Object.fromEntries(slot.crests.slice(0, 4).map((name) => [name, slot.crestGrades[name] ?? crestDefaultGradeOf(name)])),
        slotMemo: slot.slotMemo,
      };
    });

    const nextId = currentEditing?.id ?? makeId();
    const record: TeamRecord = {
      id: nextId,
      title: trimmedTitle,
      targetQuestId: selectedQuest?.id ?? null,
      targetQuestName: selectedQuest?.name ?? null,
      targetQuestIconUrl: selectedQuest?.iconUrl || null,
      shugojuId: selectedShugoju?.id ?? null,
      shugojuName: selectedShugoju?.name ?? null,
      shugojuIconUrl: selectedShugoju?.iconUrl ?? null,
      mainSpot: mainSpot || null,
      subSpot: subSpot || null,
      slots: finalSlots,
      memoText,
      createdAt: currentEditing?.createdAt ?? nowText(),
    };

    await putTeam(record);
    await refreshRecords();
    if (!currentEditing) setEditingId(nextId);
    setMessage(currentEditing ? "編成を上書き保存しました" : "編成を保存しました");
  }

  async function exportCurrentAsPng() {
    if (!exportRef.current) return;
    try {
      const node = exportRef.current;
      node.style.setProperty("--export-width", `${EXPORT_IMAGE_WIDTH_PX}px`);
      node.style.setProperty("--export-height", `${EXPORT_IMAGE_HEIGHT_PX}px`);
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
      const url = await toPng(node, { cacheBust: true, pixelRatio: 2 });
      const safeTitle = (title.trim() || "編成タイトル").replace(/[\\/:*?"<>|]/g, "_");
      const fileName = `${safeTitle}_${filenameDateText(new Date())}.png`;
      await triggerImageSave(url, fileName);
    } catch {
      setMessage("PNG出力に失敗しました。再読み込み後に再試行してください");
    }
  }

  async function createExportPngDataUrl(): Promise<string> {
    if (!exportRef.current) throw new Error("export target missing");
    const node = exportRef.current;
    node.style.setProperty("--export-width", `${EXPORT_IMAGE_WIDTH_PX}px`);
    node.style.setProperty("--export-height", `${EXPORT_IMAGE_HEIGHT_PX}px`);
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
    return toPng(node, { cacheBust: true, pixelRatio: 2 });
  }

  async function openGenerateModal() {
    setIsGenerateModalOpen(true);
    setIsPreviewLoading(true);
    try {
      const url = await createExportPngDataUrl();
      setPreviewImageUrl(url);
    } catch {
      setPreviewImageUrl("");
      setMessage("プレビュー画像の生成に失敗しました");
    } finally {
      setIsPreviewLoading(false);
    }
  }

  function saveImageFromModal() {
    try {
      if (!previewImageUrl) {
        setMessage("プレビュー生成後に再度お試しください");
        return;
      }
      const url = previewImageUrl;
      const safeTitle = (title.trim() || "編成タイトル").replace(/[\\/:*?"<>|]/g, "_");
      const fileName = `${safeTitle}_${filenameDateText(new Date())}.png`;
      void triggerImageSave(url, fileName);
      setMessage("画像保存を開始しました");
    } catch {
      setMessage("画像保存に失敗しました。再読み込み後に再試行してください");
    }
  }

  async function copyShareUrl() {
    try {
      const compactSlots: CompactShareSlot[] = slots.map((slot) => {
        const fruits = slot.fruits
          .map((name, index) => {
            const id = FRUIT_ID_BY_NAME.get(name);
            if (!id) return null;
            return (slot.fruitGrades[index] ?? "L") === "EL" ? -id : id;
          })
          .filter((v): v is number => v !== null);
        const crests = slot.crests
          .map((name) => {
            const id = CREST_ID_BY_NAME[name as keyof typeof CREST_ID_BY_NAME] ?? null;
            if (!id) return null;
            const grade = slot.crestGrades[name] ?? crestDefaultGradeOf(name);
            return id * 10 + grade;
          })
          .filter((v): v is number => v !== null);
        const tuple: CompactShareSlot = [slot.characterId, fruits, crests];
        if (slot.slotMemo.trim()) tuple.push(slot.slotMemo);
        return tuple;
      });
      const payload: CompactSharePayloadV2 = {
        v: 2,
        t: title.trim() || undefined,
        q: selectedQuest?.id || undefined,
        s: selectedShugoju?.id || undefined,
        pm: mainSpot || undefined,
        ps: subSpot || undefined,
        m: memoText.trim() || undefined,
        a: compactSlots,
      };
      const encoded = await encodeSharePayload(JSON.stringify(payload));
      const url = new URL("/TeamBuild/team", window.location.origin);
      url.searchParams.set("share", encoded);
      const text = url.toString();
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "true");
        ta.style.position = "fixed";
        ta.style.top = "-1000px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setMessage("共有URLをコピーしました");
    } catch {
      setMessage("共有URLの作成に失敗しました");
    }
  }

  async function removeRecord(id: string) {
    await deleteTeam(id);
    await refreshRecords();
    setMessage("編成を削除しました");
    if (editingId === id) resetDraft();
  }
  async function removeManagedRecord(id: string) {
    if (!id) return;
    await deleteTeam(id);
    await refreshRecords();
    setArrangeRemoveId("");
    setIsArrangeRemoveOpen(false);
    setMessage("保存データを削除しました");
  }
  function applyQuestSearch(nextQuestKeyword?: string, nextQuestFilter?: (typeof QUEST_FILTER_OPTIONS)[number] | "") {
    setAppliedQuestKeyword(nextQuestKeyword ?? questKeyword);
    setAppliedQuestFilter(nextQuestFilter ?? questFilter);
    setHasQuestSearched(true);
    setQuestListScrollTop(0);
    if (questListRef.current) questListRef.current.scrollTop = 0;
  }

  function openCharacterModal(slotIndex: number) {
    if (!isMobileViewport) return;
    setActiveSlotIndex(slotIndex);
    setModalSlotIndex(slotIndex);
    setIsCharacterModalOpen(true);
    setCharacterListScrollLeft(0);
    if (characterListRef.current) characterListRef.current.scrollLeft = 0;
  }
  function openFruitModal(slotIndex: number) {
    if (!isMobileViewport) return;
    setActiveSlotIndex(slotIndex);
    setModalSlotIndex(slotIndex);
    setIsFruitModalOpen(true);
  }
  function openCrestModal(slotIndex: number) {
    if (!isMobileViewport) return;
    setActiveSlotIndex(slotIndex);
    setModalSlotIndex(slotIndex);
    setIsCrestModalOpen(true);
  }

  const editorSlotIndex = activeSlotIndex;
  const editorSlot = slots[editorSlotIndex] ?? slots[0];
  const modalSlot = modalSlotIndex !== null ? slots.find((s) => s.slotIndex === modalSlotIndex) ?? null : null;
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
          onChange={(e) => {
            const nextValue = e.target.value;
            setNameFilter(nextValue);
            applyFilters(nextValue);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              applyFilters();
            }
          }}
          placeholder="キャラ名検索"
          style={{ minWidth: 240 }}
        />
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
        <div
          ref={characterListRef}
          className={styles.pickList}
          onScroll={(e) => setCharacterListScrollLeft(e.currentTarget.scrollLeft)}
        >
          <div style={{ width: characterVirtual.paddingLeft, flex: "0 0 auto" }} />
          {characterVirtual.visible.map((c) => (
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
          <div style={{ width: characterVirtual.paddingRight, flex: "0 0 auto" }} />
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

      <div className={styles.editorTwoCol}>
        <div className={styles.editorColumn}>
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
          {editorSlot.fruits.length > 0 ? (
            <div className={styles.selectedFruitList}>
              {editorSlot.fruits.map((fruit, idx) => {
                const grade = fruitGradeOf(editorSlot, idx);
                return (
                  <div key={`selected-editor-${editorSlotIndex}-${fruit}-${idx}`} className={`${styles.selectedFruitRow} ${styles.selectedFruitRowRemovable}`}>
                    <button
                      className={styles.removeEntryBtn}
                      type="button"
                      onClick={() => removeFruitAt(editorSlotIndex, idx)}
                      aria-label={`${fruit} を削除`}
                      title="削除"
                    >
                      ×
                    </button>
                    <img className={styles.fruitGradeIcon} src={fruitGradeIconSrc(grade)} alt={grade} />
                    <span className={styles.selectedFruitName}>{fruit}</span>
                    <button
                      className={`${styles.btn} ${styles.gradeBtn}`}
                      type="button"
                      style={{ background: grade === "L" ? "#e3f0ff" : "#fff" }}
                      onClick={() => setFruitGrade(editorSlotIndex, idx, "L")}
                    >
                      L
                    </button>
                    <button
                      className={`${styles.btn} ${styles.gradeBtn}`}
                      type="button"
                      style={{ background: grade === "EL" ? "#e3f0ff" : "#fff" }}
                      onClick={() => setFruitGrade(editorSlotIndex, idx, "EL")}
                    >
                      EL
                    </button>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className={styles.editorColumn}>
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
          {editorSlot.crests.length > 0 ? (
            <div className={styles.selectedFruitList}>
              {editorSlot.crests.map((crest) => {
                const grade = crestGradeOf(editorSlot, crest);
                const availableGrades = crestAvailableGradesOf(crest);
                return (
                  <div key={`selected-crest-editor-${editorSlotIndex}-${crest}`} className={`${styles.selectedFruitRow} ${styles.selectedFruitRowRemovable}`}>
                    <button
                      className={styles.removeEntryBtn}
                      type="button"
                      onClick={() => removeCrest(editorSlotIndex, crest)}
                      aria-label={`${crest} を削除`}
                      title="削除"
                    >
                      ×
                    </button>
                    <img className={styles.crestSkillIcon} src={crestIconSrc(crest, grade)} alt={crestLabel(crest, grade)} />
                    <span className={styles.selectedFruitName}>{crestLabel(crest, grade)}</span>
                    <div className={`${styles.crestGradeBtns} ${styles.crestGradeBtnsRemovable}`}>
                      {[0, 1, 2].map((g) => {
                        if (!availableGrades.includes(g as CrestGrade)) return null;
                        const label = g === 0 ? "無印" : g === 1 ? "上" : "極";
                        return (
                          <button
                            key={`${crest}-${g}`}
                            className={`${styles.btn} ${styles.gradeBtn} ${styles.crestGradeBtn}`}
                            type="button"
                            style={{ background: grade === g ? "#e3f0ff" : "#fff" }}
                            onClick={() => setCrestGrade(editorSlotIndex, crest, g as CrestGrade)}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
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
            </div>
            <h1 className={styles.titleText}>モンスト 編成管理ツール</h1>
          </div>
          {tab === "memo" ? (
            <div className={styles.rightGroup}>
              <button className={`${styles.btn} ${styles.primary}`} onClick={() => void saveTeam()}>保存</button>
              <button className={`${styles.btn} ${styles.searchBtn}`} onClick={() => void openGenerateModal()}>画像・URL生成</button>
              <button className={styles.btn} onClick={resetDraft}>新規作成</button>
            </div>
          ) : null}
        </div>
      </div>
      {isMenuOpen ? (
        <div className={styles.menuOverlay} onClick={() => setIsMenuOpen(false)}>
          <aside className={styles.sideMenu} onClick={(e) => e.stopPropagation()}>
            <div className={styles.sideMenuHeader}>
              <div className={styles.sideMenuTitle}>メニュー</div>
              <button type="button" className={styles.sideMenuClose} onClick={() => setIsMenuOpen(false)}>
                ×
              </button>
            </div>
            <div className={styles.sideMenuList}>
              <button
                type="button"
                className={styles.sideMenuItem}
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
                className={styles.sideMenuItem}
                data-active={tab === "arrange" ? "1" : "0"}
                onClick={() => {
                  router.push("/TeamBuild/list");
                  setIsMenuOpen(false);
                }}
              >
                編成を管理する
              </button>
              <a
                className={styles.sideMenuItem}
                href="https://marshmallow-qa.com/di9n1qu75lvijbl?t=L0oYf4&utm_medium=url_text&utm_source=promotion"
                target="_blank"
                rel="noreferrer"
                onClick={() => setIsMenuOpen(false)}
              >
                お問い合わせ
              </a>
              <Link className={styles.sideMenuItem} href="/privacy" onClick={() => setIsMenuOpen(false)}>
                プライバシーポリシー
              </Link>
            </div>
          </aside>
        </div>
      ) : null}

      {message ? <div className={styles.card}>{message}</div> : null}

      {tab === "memo" ? (
        <div className={styles.card} style={{ display: "grid", gap: 14 }}>
          <div className={styles.memoTopForm}>
            <div className={`${styles.row} ${styles.titleQuestRow}`}>
              <label className={styles.label}>編成タイトル</label>
              <input className={`${styles.input} ${styles.titleInput}`} value={title} onChange={(e) => setTitle(e.target.value)} />
              <button
                className={styles.btn}
                type="button"
                onClick={() => {
                  setHasQuestSearched(false);
                  setQuestListScrollTop(0);
                  setIsQuestModalOpen(true);
                }}
              >
                クエストを選択
              </button>
              {selectedQuest?.iconUrl ? <img className={styles.icon} src={selectedQuest.iconUrl} alt={selectedQuest.name} style={{ width: 40, height: 40 }} /> : null}
              <span className={styles.helper}>{selectedQuest?.name || "未設定"}</span>
            </div>
          </div>

          <div className={styles.twoCol}>
            <div className={styles.leftPane}>

              <div className={styles.teamSheet}>
                {slots.map((slot) => {
                  const c = slot.characterId ? charMap.get(slot.characterId) : null;
                  const fruitRows = Array.from({ length: 4 }, (_, i) => slot.fruits[i] ?? "");
                  const crestRows = Array.from({ length: 4 }, (_, i) => slot.crests[i] ?? "");
                  const fruitBonusTotals = statusBonusTotalsOf(slot);
                  const statRows = [
                    { label: "HP" as const, base: c ? c.hp : null, bonus: fruitBonusTotals.hp },
                    { label: "攻撃" as const, base: c ? c.attack : null, bonus: fruitBonusTotals.attack },
                    { label: "スピード" as const, base: c ? c.speed : null, bonus: fruitBonusTotals.speed },
                  ];

                  return (
                    <div key={slot.slotIndex} className={styles.teamRow}>
                      <div
                        role="button"
                        tabIndex={0}
                        className={styles.teamBlock}
                        data-active={activeSlotIndex === slot.slotIndex ? "1" : "0"}
                        onClick={() => setActiveSlotIndex(slot.slotIndex)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setActiveSlotIndex(slot.slotIndex);
                          }
                        }}
                      >
                        <div className={styles.teamHeader} style={{ backgroundColor: ELEMENT_HEADER_COLOR[c?.element ?? ""] }}>
                          <div className={styles.teamRank}>{SLOT_LABELS[slot.slotIndex]}</div>
                          <div className={styles.teamNameWrap}>
                            <div className={styles.teamName}>{c?.name || ""}</div>
                          </div>
                          <div className={styles.teamMetaCell}>{c?.shuzoku || ""}</div>
                          <div className={styles.teamMetaCell}>{c?.gekishu || ""}</div>
                          <div className={styles.teamMetaCell}>{c?.senkei || ""}</div>
                        </div>
                        <div className={styles.teamBody}>
                          <div
                            className={`${styles.iconCell} ${styles.clickableArea} ${c?.iconUrl ? "" : styles.iconCellEmpty}`}
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              if (isMobileViewport) {
                                e.stopPropagation();
                                openCharacterModal(slot.slotIndex);
                              } else {
                                setActiveSlotIndex(slot.slotIndex);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                if (isMobileViewport) {
                                  e.stopPropagation();
                                  openCharacterModal(slot.slotIndex);
                                } else {
                                  setActiveSlotIndex(slot.slotIndex);
                                }
                              }
                            }}
                          >
                            {c?.iconUrl ? (
                              <img className={styles.sheetIcon} src={c.iconUrl} alt={c.name} />
                            ) : (
                              <span className={styles.sheetSelectText}>キャラを選択</span>
                            )}
                          </div>
                          <div className={styles.detailWrap}>
                            <div className={styles.statsGrid}>
                              {statRows.map((stat) => (
                                <Fragment key={`${slot.slotIndex}-${stat.label}`}>
                                  <div className={styles.statLabel}>{stat.label}</div>
                                  <div className={styles.statValue}>
                                    <span className={styles.statValueWrap}>
                                      <span>{formatStatValue(stat.label, stat.base === null ? null : stat.base + stat.bonus)}</span>
                                      {stat.label === "攻撃" && c?.hasGauge ? (
                                        <span className={styles.gaugeValueWrap}>
                                          <span className={styles.gaugeDivider}>/</span>
                                          <span>{formatGaugeAttackValue(stat.base === null ? null : stat.base + stat.bonus, true)}</span>
                                          <img className={styles.gaugeIcon} src="/icon/icon_ゲージ.png" alt="ゲージ" />
                                        </span>
                                      ) : null}
                                    </span>
                                  </div>
                                  <div className={styles.statBonus}>{formatStatBonus(stat.label, stat.bonus, Boolean(c))}</div>
                                </Fragment>
                              ))}
                            </div>
                            <div className={styles.detailTable}>
                              {fruitRows.map((fruit, idx) => (
                                <Fragment key={`${slot.slotIndex}-row-${idx}`}>
                                  <div
                                    className={`${styles.tableCell} ${styles.clickableArea} ${fruit ? "" : styles.tableCellEmpty} ${
                                      !fruit && idx === 0 && slot.fruits.length === 0 ? styles.cellPlaceholder : ""
                                    }`}
                                    onClick={(e) => {
                                      if (isMobileViewport) {
                                        e.stopPropagation();
                                        openFruitModal(slot.slotIndex);
                                      } else {
                                        setActiveSlotIndex(slot.slotIndex);
                                      }
                                    }}
                                  >
                                    {fruit ? (
                                      <span className={styles.fruitCellContent}>
                                        <img className={styles.fruitGradeIcon} src={fruitGradeIconSrc(fruitGradeOf(slot, idx))} alt={fruitGradeOf(slot, idx)} />
                                        <span>{fruit}</span>
                                      </span>
                                    ) : idx === 0 && slot.fruits.length === 0 && isMobileViewport ? "タップして実を選択" : "　"}
                                  </div>
                                  <div
                                    className={`${styles.tableCell} ${styles.clickableArea} ${crestRows[idx] ? "" : styles.tableCellEmpty} ${
                                      !crestRows[idx] && idx === 0 && slot.crests.length === 0 ? styles.cellPlaceholder : ""
                                    }`}
                                    onClick={(e) => {
                                      if (isMobileViewport) {
                                        e.stopPropagation();
                                        openCrestModal(slot.slotIndex);
                                      } else {
                                        setActiveSlotIndex(slot.slotIndex);
                                      }
                                    }}
                                  >
                                    {crestRows[idx] ? (
                                      <span className={styles.fruitCellContent}>
                                        <img
                                          className={styles.crestSkillIcon}
                                          src={crestIconSrc(crestRows[idx], crestGradeOf(slot, crestRows[idx]))}
                                          alt={crestLabel(crestRows[idx], crestGradeOf(slot, crestRows[idx]))}
                                        />
                                        <span>{crestLabel(crestRows[idx], crestGradeOf(slot, crestRows[idx]))}</span>
                                      </span>
                                    ) : idx === 0 && slot.crests.length === 0 && isMobileViewport ? "タップしてソウルスキルを選択" : "　"}
                                  </div>
                                </Fragment>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className={styles.slotMemoCell}>
                          <div className={styles.slotMemoLabel}>備考</div>
                          <input
                            className={`${styles.input} ${styles.slotMemoInput}`}
                            value={slot.slotMemo}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                            onChange={(e) => setSlotMemo(slot.slotIndex, e.target.value)}
                            placeholder="備考を入力"
                          />
                        </div>
                      </div>
                        <div className={styles.slotMoveBtns}>
                        <button
                          className={`${styles.slotMoveBtn} ${styles.slotClearActionBtn}`}
                          type="button"
                          onClick={() => clearSlot(slot.slotIndex)}
                          aria-label={`${SLOT_LABELS[slot.slotIndex]}を解除`}
                          title="解除"
                        >
                          ×
                        </button>
                        <button
                          className={styles.slotMoveBtn}
                          type="button"
                          onClick={() => moveDraftSlot(slot.slotIndex, slot.slotIndex - 1)}
                          disabled={slot.slotIndex === 0}
                          aria-label={`${SLOT_LABELS[slot.slotIndex]}を上へ移動`}
                        >
                          ↑
                        </button>
                        <button
                          className={styles.slotMoveBtn}
                          type="button"
                          onClick={() => moveDraftSlot(slot.slotIndex, slot.slotIndex + 1)}
                          disabled={slot.slotIndex === 3}
                          aria-label={`${SLOT_LABELS[slot.slotIndex]}を下へ移動`}
                        >
                          ↓
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>

            {renderEditorPane(styles.rightPane)}
          </div>
          <div>
                <div className={styles.supportRow}>
              <button
                className={styles.btn}
                type="button"
                onClick={() => {
                  setShugojuListScrollTop(0);
                  setIsShugojuModalOpen(true);
                }}
              >
                守護獣を選択
              </button>
              {selectedShugoju?.iconUrl ? (
                <img className={styles.icon} src={selectedShugoju.iconUrl} alt={selectedShugoju.name} style={{ width: 32, height: 32 }} />
              ) : null}
              <button className={styles.btn} type="button" onClick={() => setIsSpotModalOpen(true)}>
                スポットを選択
              </button>
              {mainSpot ? <img className={styles.icon} src={spotIconSrc(mainSpot, "main")} alt={`${mainSpot}メイン`} style={{ width: 32, height: 32 }} /> : null}
              {subSpot ? <img className={styles.icon} src={spotIconSrc(subSpot, "sub")} alt={`${subSpot}サブ`} style={{ width: 32, height: 32 }} /> : null}
            </div>
          </div>
          <div>
            <textarea
              className={styles.memoTextarea}
              value={memoText}
              onChange={(e) => setMemoText(e.target.value)}
              placeholder="メモ"
            />
          </div>
          {isCharacterModalOpen && modalSlot ? (
            <div className={`${styles.arrangeOverlay} ${styles.topAlignedOverlay}`} onClick={() => setIsCharacterModalOpen(false)}>
              <div className={styles.arrangeDialog} onClick={(e) => e.stopPropagation()}>
                <div className={styles.label}>{modalSlot.slotIndex + 1}体目 キャラ選択</div>
                <div className={styles.row}>
                  <input
                    className={styles.input}
                    value={nameFilter}
                    onChange={(e) => {
                      const nextValue = e.target.value;
                      setNameFilter(nextValue);
                      applyFilters(nextValue);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        applyFilters();
                      }
                    }}
                    placeholder="キャラ名検索"
                  />
                  <button className={styles.btn} type="button" onClick={resetFilters}>リセット</button>
                </div>
                {hasSearched ? (
                  <div
                    ref={characterListRef}
                    className={styles.pickList}
                    onScroll={(e) => setCharacterListScrollLeft(e.currentTarget.scrollLeft)}
                  >
                    <div style={{ width: characterVirtual.paddingLeft, flex: "0 0 auto" }} />
                    {characterVirtual.visible.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className={styles.pickItem}
                        onClick={() => {
                          updateSlot(modalSlot.slotIndex, { characterId: c.id });
                          setIsCharacterModalOpen(false);
                          setHasSearched(false);
                        }}
                      >
                        <img className={styles.pickItemImg} src={c.iconUrl} alt={c.name} />
                        <span>{c.name}</span>
                      </button>
                    ))}
                    <div style={{ width: characterVirtual.paddingRight, flex: "0 0 auto" }} />
                    {filteredCharacters.length === 0 ? <div className={styles.helper}>該当キャラがいません</div> : null}
                  </div>
                ) : null}
                <div className={styles.row} style={{ justifyContent: "flex-end" }}>
                  <button className={styles.btn} type="button" onClick={() => setIsCharacterModalOpen(false)}>閉じる</button>
                </div>
              </div>
            </div>
          ) : null}
          {isFruitModalOpen && modalSlot ? (
            <div className={styles.arrangeOverlay} onClick={() => setIsFruitModalOpen(false)}>
              <div className={`${styles.arrangeDialog} ${styles.fruitDialog}`} onClick={(e) => e.stopPropagation()}>
                <div className={styles.label}>{modalSlot.slotIndex + 1}体目 わくわくの実</div>
                <div className={styles.row}>
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
                      style={{ background: modalSlot.fruits.includes(option.name) ? "#e3f0ff" : "#fff" }}
                      onClick={() => toggleOption(modalSlot.slotIndex, "fruits", option.name, 4)}
                    >
                      {option.name}
                    </button>
                  ))}
                </div>
                <div className={`${styles.selectedFruitList} ${styles.modalSelectedFruitList}`}>
                  {modalSlot.fruits.map((fruit, idx) => {
                    const grade = fruitGradeOf(modalSlot, idx);
                    return (
                      <div key={`selected-modal-${modalSlot.slotIndex}-${fruit}-${idx}`} className={`${styles.selectedFruitRow} ${styles.selectedFruitRowRemovable}`}>
                        <button
                          className={styles.removeEntryBtn}
                          type="button"
                          onClick={() => removeFruitAt(modalSlot.slotIndex, idx)}
                          aria-label={`${fruit} を削除`}
                          title="削除"
                        >
                          ×
                        </button>
                        <img className={styles.fruitGradeIcon} src={fruitGradeIconSrc(grade)} alt={grade} />
                        <span className={styles.selectedFruitName}>{fruit}</span>
                        <button
                          className={`${styles.btn} ${styles.gradeBtn}`}
                          type="button"
                          style={{ background: grade === "L" ? "#e3f0ff" : "#fff" }}
                          onClick={() => setFruitGrade(modalSlot.slotIndex, idx, "L")}
                        >
                          L
                        </button>
                        <button
                          className={`${styles.btn} ${styles.gradeBtn}`}
                          type="button"
                          style={{ background: grade === "EL" ? "#e3f0ff" : "#fff" }}
                          onClick={() => setFruitGrade(modalSlot.slotIndex, idx, "EL")}
                        >
                          EL
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className={styles.row} style={{ justifyContent: "flex-end" }}>
                  <button className={styles.btn} type="button" onClick={() => setIsFruitModalOpen(false)}>閉じる</button>
                </div>
              </div>
            </div>
          ) : null}
          {isCrestModalOpen && modalSlot ? (
            <div className={styles.arrangeOverlay} onClick={() => setIsCrestModalOpen(false)}>
              <div className={styles.arrangeDialog} onClick={(e) => e.stopPropagation()}>
                <div className={styles.label}>{modalSlot.slotIndex + 1}体目 紋章</div>
                <div className={`${styles.row} ${styles.optionGrid}`}>
                  {CREST_OPTIONS.map((value) => (
                    <button
                      key={value}
                      className={`${styles.btn} ${styles.optionBtn}`}
                      type="button"
                      style={{ background: modalSlot.crests.includes(value) ? "#e3f0ff" : "#fff" }}
                      onClick={() => toggleOption(modalSlot.slotIndex, "crests", value, 4)}
                    >
                      {value}
                    </button>
                  ))}
                </div>
                <div className={`${styles.selectedFruitList} ${styles.modalSelectedFruitList}`}>
                  {modalSlot.crests.map((crest) => {
                    const grade = crestGradeOf(modalSlot, crest);
                    const availableGrades = crestAvailableGradesOf(crest);
                    return (
                      <div key={`selected-crest-modal-${modalSlot.slotIndex}-${crest}`} className={`${styles.selectedFruitRow} ${styles.selectedFruitRowRemovable}`}>
                        <button
                          className={styles.removeEntryBtn}
                          type="button"
                          onClick={() => removeCrest(modalSlot.slotIndex, crest)}
                          aria-label={`${crest} を削除`}
                          title="削除"
                        >
                          ×
                        </button>
                        <img className={styles.crestSkillIcon} src={crestIconSrc(crest, grade)} alt={crestLabel(crest, grade)} />
                        <span className={styles.selectedFruitName}>{crestLabel(crest, grade)}</span>
                        <div className={`${styles.crestGradeBtns} ${styles.crestGradeBtnsRemovable}`}>
                          {[0, 1, 2].map((g) => {
                            if (!availableGrades.includes(g as CrestGrade)) return null;
                            const label = g === 0 ? "無印" : g === 1 ? "上" : "極";
                            return (
                              <button
                                key={`${crest}-${g}`}
                                className={`${styles.btn} ${styles.gradeBtn} ${styles.crestGradeBtn}`}
                                type="button"
                                style={{ background: grade === g ? "#e3f0ff" : "#fff" }}
                                onClick={() => setCrestGrade(modalSlot.slotIndex, crest, g as CrestGrade)}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className={styles.row} style={{ justifyContent: "flex-end" }}>
                  <button className={styles.btn} type="button" onClick={() => setIsCrestModalOpen(false)}>閉じる</button>
                </div>
              </div>
            </div>
          ) : null}
          {isQuestModalOpen ? (
            <div className={`${styles.arrangeOverlay} ${styles.topAlignedOverlay}`} onClick={() => setIsQuestModalOpen(false)}>
              <div className={`${styles.arrangeDialog} ${styles.questDialog}`} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalTopRow}>
                  <div className={styles.label}>クエストを選択</div>
                  <div className={styles.modalTopActions}>
                    <button
                      className={styles.btn}
                      type="button"
                      onClick={() => {
                        setQuestId("");
                        setQuestKeyword("");
                        setQuestFilter("");
                        setHasQuestSearched(false);
                        setIsQuestModalOpen(false);
                      }}
                    >
                      未設定
                    </button>
                    <button className={styles.btn} type="button" onClick={() => setIsQuestModalOpen(false)}>閉じる</button>
                  </div>
                </div>
                <div className={styles.questSearchRow}>
                  <input
                    className={`${styles.input} ${styles.questSearchInput}`}
                    value={questKeyword}
                    onChange={(e) => {
                      const nextValue = e.target.value;
                      setQuestKeyword(nextValue);
                      applyQuestSearch(nextValue, questFilter);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        applyQuestSearch();
                      }
                    }}
                    placeholder="ボスを検索"
                  />
                </div>
                <div className={styles.questFilterGrid}>
                  {QUEST_FILTER_OPTIONS.map((value) => (
                    <button
                      key={value}
                      className={styles.btn}
                      type="button"
                      style={{ background: questFilter === value ? "#e3f0ff" : "#fff" }}
                      onClick={() => {
                        setQuestFilter((prev) => {
                          const next = prev === value ? "" : value;
                          applyQuestSearch(questKeyword, next);
                          return next;
                        });
                      }}
                    >
                      {value}
                    </button>
                  ))}
                </div>
                {hasQuestSearched ? (
                  <div
                    ref={questListRef}
                    className={styles.questPickList}
                    onScroll={(e) => setQuestListScrollTop(e.currentTarget.scrollTop)}
                  >
                    <div style={{ height: questVirtual.paddingTop }} />
                    <div className={styles.questPickGrid}>
                      {questVirtual.visible.map((q) => (
                        <button
                          key={q.id}
                          type="button"
                          className={styles.questPickItem}
                          onClick={() => {
                            setQuestId(q.id);
                            setQuestKeyword(q.name);
                            setHasQuestSearched(false);
                            setQuestListScrollTop(0);
                            setIsQuestModalOpen(false);
                          }}
                        >
                          {q.iconUrl ? <img className={styles.questPickIcon} src={q.iconUrl} alt={q.name} /> : null}
                          <span>{q.name}</span>
                        </button>
                      ))}
                    </div>
                    <div style={{ height: questVirtual.paddingBottom }} />
                    {filteredQuests.length === 0 ? <div className={styles.helper}>該当クエストがありません</div> : null}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
          {isShugojuModalOpen ? (
            <div className={`${styles.arrangeOverlay} ${styles.topAlignedOverlay}`} onClick={() => setIsShugojuModalOpen(false)}>
              <div className={styles.arrangeDialog} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalTopRow}>
                  <div className={styles.label}>守護獣を選択</div>
                  <div className={styles.modalTopActions}>
                    <button
                      className={styles.btn}
                      type="button"
                      onClick={() => {
                        setShugojuId("");
                        setShugojuKeyword("");
                        setIsShugojuModalOpen(false);
                      }}
                    >
                      未設定
                    </button>
                    <button className={styles.btn} type="button" onClick={() => setIsShugojuModalOpen(false)}>閉じる</button>
                  </div>
                </div>
                <input
                  className={styles.input}
                  value={shugojuKeyword}
                  onChange={(e) => setShugojuKeyword(e.target.value)}
                  placeholder="守護獣名検索"
                />
                <div
                  className={styles.shugojuList}
                  ref={shugojuListRef}
                  onScroll={(e) => setShugojuListScrollTop(e.currentTarget.scrollTop)}
                >
                  <div style={{ height: shugojuVirtual.paddingTop }} />
                  <div className={styles.shugojuGrid}>
                    {shugojuVirtual.visible.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className={styles.shugojuItem}
                        onClick={() => {
                          setShugojuId(s.id);
                          setShugojuKeyword(s.name);
                          setIsShugojuModalOpen(false);
                        }}
                      >
                        {s.iconUrl ? <img className={styles.shugojuIcon} src={s.iconUrl} alt={s.name} /> : null}
                        <span>{s.name}</span>
                      </button>
                    ))}
                  </div>
                  <div style={{ height: shugojuVirtual.paddingBottom }} />
                  {filteredShugojus.length === 0 ? <div className={styles.helper}>該当する守護獣がありません</div> : null}
                </div>
              </div>
            </div>
          ) : null}
          {isSpotModalOpen ? (
            <div className={`${styles.arrangeOverlay} ${styles.topAlignedOverlay}`} onClick={() => setIsSpotModalOpen(false)}>
              <div className={styles.arrangeDialog} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalTopRow}>
                  <div className={styles.label}>スポットを選択</div>
                  <div className={styles.modalTopActions}>
                    <button
                      className={styles.btn}
                      type="button"
                      onClick={() => {
                        setMainSpot("");
                        setSubSpot("");
                      }}
                    >
                      未設定
                    </button>
                    <button className={styles.btn} type="button" onClick={() => setIsSpotModalOpen(false)}>閉じる</button>
                  </div>
                </div>
                <div className={styles.spotSection}>
                  <div className={styles.helper}>メインスポット</div>
                  <div className={styles.spotGrid}>
                    {SPOT_OPTIONS.map((spot) => (
                      <button
                        key={`main-${spot}`}
                        type="button"
                        className={styles.spotItem}
                        data-selected={mainSpot === spot ? "1" : "0"}
                        onClick={() => setMainSpot((prev) => (prev === spot ? "" : spot))}
                      >
                        <img className={styles.spotIcon} src={spotIconSrc(spot, "main")} alt={`${spot}メイン`} />
                        <span>{spot}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className={styles.spotSection}>
                  <div className={styles.helper}>サブスポット</div>
                  <div className={styles.spotGrid}>
                    {SPOT_OPTIONS.map((spot) => (
                      <button
                        key={`sub-${spot}`}
                        type="button"
                        className={styles.spotItem}
                        data-selected={subSpot === spot ? "1" : "0"}
                        onClick={() => setSubSpot((prev) => (prev === spot ? "" : spot))}
                      >
                        <img className={styles.spotIcon} src={spotIconSrc(spot, "sub")} alt={`${spot}サブ`} />
                        <span>{spot}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          {isGenerateModalOpen ? (
            <div className={styles.arrangeOverlay} onClick={() => setIsGenerateModalOpen(false)}>
              <div className={`${styles.arrangeDialog} ${styles.generateDialog}`} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalTopRow}>
                  <div className={styles.modalTopActions}>
                    <button className={styles.btn} type="button" onClick={saveImageFromModal} disabled={isPreviewLoading}>
                      画像保存
                    </button>
                    <button className={`${styles.btn} ${styles.searchBtn}`} type="button" onClick={() => void copyShareUrl()}>URLコピー</button>
                  </div>
                  <button className={styles.btn} type="button" onClick={() => setIsGenerateModalOpen(false)}>閉じる</button>
                </div>
                <div className={styles.previewWrap}>
                  {isPreviewLoading ? (
                    <div className={styles.helper}>プレビュー生成中...</div>
                  ) : previewImageUrl ? (
                    <img className={styles.previewImage} src={previewImageUrl} alt="PNGプレビュー" />
                  ) : (
                    <div className={styles.helper}>プレビューを表示できませんでした</div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
          <div className={styles.exportCapture} aria-hidden="true">
            <div ref={exportRef} className={styles.exportSheet}>
              <div className={styles.exportHeader}>
                <div className={styles.exportTitleGroup}>
                  {selectedQuest?.iconUrl ? (
                    <img className={styles.exportQuestIcon} src={selectedQuest.iconUrl} alt={selectedQuest.name} />
                  ) : null}
                  <div className={styles.exportTitle}>{title.trim() || "編成"}</div>
                </div>
                <div className={styles.exportHeaderIcons}>
                  {mainSpot ? <img className={styles.exportSpotIcon} src={spotIconSrc(mainSpot, "main")} alt={`${mainSpot}メイン`} /> : null}
                  {subSpot ? <img className={styles.exportSpotIcon} src={spotIconSrc(subSpot, "sub")} alt={`${subSpot}サブ`} /> : null}
                  {selectedShugoju?.iconUrl ? (
                    <img className={styles.exportShugojuIcon} src={selectedShugoju.iconUrl} alt={selectedShugoju.name} />
                  ) : null}
                </div>
              </div>
              <div className={styles.exportTeamSheet}>
                {exportColumns.map((columnSlots, columnIndex) => (
                  <div key={`export-column-${columnIndex}`} className={styles.exportTeamColumn}>
                    {columnSlots.map((slot) => {
                      const c = slot.characterId ? charMap.get(slot.characterId) : null;
                      const fruitRows = Array.from({ length: 4 }, (_, i) => slot.fruits[i] ?? "");
                      const crestRows = Array.from({ length: 4 }, (_, i) => slot.crests[i] ?? "");
                      const fruitBonusTotals = statusBonusTotalsOf(slot);
                      const statRows = [
                        { label: "HP" as const, base: c ? c.hp : null, bonus: fruitBonusTotals.hp },
                        { label: "攻撃" as const, base: c ? c.attack : null, bonus: fruitBonusTotals.attack },
                        { label: "スピード" as const, base: c ? c.speed : null, bonus: fruitBonusTotals.speed },
                      ];
                      return (
                        <div key={`export-${slot.slotIndex}`} className={styles.teamBlock}>
                          <div className={styles.teamHeader} style={{ backgroundColor: ELEMENT_HEADER_COLOR[c?.element ?? ""] }}>
                            <div className={styles.teamRank}>{SLOT_LABELS[slot.slotIndex]}</div>
                          <div className={styles.teamNameWrap}>
                            <div className={styles.teamName}>{c?.name || ""}</div>
                          </div>
                          <div className={styles.teamMetaCell}>{c?.shuzoku || ""}</div>
                          <div className={styles.teamMetaCell}>{c?.gekishu || ""}</div>
                          <div className={styles.teamMetaCell}>{c?.senkei || ""}</div>
                        </div>
                          <div className={styles.teamBody}>
                            <div className={styles.iconCell}>
                              {c?.iconUrl ? (
                                <img className={styles.sheetIcon} src={c.iconUrl} alt={c.name} />
                              ) : (
                                <span className={styles.sheetSelectText}>選択</span>
                              )}
                            </div>
                            <div className={styles.detailWrap}>
                              <div className={styles.statsGrid}>
                                {statRows.map((stat) => (
                                  <Fragment key={`export-${slot.slotIndex}-${stat.label}`}>
                                    <div className={styles.statLabel}>{stat.label}</div>
                                    <div className={styles.statValue}>
                                      <span className={styles.statValueWrap}>
                                        <span>{formatStatValue(stat.label, stat.base === null ? null : stat.base + stat.bonus)}</span>
                                        {stat.label === "攻撃" && c?.hasGauge ? (
                                          <span className={styles.gaugeValueWrap}>
                                            <span className={styles.gaugeDivider}>/</span>
                                            <span>{formatGaugeAttackValue(stat.base === null ? null : stat.base + stat.bonus, true)}</span>
                                            <img className={styles.gaugeIcon} src="/icon/icon_ゲージ.png" alt="ゲージ" />
                                          </span>
                                        ) : null}
                                      </span>
                                    </div>
                                    <div className={styles.statBonus}>{formatStatBonus(stat.label, stat.bonus, Boolean(c))}</div>
                                  </Fragment>
                                ))}
                              </div>
                              <div className={styles.detailTable}>
                                {fruitRows.map((fruit, idx) => (
                                  <Fragment key={`export-${slot.slotIndex}-row-${idx}`}>
                                    <div className={`${styles.tableCell} ${fruit ? "" : styles.tableCellEmpty}`}>
                                      {fruit ? (
                                        <span className={styles.fruitCellContent}>
                                          <img className={styles.fruitGradeIcon} src={fruitGradeIconSrc(fruitGradeOf(slot, idx))} alt={fruitGradeOf(slot, idx)} />
                                          <span>{fruit}</span>
                                        </span>
                                      ) : "　"}
                                    </div>
                                    <div className={`${styles.tableCell} ${crestRows[idx] ? "" : styles.tableCellEmpty}`}>
                                      {crestRows[idx] ? (
                                        <span className={styles.fruitCellContent}>
                                          <img
                                            className={styles.crestSkillIcon}
                                            src={crestIconSrc(crestRows[idx], crestGradeOf(slot, crestRows[idx]))}
                                            alt={crestLabel(crestRows[idx], crestGradeOf(slot, crestRows[idx]))}
                                          />
                                          <span>{crestLabel(crestRows[idx], crestGradeOf(slot, crestRows[idx]))}</span>
                                        </span>
                                      ) : "　"}
                                    </div>
                                  </Fragment>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className={styles.slotMemoCell}>
                            <div className={styles.slotMemoLabel}>備考</div>
                            <div className={styles.slotMemoText}>{slot.slotMemo || " "}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className={styles.exportMemoBlock}>
                <div className={styles.exportMemoTitle}>メモ</div>
                <div className={styles.exportMemo}>{memoText || " "}</div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {tab === "arrange" ? (
        <div className={styles.card} style={{ display: "grid", gap: 10 }}>
          <div className={styles.row}>
            <div className={styles.label}>編成を管理する (最大{TEAM_RECORD_LIMIT}件)</div>
            <button className={styles.btn} type="button" onClick={() => setIsArrangeRemoveOpen(true)} disabled={arrangedRecords.length === 0}>
              削除
            </button>
            <span className={styles.helper}>{arrangedRecords.length}/{TEAM_RECORD_LIMIT}件</span>
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
                    {record.shugojuIconUrl ? (
                      <img
                        className={styles.arrangeShugojuIcon}
                        src={record.shugojuIconUrl}
                        alt={record.shugojuName || "守護獣"}
                        title={record.shugojuName || "守護獣"}
                      />
                    ) : null}
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
          {arrangedRecords.length === 0 ? <div className={styles.helper}>保存データがありません</div> : null}
          {isArrangeRemoveOpen ? (
            <div className={styles.arrangeOverlay} onClick={() => setIsArrangeRemoveOpen(false)}>
              <div className={styles.arrangeDialog} onClick={(e) => e.stopPropagation()}>
                <div className={styles.label}>保存データから削除する編成を選択</div>
                <select className={styles.select} value={arrangeRemoveId} onChange={(e) => setArrangeRemoveId(e.target.value)}>
                  <option value="">選択してください</option>
                  {arrangedRecords.map((record) => (
                    <option key={record.id} value={record.id}>{record.title}</option>
                  ))}
                </select>
                <div className={styles.row} style={{ justifyContent: "flex-end" }}>
                  <button className={styles.btn} type="button" onClick={() => setIsArrangeRemoveOpen(false)}>閉じる</button>
                  <button className={styles.btn} type="button" onClick={() => void removeManagedRecord(arrangeRemoveId)} disabled={!arrangeRemoveId}>削除</button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}


