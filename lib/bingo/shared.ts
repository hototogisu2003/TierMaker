import {
  BINGO_GRID_SIZE,
  MAX_BINGO_RANKING,
  type BingoCharacterSummary,
  type BingoRanking,
  type BingoSubmissionPayload,
} from "./types";

export { BINGO_GRID_SIZE, MAX_BINGO_RANKING };

export function normalizeBingoSubmissionPayload(input: unknown): BingoSubmissionPayload {
  if (!input || typeof input !== "object") {
    throw new Error("送信データが不正です");
  }

  const rawCharacters = (input as { characters?: unknown }).characters;
  if (!Array.isArray(rawCharacters)) {
    throw new Error("9マス分のキャラクター入力が必要です");
  }

  const characters: BingoCharacterSummary[] = rawCharacters.map((entry) => {
    if (!entry || typeof entry !== "object") {
      throw new Error("入力データの形式が不正です");
    }

    const id = String((entry as { id?: unknown }).id ?? "").trim();
    const name = String((entry as { name?: unknown }).name ?? "").trim();
    const nameKana = String((entry as { nameKana?: unknown }).nameKana ?? "").trim();
    const iconUrl = String((entry as { iconUrl?: unknown }).iconUrl ?? "").trim();
    if (!id || !name || !iconUrl) {
      throw new Error("キャラクター情報が不正です");
    }

    return { id, name, nameKana, iconUrl };
  });

  if (characters.length !== BINGO_GRID_SIZE) {
    throw new Error("9マスすべてにキャラクターを入力してください");
  }

  const uniqueIds = new Set(characters.map((character) => character.id));
  if (uniqueIds.size !== characters.length) {
    throw new Error("同じキャラクターは複数マスに入力できません");
  }

  return { characters };
}

export function validateBingoSubmissionPayload(input: unknown): BingoSubmissionPayload {
  return normalizeBingoSubmissionPayload(input);
}

export function emptyBingoRanking(): BingoRanking {
  return {
    totalSubmissions: 0,
    characterRanking: [],
  };
}
