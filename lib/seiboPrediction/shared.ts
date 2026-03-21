import {
  GIMMICK_OPTIONS,
  MAX_CHARACTERS,
  MAX_GIMMICK_RANKING,
  MAX_GIMMICKS,
  MAX_CHARACTER_RANKING,
  SEIBO_QUESTS,
  SHOT_TYPE_OPTIONS,
  type Gimmick,
  type SeiboQuestKey,
  type SeiboQuestPrediction,
  type SeiboQuestRanking,
  type SeiboSubmissionPayload,
  type ShotType,
} from "./types";

const shotTypeSet = new Set<string>(SHOT_TYPE_OPTIONS);
const gimmickSet = new Set<string>(GIMMICK_OPTIONS);
const questKeySet = new Set<string>(SEIBO_QUESTS.map((quest) => quest.key));

export {
  GIMMICK_OPTIONS,
  MAX_CHARACTERS,
  MAX_GIMMICK_RANKING,
  MAX_GIMMICKS,
  MAX_CHARACTER_RANKING,
  SEIBO_QUESTS,
  SHOT_TYPE_OPTIONS,
};

export function isQuestKey(value: string): value is SeiboQuestKey {
  return questKeySet.has(value);
}

export function isShotType(value: string): value is ShotType {
  return shotTypeSet.has(value);
}

export function normalizeShotTypeLabel(value: string): ShotType | null {
  if (isShotType(value)) return value;
  if (value === "\u53cd/\u8cab") return "\u53cd\u5c04/\u8cab\u901a";
  return null;
}

export function toStorageShotType(value: ShotType): string {
  if (value === "\u53cd\u5c04/\u8cab\u901a") return "\u53cd/\u8cab";
  return value;
}

export function isGimmick(value: string): value is Gimmick {
  return gimmickSet.has(value);
}

export function questTitleFromKey(questKey: SeiboQuestKey): string {
  const quest = SEIBO_QUESTS.find((entry) => entry.key === questKey);
  if (!quest) return "";
  if (quest.key === "ex") return "EX";
  return `${quest.bossName}\u306e\u661f\u5893`;
}

export function buildGimmickCombinationLabel(shotType: ShotType, gimmicks: readonly Gimmick[]): string {
  const sortedGimmicks = [...gimmicks].sort((a, b) => GIMMICK_OPTIONS.indexOf(a) - GIMMICK_OPTIONS.indexOf(b));
  return [shotType, ...sortedGimmicks].join(" + ");
}

export function normalizeSubmissionPayload(input: unknown): SeiboSubmissionPayload {
  if (!input || typeof input !== "object") {
    throw new Error("\u9001\u4fe1\u30c7\u30fc\u30bf\u304c\u4e0d\u6b63\u3067\u3059");
  }

  const rawPredictions = (input as { predictions?: unknown }).predictions;
  if (!Array.isArray(rawPredictions) || rawPredictions.length !== SEIBO_QUESTS.length) {
    throw new Error("6\u30af\u30a8\u30b9\u30c8\u5206\u306e\u5165\u529b\u304c\u5fc5\u8981\u3067\u3059");
  }

  const seenQuestKeys = new Set<SeiboQuestKey>();
  const predictions: SeiboQuestPrediction[] = rawPredictions.map((entry) => {
    if (!entry || typeof entry !== "object") {
      throw new Error("\u5165\u529b\u30c7\u30fc\u30bf\u306e\u5f62\u5f0f\u304c\u4e0d\u6b63\u3067\u3059");
    }

    const rawQuestKey = String((entry as { questKey?: unknown }).questKey ?? "");
    if (!isQuestKey(rawQuestKey) || seenQuestKeys.has(rawQuestKey)) {
      throw new Error("\u30af\u30a8\u30b9\u30c8\u60c5\u5831\u304c\u4e0d\u6b63\u3067\u3059");
    }
    seenQuestKeys.add(rawQuestKey);

    const rawShotType = String((entry as { shotType?: unknown }).shotType ?? "");
    if (rawShotType && !isShotType(rawShotType)) {
      throw new Error(`${questTitleFromKey(rawQuestKey)}\u306e\u6483\u7a2e\u304c\u4e0d\u6b63\u3067\u3059`);
    }

    const rawGimmicks = Array.isArray((entry as { gimmicks?: unknown }).gimmicks)
      ? ((entry as { gimmicks: unknown[] }).gimmicks ?? [])
      : [];
    const gimmicks = rawGimmicks
      .map((value) => String(value))
      .filter((value, index, arr): value is Gimmick => isGimmick(value) && arr.indexOf(value) === index);
    if (gimmicks.length > MAX_GIMMICKS) {
      throw new Error(`${questTitleFromKey(rawQuestKey)}\u306e\u30ae\u30df\u30c3\u30af\u306f${MAX_GIMMICKS}\u500b\u307e\u3067\u3067\u3059`);
    }

    const rawCharacters = Array.isArray((entry as { characters?: unknown }).characters)
      ? ((entry as { characters: unknown[] }).characters ?? [])
      : [];
    const characterMap = new Map<string, { id: string; name: string; nameKana: string; iconUrl: string }>();
    for (const character of rawCharacters) {
      if (!character || typeof character !== "object") continue;
      const id = String((character as { id?: unknown }).id ?? "").trim();
      const name = String((character as { name?: unknown }).name ?? "").trim();
      const iconUrl = String((character as { iconUrl?: unknown }).iconUrl ?? "").trim();
      const nameKana = String((character as { nameKana?: unknown }).nameKana ?? "").trim();
      if (!id || !name || !iconUrl) continue;
      if (!characterMap.has(id)) {
        characterMap.set(id, { id, name, nameKana, iconUrl });
      }
    }
    const characters = [...characterMap.values()];
    if (characters.length > MAX_CHARACTERS) {
      throw new Error(`${questTitleFromKey(rawQuestKey)}\u306e\u9069\u6b63\u30ad\u30e3\u30e9\u306f${MAX_CHARACTERS}\u4f53\u307e\u3067\u3067\u3059`);
    }

    return {
      questKey: rawQuestKey,
      shotType: rawShotType as ShotType | "",
      gimmicks,
      characters,
    };
  });

  return { predictions };
}

export function isCountablePrediction(prediction: SeiboQuestPrediction): prediction is SeiboQuestPrediction & { shotType: ShotType } {
  return isShotType(prediction.shotType) && prediction.gimmicks.length > 0 && prediction.characters.length > 0;
}

export function validateSubmissionPayload(input: unknown): SeiboSubmissionPayload {
  return normalizeSubmissionPayload(input);
}

export function emptySeiboRankings(): SeiboQuestRanking[] {
  return SEIBO_QUESTS.map((quest) => ({
    questKey: quest.key,
    title: questTitleFromKey(quest.key),
    totalSubmissions: 0,
    gimmickRanking: [],
    characterRanking: [],
  }));
}
