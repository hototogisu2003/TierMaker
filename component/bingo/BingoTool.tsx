"use client";

import Link from "next/link";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toBlob } from "html-to-image";
import Button from "@/component/ui/button";
import Input from "@/component/ui/Input";
import { BINGO_GRID_SIZE, validateBingoSubmissionPayload } from "@/lib/bingo/shared";
import {
  BINGO_ELEMENTS,
  BINGO_FORMS,
  BINGO_TARGET_GACHAS,
  type BingoCharacterSummary,
  type BingoElement,
  type BingoForm,
  type BingoGacha,
} from "@/lib/bingo/types";
import styles from "./BingoTool.module.css";

type NoticeTone = "info" | "warn" | "error";

type CharacterResponse = {
  characters?: BingoCharacterSummary[];
  nextOffset?: number;
  hasMore?: boolean;
  message?: string;
};

type SubmissionResponse = {
  stored?: boolean;
  message?: string;
};

type BoardPointerDrag = {
  sourceIndex: number;
  pointerId: number;
  startX: number;
  startY: number;
  isDragging: boolean;
};

const STORAGE_KEY = "bingo:draft:v1";
const PICKER_PAGE_SIZE = 36;
const VIRTUAL_ITEM_WIDTH = 90;
const VIRTUAL_ITEM_HEIGHT = 109;
const VIRTUAL_GAP = 10;
const VIRTUAL_OVERSCAN_ROWS = 1;

function createEmptyBoard(): Array<BingoCharacterSummary | null> {
  return Array.from({ length: BINGO_GRID_SIZE }, () => null);
}

function normalizeStoredBoard(input: unknown): Array<BingoCharacterSummary | null> {
  if (!Array.isArray(input)) return createEmptyBoard();
  return createEmptyBoard().map((_, index) => {
    const entry = input[index];
    if (!entry || typeof entry !== "object") return null;
    const id = String((entry as { id?: unknown }).id ?? "").trim();
    const name = String((entry as { name?: unknown }).name ?? "").trim();
    const iconUrl = String((entry as { iconUrl?: unknown }).iconUrl ?? "").trim();
    if (!id || !name || !iconUrl) return null;
    return {
      id,
      name,
      nameKana: String((entry as { nameKana?: unknown }).nameKana ?? "").trim(),
      iconUrl,
    };
  });
}

function readStoredBoard(): Array<BingoCharacterSummary | null> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalizeStoredBoard(JSON.parse(raw));
  } catch {
    return null;
  }
}

function writeStoredBoard(board: Array<BingoCharacterSummary | null>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(board));
  } catch {
    // ignore localStorage write failures
  }
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function waitForImages(container: HTMLElement, timeoutMs = 8000) {
  const images = Array.from(container.querySelectorAll("img"));
  if (images.length === 0) return;

  await Promise.race([
    Promise.all(
      images.map(async (img) => {
        if (img.complete && img.naturalWidth > 0) {
          if ("decode" in img) {
            try {
              await img.decode();
            } catch {
              // ignore image decode failures
            }
          }
          return;
        }

        await new Promise<void>((resolve) => {
          const done = () => {
            img.removeEventListener("load", done);
            img.removeEventListener("error", done);
            resolve();
          };
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
        });
      })
    ),
    delay(timeoutMs),
  ]);
}

function fileNameDateText(date: Date): string {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}_${String(
    date.getHours()
  ).padStart(2, "0")}${String(date.getMinutes()).padStart(2, "0")}`;
}

async function createBoardBlob(node: HTMLElement) {
  await waitForImages(node);
  if ("fonts" in document) {
    try {
      await (document as Document & { fonts: { ready: Promise<unknown> } }).fonts.ready;
    } catch {
      // ignore font readiness failures
    }
  }
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  return toBlob(node, {
    cacheBust: true,
    pixelRatio: 3,
    backgroundColor: "#f8fafc",
  });
}

function CharacterTile({ character }: { character: BingoCharacterSummary }) {
  return (
    <>
      <img className={styles.characterIcon} src={character.iconUrl} alt={character.name} />
      <span className={styles.characterName}>{character.name}</span>
    </>
  );
}

function BoardCharacterTile({ character }: { character: BingoCharacterSummary }) {
  return <img className={styles.boardCharacterIcon} src={character.iconUrl} alt={character.name} draggable={false} />;
}

function CharacterPicker({
  selectedIds,
  currentCharacterId,
  onSelect,
  onClose,
}: {
  selectedIds: Set<string>;
  currentCharacterId: string;
  onSelect: (character: BingoCharacterSummary) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedElements, setSelectedElements] = useState<Set<BingoElement>>(() => new Set());
  const [selectedGachas, setSelectedGachas] = useState<Set<BingoGacha>>(() => new Set());
  const [selectedForms, setSelectedForms] = useState<Set<BingoForm>>(() => new Set());
  const [appliedElements, setAppliedElements] = useState<BingoElement[]>([]);
  const [appliedGachas, setAppliedGachas] = useState<BingoGacha[]>([]);
  const [appliedForms, setAppliedForms] = useState<BingoForm[]>([]);
  const [results, setResults] = useState<BingoCharacterSummary[]>([]);
  const [nextOffset, setNextOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [viewport, setViewport] = useState({ width: 0, height: 0, scrollTop: 0 });
  const bodyRef = useRef<HTMLDivElement>(null);

  const columns = Math.max(1, Math.floor((viewport.width + VIRTUAL_GAP) / (VIRTUAL_ITEM_WIDTH + VIRTUAL_GAP)));
  const rowHeight = VIRTUAL_ITEM_HEIGHT + VIRTUAL_GAP;
  const rowCount = Math.ceil(results.length / columns);
  const totalHeight = Math.max(0, rowCount * rowHeight - VIRTUAL_GAP);
  const startRow = Math.max(0, Math.floor(viewport.scrollTop / rowHeight) - VIRTUAL_OVERSCAN_ROWS);
  const endRow = Math.min(
    Math.max(0, rowCount - 1),
    Math.ceil((viewport.scrollTop + viewport.height) / rowHeight) + VIRTUAL_OVERSCAN_ROWS
  );
  const startIndex = startRow * columns;
  const endIndex = Math.min(results.length, (endRow + 1) * columns);
  const visibleResults = results.slice(startIndex, endIndex);
  const filterCount = appliedElements.length + appliedGachas.length + appliedForms.length;

  const loadPage = useMemo(() => {
    return async (params: {
      reset: boolean;
      queryValue: string;
      offsetValue: number;
      elements?: BingoElement[];
      gachas?: BingoGacha[];
      forms?: BingoForm[];
      signal?: AbortSignal;
    }) => {
      setIsLoading(true);
      setSearchError("");
      try {
        const nextElements = params.elements ?? appliedElements;
        const nextGachas = params.gachas ?? appliedGachas;
        const nextForms = params.forms ?? appliedForms;
        const requestParams = new URLSearchParams();
        requestParams.set("query", params.queryValue.trim());
        requestParams.set("limit", String(PICKER_PAGE_SIZE));
        requestParams.set("offset", String(params.offsetValue));
        if (nextElements.length > 0) {
          requestParams.set("elements", nextElements.join(","));
        }
        if (nextGachas.length > 0) {
          requestParams.set("gachas", nextGachas.join(","));
        }
        if (nextForms.length > 0) {
          requestParams.set("forms", nextForms.join(","));
        }
        const response = await fetch(`/api/bingo/characters?${requestParams.toString()}`, {
          cache: "no-store",
          signal: params.signal,
        });
        const data = (await response.json()) as CharacterResponse;
        if (!response.ok) {
          throw new Error(data.message ?? "キャラクター検索に失敗しました");
        }
        setResults((current) => {
          const merged = params.reset ? [] : current.slice();
          const seen = new Set(merged.map((character) => character.id));
          const seenNames = new Set(merged.map((character) => character.name));
          for (const character of data.characters ?? []) {
            if (!seen.has(character.id) && !seenNames.has(character.name)) {
              merged.push(character);
              seen.add(character.id);
              seenNames.add(character.name);
            }
          }
          return merged;
        });
        setNextOffset(data.nextOffset ?? params.offsetValue + (data.characters?.length ?? 0));
        setHasMore(Boolean(data.hasMore));
      } catch (error) {
        if ((error as { name?: string }).name === "AbortError") return;
        setSearchError(error instanceof Error ? error.message : "キャラクター検索に失敗しました");
      } finally {
        setIsLoading(false);
      }
    };
  }, [appliedElements, appliedForms, appliedGachas]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setResults([]);
      setNextOffset(0);
      setHasMore(true);
      if (bodyRef.current) bodyRef.current.scrollTop = 0;
      await loadPage({ reset: true, queryValue: query, offsetValue: 0, signal: controller.signal });
    }, 220);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadPage, query]);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;

    const updateViewport = () => {
      setViewport({
        width: body.clientWidth,
        height: body.clientHeight,
        scrollTop: body.scrollTop,
      });
    };

    updateViewport();
    const resizeObserver = new ResizeObserver(updateViewport);
    resizeObserver.observe(body);
    body.addEventListener("scroll", updateViewport, { passive: true });
    return () => {
      resizeObserver.disconnect();
      body.removeEventListener("scroll", updateViewport);
    };
  }, []);

  useEffect(() => {
    if (!hasMore || isLoading || results.length === 0) return;
    const remainingRows = rowCount - endRow - 1;
    if (remainingRows > VIRTUAL_OVERSCAN_ROWS) return;
    void loadPage({ reset: false, queryValue: query, offsetValue: nextOffset });
  }, [endRow, hasMore, isLoading, loadPage, nextOffset, query, results.length, rowCount]);

  function toggleElementFilter(element: BingoElement) {
    setSelectedElements((current) => {
      const next = new Set(current);
      if (next.has(element)) next.delete(element);
      else next.add(element);
      return next;
    });
  }

  function toggleGachaFilter(gacha: BingoGacha) {
    setSelectedGachas((current) => {
      const next = new Set(current);
      if (next.has(gacha)) next.delete(gacha);
      else next.add(gacha);
      return next;
    });
  }

  function toggleFormFilter(form: BingoForm) {
    setSelectedForms((current) => {
      const next = new Set(current);
      if (next.has(form)) next.delete(form);
      else next.add(form);
      return next;
    });
  }

  function applyFilters() {
    const nextElements = [...selectedElements];
    const nextGachas = [...selectedGachas];
    const nextForms = [...selectedForms];
    setAppliedElements(nextElements);
    setAppliedGachas(nextGachas);
    setAppliedForms(nextForms);
    setResults([]);
    setNextOffset(0);
    setHasMore(true);
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
    void loadPage({
      reset: true,
      queryValue: query,
      offsetValue: 0,
      elements: nextElements,
      gachas: nextGachas,
      forms: nextForms,
    });
  }

  function clearFilters() {
    setSelectedElements(new Set());
    setSelectedGachas(new Set());
    setSelectedForms(new Set());
    setAppliedElements([]);
    setAppliedGachas([]);
    setAppliedForms([]);
    setResults([]);
    setNextOffset(0);
    setHasMore(true);
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
    void loadPage({
      reset: true,
      queryValue: query,
      offsetValue: 0,
      elements: [],
      gachas: [],
      forms: [],
    });
  }

  return (
    <div className={styles.modalBackdrop} role="presentation" onMouseDown={onClose}>
      <section
        className={styles.pickerPanel}
        role="dialog"
        aria-modal="true"
        aria-label="キャラクター選択"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className={styles.pickerHeader}>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="キャラクター名で検索"
            autoFocus
            className={styles.searchInput}
          />
          <button
            type="button"
            className={styles.filterIconButton}
            data-active={filterCount > 0 ? "1" : "0"}
            onClick={() => setIsFilterOpen((current) => !current)}
            aria-label="フィルター"
            title="フィルター"
          >
            <svg viewBox="0 0 24 24" aria-hidden focusable="false">
              <path d="M3 5h18l-7 8v6l-4-2v-4L3 5z" fill="currentColor" />
            </svg>
          </button>
          <Button type="button" className={styles.closeButton} onClick={onClose}>
            閉じる
          </Button>
        </div>

        {isFilterOpen ? (
          <div className={styles.filterPanel}>
            <div className={styles.filterBlock}>
              <span className={styles.filterLabel}>属性</span>
              <div className={styles.filterButtonRow}>
                {BINGO_ELEMENTS.map((element) => (
                  <button
                    key={element}
                    type="button"
                    className={styles.filterChoiceButton}
                    data-selected={selectedElements.has(element) ? "1" : "0"}
                    onClick={() => toggleElementFilter(element)}
                  >
                    {element}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.filterBlock}>
              <span className={styles.filterLabel}>ガチャ種別</span>
              <div className={styles.filterButtonRow}>
                {BINGO_TARGET_GACHAS.map((gacha) => (
                  <button
                    key={gacha}
                    type="button"
                    className={styles.filterChoiceButton}
                    data-selected={selectedGachas.has(gacha) ? "1" : "0"}
                    onClick={() => toggleGachaFilter(gacha)}
                  >
                    {gacha}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.filterBlock}>
              <span className={styles.filterLabel}>形態</span>
              <div className={styles.filterButtonRow}>
                {BINGO_FORMS.map((form) => (
                  <button
                    key={form}
                    type="button"
                    className={styles.filterChoiceButton}
                    data-selected={selectedForms.has(form) ? "1" : "0"}
                    onClick={() => toggleFormFilter(form)}
                  >
                    {form}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.filterActions}>
              <button type="button" className={styles.filterClearButton} onClick={clearFilters}>
                クリア
              </button>
              <button type="button" className={styles.filterApplyButton} onClick={applyFilters}>
                適用
              </button>
            </div>
          </div>
        ) : null}

        <div className={styles.pickerBody} ref={bodyRef}>
          {searchError ? <div className={`${styles.status} ${styles.statusError}`}>{searchError}</div> : null}
          {isLoading && results.length === 0 ? <div className={styles.pickerNote}>読み込み中...</div> : null}
          {!isLoading && results.length === 0 ? <div className={styles.pickerNote}>該当するキャラクターがいません</div> : null}
          <div className={styles.virtualGrid} style={{ height: totalHeight }}>
            {visibleResults.map((character, visibleIndex) => {
              const index = startIndex + visibleIndex;
              const row = Math.floor(index / columns);
              const column = index % columns;
              const isSelectedElsewhere = selectedIds.has(character.id) && character.id !== currentCharacterId;
              return (
                <button
                  key={character.id}
                  type="button"
                  className={styles.characterButton}
                  style={{
                    width: VIRTUAL_ITEM_WIDTH,
                    height: VIRTUAL_ITEM_HEIGHT,
                    transform: `translate(${column * (VIRTUAL_ITEM_WIDTH + VIRTUAL_GAP)}px, ${row * rowHeight}px)`,
                  }}
                  data-disabled={isSelectedElsewhere ? "1" : "0"}
                  disabled={isSelectedElsewhere}
                  onClick={() => onSelect(character)}
                  title={isSelectedElsewhere ? "別のマスで選択済みです" : character.name}
                >
                  <CharacterTile character={character} />
                </button>
              );
            })}
          </div>
          {isLoading && results.length > 0 ? <div className={styles.pickerNote}>追加読み込み中...</div> : null}
        </div>
      </section>
    </div>
  );
}

export default function BingoTool() {
  const [board, setBoard] = useState<Array<BingoCharacterSummary | null>>(() => readStoredBoard() ?? createEmptyBoard());
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ tone: NoticeTone; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportPreview, setExportPreview] = useState<{ url: string; fileName: string } | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const skipNextCellClickRef = useRef(false);
  const pointerDragRef = useRef<BoardPointerDrag | null>(null);

  useEffect(() => {
    writeStoredBoard(board);
  }, [board]);

  useEffect(() => {
    return () => {
      if (exportPreview) URL.revokeObjectURL(exportPreview.url);
    };
  }, [exportPreview]);

  const selectedIds = useMemo(
    () => new Set(board.map((character) => character?.id ?? "").filter(Boolean)),
    [board]
  );
  const filledCount = board.filter(Boolean).length;
  const canSubmit = filledCount === BINGO_GRID_SIZE;

  function updateCell(index: number, character: BingoCharacterSummary) {
    setBoard((current) => current.map((entry, currentIndex) => (currentIndex === index ? character : entry)));
    setActiveIndex(null);
    setNotice(null);
  }

  function clearCell(index: number) {
    setBoard((current) => current.map((entry, currentIndex) => (currentIndex === index ? null : entry)));
  }

  function moveBoardCharacter(sourceIndex: number, targetIndex: number) {
    if (
      !Number.isInteger(sourceIndex) ||
      !Number.isInteger(targetIndex) ||
      sourceIndex < 0 ||
      targetIndex < 0 ||
      sourceIndex >= BINGO_GRID_SIZE ||
      targetIndex >= BINGO_GRID_SIZE ||
      sourceIndex === targetIndex
    ) {
      return;
    }

    setBoard((current) => {
      const next = current.slice();
      const movingCharacter = next[sourceIndex];
      if (!movingCharacter) return current;
      next[sourceIndex] = next[targetIndex];
      next[targetIndex] = movingCharacter;
      return next;
    });
    setNotice(null);
  }

  function handleCellClick(index: number) {
    if (skipNextCellClickRef.current) return;
    setActiveIndex(index);
  }

  function findBoardIndexAtPoint(clientX: number, clientY: number): number | null {
    const element = document.elementFromPoint(clientX, clientY);
    const cell = element instanceof HTMLElement ? element.closest<HTMLElement>("[data-bingo-index]") : null;
    if (!cell) return null;
    const index = Number(cell.dataset.bingoIndex);
    return Number.isInteger(index) && index >= 0 && index < BINGO_GRID_SIZE ? index : null;
  }

  function suppressNextCellClick() {
    skipNextCellClickRef.current = true;
    window.setTimeout(() => {
      skipNextCellClickRef.current = false;
    }, 0);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>, index: number) {
    if (!board[index]) {
      return;
    }
    if (event.pointerType === "mouse" && event.button !== 0) return;
    pointerDragRef.current = {
      sourceIndex: index,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      isDragging: false,
    };
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = pointerDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (!drag.isDragging && distance < 8) return;

    if (!drag.isDragging) {
      drag.isDragging = true;
      setDraggingIndex(drag.sourceIndex);
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    event.preventDefault();
    const targetIndex = findBoardIndexAtPoint(event.clientX, event.clientY);
    if (targetIndex !== null) setDragOverIndex(targetIndex);
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = pointerDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    pointerDragRef.current = null;
    setDraggingIndex(null);
    setDragOverIndex(null);

    if (!drag.isDragging) return;

    event.preventDefault();
    suppressNextCellClick();
    const targetIndex = findBoardIndexAtPoint(event.clientX, event.clientY);
    if (targetIndex !== null) moveBoardCharacter(drag.sourceIndex, targetIndex);
  }

  function handlePointerCancel() {
    pointerDragRef.current = null;
    setDraggingIndex(null);
    setDragOverIndex(null);
  }

  async function handleExport() {
    const node = exportRef.current;
    if (!node) return;
    setIsExporting(true);
    setNotice(null);
    try {
      const blob = await createBoardBlob(node);
      if (!blob) throw new Error("画像生成に失敗しました");
      const url = URL.createObjectURL(blob);
      setExportPreview((current) => {
        if (current) URL.revokeObjectURL(current.url);
        return {
          url,
          fileName: `bingo_${fileNameDateText(new Date())}.png`,
        };
      });
      setNotice({ tone: "info", message: "ビンゴ画像を出力しました。" });
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "画像生成に失敗しました" });
    } finally {
      setIsExporting(false);
    }
  }

  function handleSavePreviewImage() {
    if (!exportPreview) return;
    const link = document.createElement("a");
    link.href = exportPreview.url;
    link.download = exportPreview.fileName;
    link.click();
    setNotice({ tone: "info", message: "ビンゴ画像を保存しました。" });
  }

  function closeExportPreview() {
    setExportPreview((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
  }

  async function handleSubmit() {
    setIsSubmitting(true);
    setNotice(null);
    try {
      const characters = board.filter((character): character is BingoCharacterSummary => Boolean(character));
      const payload = validateBingoSubmissionPayload({ characters });
      const response = await fetch("/api/bingo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
      });
      const data = (await response.json()) as SubmissionResponse;
      if (!response.ok) {
        throw new Error(data.message ?? "ビンゴ予想の保存に失敗しました");
      }
      setNotice({ tone: data.stored ? "info" : "warn", message: data.message ?? "保存しました。" });
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "ビンゴ予想の保存に失敗しました" });
    } finally {
      setIsSubmitting(false);
    }
  }

  const activeCharacter = activeIndex === null ? null : board[activeIndex];

  return (
    <section className={styles.page}>
      <div className={styles.headerRow}>
        <div className={styles.headerTitleGroup}>
          <Link href="/" className={styles.homeLink} aria-label="Home">
            <img className={styles.headerLogo} src="/icon/icon_Header_2.png" alt="Strike-Optima" />
          </Link>
          <h1 className={styles.title}>DD4獣神化予想ビンゴ</h1>
        </div>
        <Link href="/bingo/ranking" className={styles.iconLink} aria-label="ランキング" title="ランキング">
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
            <path fill="currentColor" d="M5 21h14v-2H5v2Zm1-4h3V9H6v8Zm5 0h3V3h-3v14Zm5 0h3V6h-3v11Z" />
          </svg>
        </Link>
      </div>

      <div className={styles.toolbar}>
        <Button type="button" className={styles.actionButton} onClick={handleExport} disabled={isExporting}>
          {isExporting ? "画像生成中" : "画像出力"}
        </Button>
        <Button type="button" variant="primary" onClick={handleSubmit} disabled={!canSubmit || isSubmitting}>
          {isSubmitting ? "保存中" : "ランキングに保存"}
        </Button>
        <Button type="button" className={styles.resetButton} onClick={() => setBoard(createEmptyBoard())}>
          クリア
        </Button>
      </div>

      {notice ? (
        <div
          className={`${styles.status} ${
            notice.tone === "error" ? styles.statusError : notice.tone === "warn" ? styles.statusWarn : ""
          }`}
        >
          {notice.message}
        </div>
      ) : null}

      <div className={styles.panel}>
        <div className={styles.board} aria-label="予想ビンゴ盤">
          {board.map((character, index) => (
            <div key={index} className={styles.cellWrap}>
              <button
                type="button"
                className={`${styles.cell} ${character ? styles.cellDraggable : ""} ${
                  draggingIndex === index ? styles.cellDragging : dragOverIndex === index ? styles.cellDropTarget : ""
                }`}
                data-bingo-index={index}
                aria-grabbed={draggingIndex === index ? "true" : "false"}
                onClick={() => handleCellClick(index)}
                onPointerDown={(event) => handlePointerDown(event, index)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
              >
                {character ? (
                  <BoardCharacterTile character={character} />
                ) : (
                  <span className={styles.emptyCell}>+</span>
                )}
              </button>
              {character ? (
                <button type="button" className={styles.clearCellButton} onClick={() => clearCell(index)} aria-label={`${character.name}を削除`}>
                  ×
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className={styles.exportFrame} aria-hidden="true">
        <div className={styles.exportBoard} ref={exportRef}>
          <div className={styles.exportGrid}>
            {board.map((character, index) => (
              <div key={index} className={styles.exportCell}>
                {character ? (
                  <img className={styles.exportIcon} src={character.iconUrl} alt="" />
                ) : (
                  <div className={styles.exportEmpty}>未入力</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {activeIndex !== null ? (
        <CharacterPicker
          selectedIds={selectedIds}
          currentCharacterId={activeCharacter?.id ?? ""}
          onSelect={(character) => updateCell(activeIndex, character)}
          onClose={() => setActiveIndex(null)}
        />
      ) : null}

      {exportPreview ? (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={closeExportPreview}>
          <section
            className={styles.previewPanel}
            role="dialog"
            aria-modal="true"
            aria-label="画像プレビュー"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.previewHeader}>
              <h2 className={styles.previewTitle}>画像プレビュー</h2>
              <Button type="button" className={styles.closeButton} onClick={closeExportPreview}>
                閉じる
              </Button>
            </div>
            <div className={styles.previewBody}>
              <img className={styles.previewImage} src={exportPreview.url} alt="予想ビンゴ画像プレビュー" />
            </div>
            <div className={styles.previewActions}>
              <Button type="button" className={styles.actionButton} onClick={handleSavePreviewImage}>
                画像保存
              </Button>
              <Button type="button" variant="primary" className={styles.previewRegisterButton} onClick={handleSubmit} disabled={!canSubmit || isSubmitting}>
                {isSubmitting ? "登録中" : "ランキングに登録"}
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
