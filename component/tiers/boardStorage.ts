"use client";

export type TierMeta = { id: string; name: string; color: string };
export type BoardContainers = Record<string, string[]>;
export type BoardState = { tierMeta: TierMeta[]; containers: BoardContainers; boardTitle?: string };
export type PersistedBoardState = BoardState & { rankColWidth?: number; savedBoardId?: string };

export type SavedBoardRecord = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  board: PersistedBoardState;
};

export const BOARD_STORAGE_KEY = "tiermaker-board-state-v1";
export const SAVED_BOARDS_STORAGE_KEY = "tiermaker-saved-boards-v1";
export const DEFAULT_RANK_COL_WIDTH = 72;

function isTierMeta(value: unknown): value is TierMeta {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === "string" && typeof v.name === "string" && typeof v.color === "string";
}

function sanitizeContainers(value: unknown): BoardContainers {
  if (!value || typeof value !== "object") return {};
  const entries = Object.entries(value as Record<string, unknown>).map(([key, ids]) => [
    key,
    Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [],
  ]);
  return Object.fromEntries(entries);
}

export function sanitizePersistedBoardState(value: unknown): PersistedBoardState | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (!Array.isArray(raw.tierMeta)) return null;

  const tierMeta = raw.tierMeta.filter(isTierMeta);
  if (tierMeta.length === 0) return null;

  const containers = sanitizeContainers(raw.containers);
  const boardTitle = typeof raw.boardTitle === "string" ? raw.boardTitle : undefined;
  const savedBoardId = typeof raw.savedBoardId === "string" ? raw.savedBoardId : undefined;
  const rankColWidth =
    typeof raw.rankColWidth === "number" && Number.isFinite(raw.rankColWidth)
      ? raw.rankColWidth
      : undefined;

  return { tierMeta, containers, boardTitle, rankColWidth, savedBoardId };
}

export function sanitizeSavedBoardRecord(value: unknown): SavedBoardRecord | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const board = sanitizePersistedBoardState(raw.board);
  if (!board) return null;
  if (typeof raw.id !== "string" || typeof raw.title !== "string" || typeof raw.updatedAt !== "string") {
    return null;
  }
  const createdAt = typeof raw.createdAt === "string" ? raw.createdAt : raw.updatedAt;
  return {
    id: raw.id,
    title: raw.title,
    createdAt,
    updatedAt: raw.updatedAt,
    board,
  };
}

export function readSavedBoards(): SavedBoardRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SAVED_BOARDS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(sanitizeSavedBoardRecord)
      .filter((record): record is SavedBoardRecord => record !== null)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  } catch {
    return [];
  }
}

export function writeSavedBoards(records: SavedBoardRecord[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SAVED_BOARDS_STORAGE_KEY, JSON.stringify(records));
}
