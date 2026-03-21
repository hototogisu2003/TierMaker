import { createHash } from "node:crypto";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  MAX_CHARACTER_RANKING,
  MAX_GIMMICK_RANKING,
  SEIBO_QUESTS,
  buildGimmickCombinationLabel,
  emptySeiboRankings,
  isCountablePrediction,
  isGimmick,
  normalizeSubmissionPayload,
  normalizeShotTypeLabel,
  questTitleFromKey,
  toStorageShotType,
} from "./shared";
import type {
  Gimmick,
  SeiboBossCard,
  SeiboCharacterSummary,
  SeiboQuestKey,
  SeiboQuestRanking,
  SeiboSubmissionPayload,
  ShotType,
} from "./types";

type GenericRow = Record<string, unknown>;

type PredictionRow = {
  quest_key: string;
  shot_type: string;
  gimmicks: string[] | null;
  character_ids: string[] | null;
};

type SubmissionSlotClaimResponse = {
  allowed?: boolean;
  next_allowed_at?: string | null;
};

function normalizeBaseUrl(value: string | undefined): string {
  return (value ?? "").trim().replace(/\/+$/, "");
}

function toText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
  }
  return Number.POSITIVE_INFINITY;
}

function buildPublicUrl(path: string, baseUrl: string, fallback: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (baseUrl) return `${baseUrl}/${path.replace(/^\/+/, "")}`;
  return fallback;
}

function getCharactersTableName(): string {
  return process.env.NEXT_PUBLIC_CHARACTERS_TABLE ?? "characters";
}

function getCharacterBucketName(): string {
  return process.env.NEXT_PUBLIC_ICON_BUCKET ?? "characters";
}

function getCharacterOtherTableName(): string {
  return process.env.NEXT_PUBLIC_CHARA_OTHER_TABLE ?? "chara_other";
}

function getPredictionTableName(): string {
  return process.env.NEXT_PUBLIC_SEIBO_PREDICTIONS_TABLE ?? "seibo_predictions";
}

function getSubmissionSlotFunctionName(): string {
  return process.env.NEXT_PUBLIC_SEIBO_SUBMISSION_SLOT_FUNCTION ?? "claim_seibo_submission_slot";
}

function getReleaseSubmissionSlotFunctionName(): string {
  return process.env.NEXT_PUBLIC_SEIBO_RELEASE_SUBMISSION_SLOT_FUNCTION ?? "release_seibo_submission_slot";
}

function isMissingTableError(message: string): boolean {
  return /relation .* does not exist|Could not find the table|schema cache/i.test(message);
}

function isMissingFunctionError(message: string): boolean {
  return /function .* does not exist|Could not find the function|schema cache/i.test(message);
}

function hashDeviceToken(deviceToken: string): string {
  return createHash("sha256").update(deviceToken).digest("hex");
}

function formatSubmissionLimitMessage(nextAllowedAt: string | null | undefined, cooldownHours: number): string {
  if (!nextAllowedAt) {
    return `ランキング反映は${cooldownHours}時間に1回までです。時間を空けてから再度お試しください。`;
  }

  const parsed = new Date(nextAllowedAt);
  if (Number.isNaN(parsed.getTime())) {
    return `ランキング反映は${cooldownHours}時間に1回までです。時間を空けてから再度お試しください。`;
  }

  const formatted = new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Tokyo",
  }).format(parsed);

  return `ランキング反映は${cooldownHours}時間に1回までです。次回は${formatted}以降に投稿できます。`;
}

function toCharacterSummary(
  row: GenericRow,
  supabase: ReturnType<typeof getSupabaseServerClient>,
  r2BaseUrl: string,
  fallbackName = ""
): SeiboCharacterSummary | null {
  const id = toText(row.id);
  const name = toText(row.name) || fallbackName || id;
  const nameKana = toText(row.name_kana);
  const iconPath = toText(row.icon_path);
  if (!id) return null;
  const fallback = iconPath
    ? supabase.storage.from(getCharacterBucketName()).getPublicUrl(iconPath).data.publicUrl
    : "";
  return {
    id,
    name,
    nameKana,
    iconUrl: iconPath ? buildPublicUrl(iconPath, r2BaseUrl, fallback) : "",
  };
}

export async function fetchSeiboBossCards(): Promise<SeiboBossCard[]> {
  const supabase = getSupabaseServerClient();
  const r2BaseUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL);
  const bossNames = SEIBO_QUESTS.map((quest) => quest.bossName).filter((name) => name !== "EX");
  const { data, error } = await supabase
    .from(getCharactersTableName())
    .select("id,name,name_kana,icon_path")
    .in("name", bossNames);

  if (error) {
    console.error("Failed to load Seibo boss cards:", error);
  }

  const byName = new Map<string, SeiboCharacterSummary>();
  for (const row of (data ?? []) as GenericRow[]) {
    const summary = toCharacterSummary(row, supabase, r2BaseUrl);
    if (summary) {
      byName.set(summary.name, summary);
    }
  }

  return SEIBO_QUESTS.map((quest) => {
    const matched = byName.get(quest.bossName);
    return {
      questKey: quest.key,
      bossName: quest.bossName,
      title: questTitleFromKey(quest.key),
      iconUrl: matched?.iconUrl ?? "",
    };
  });
}

export async function searchSeiboCharacters(query: string, limit = 12): Promise<SeiboCharacterSummary[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const supabase = getSupabaseServerClient();
  const r2BaseUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL);
  const escaped = trimmed.replace(/[%_,]/g, (value) => `\\${value}`);
  const like = `%${escaped}%`;
  const [otherResult, characterResult] = await Promise.all([
    supabase
      .from(getCharacterOtherTableName())
      .select("id,number")
      .or(`name.ilike.${like},name_kana.ilike.${like},name2.ilike.${like},name2_kana.ilike.${like}`)
      .order("number", { ascending: false })
      .limit(Math.max(limit * 3, 20)),
    supabase
      .from(getCharactersTableName())
      .select("id,number")
      .or(`name.ilike.${like},name_kana.ilike.${like}`)
      .order("number", { ascending: false })
      .limit(Math.max(limit * 2, 20)),
  ]);

  if (otherResult.error) {
    throw new Error(`\u30ad\u30e3\u30e9\u30af\u30bf\u30fc\u691c\u7d22\u306b\u5931\u6557\u3057\u307e\u3057\u305f: ${otherResult.error.message}`);
  }
  if (characterResult.error) {
    throw new Error(`\u30ad\u30e3\u30e9\u30af\u30bf\u30fc\u691c\u7d22\u306b\u5931\u6557\u3057\u307e\u3057\u305f: ${characterResult.error.message}`);
  }

  const orderedIds: string[] = [];
  const pushId = (id: string) => {
    if (id && !orderedIds.includes(id)) {
      orderedIds.push(id);
    }
  };

  for (const row of (otherResult.data ?? []) as GenericRow[]) {
    pushId(toText(row.id));
  }
  for (const row of (characterResult.data ?? []) as GenericRow[]) {
    pushId(toText(row.id));
  }

  if (orderedIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from(getCharactersTableName())
    .select("id,name,name_kana,icon_path,number")
    .in("id", orderedIds);

  if (error) {
    throw new Error(`\u30ad\u30e3\u30e9\u30af\u30bf\u30fc\u691c\u7d22\u306b\u5931\u6557\u3057\u307e\u3057\u305f: ${error.message}`);
  }

  const orderIndex = new Map<string, number>(orderedIds.map((id, index) => [id, index]));

  return ((data ?? []) as GenericRow[])
    .slice()
    .sort((a, b) => {
      const aId = toText(a.id);
      const bId = toText(b.id);
      const byExplicitOrder = (orderIndex.get(aId) ?? Number.POSITIVE_INFINITY) - (orderIndex.get(bId) ?? Number.POSITIVE_INFINITY);
      if (byExplicitOrder !== 0) return byExplicitOrder;
      return toNumber(b.number) - toNumber(a.number);
    })
    .slice(0, limit)
    .map((row) => toCharacterSummary(row, supabase, r2BaseUrl))
    .filter((row): row is SeiboCharacterSummary => Boolean(row));
}

async function fetchCharacterMapByIds(ids: string[]): Promise<Map<string, SeiboCharacterSummary>> {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map();

  const supabase = getSupabaseServerClient();
  const r2BaseUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL);
  const { data, error } = await supabase
    .from(getCharactersTableName())
    .select("id,name,name_kana,icon_path")
    .in("id", uniqueIds);

  if (error) {
    throw new Error(`\u30ad\u30e3\u30e9\u30af\u30bf\u30fc\u8a73\u7d30\u306e\u53d6\u5f97\u306b\u5931\u6557\u3057\u307e\u3057\u305f: ${error.message}`);
  }

  const result = new Map<string, SeiboCharacterSummary>();
  for (const row of (data ?? []) as GenericRow[]) {
    const summary = toCharacterSummary(row, supabase, r2BaseUrl);
    if (summary) {
      result.set(summary.id, summary);
    }
  }
  return result;
}

export async function insertSeiboSubmission(
  input: unknown,
  deviceToken: string
): Promise<{ stored: boolean; message?: string }> {
  const payload = normalizeSubmissionPayload(input);
  const tableName = getPredictionTableName();
  const supabase = getSupabaseServerClient();
  const tokenHash = hashDeviceToken(deviceToken.trim());
  const batchId = crypto.randomUUID();

  const countablePredictions = payload.predictions.filter(isCountablePrediction);
  if (countablePredictions.length === 0) {
    const { error } = await supabase.from(tableName).delete().eq("token_hash", tokenHash);
    if (error) {
      if (isMissingTableError(error.message)) {
        return {
          stored: false,
          message:
            "Supabaseに集計テーブルがありません。TierMaker/supabase/seibo_predictions.sql を実行してください。",
        };
      }
      throw new Error(`予想の削除に失敗しました: ${error.message}`);
    }
    return {
      stored: true,
      message: "画像は作成できますが、ランキングに反映される予想はまだありません。",
    };
  }

  const { data: existingRows, error: existingError } = await supabase
    .from(tableName)
    .select("quest_key")
    .eq("token_hash", tokenHash);

  if (existingError) {
    if (isMissingTableError(existingError.message)) {
      return {
        stored: false,
        message:
          "Supabaseに集計テーブルがありません。TierMaker/supabase/seibo_predictions.sql を実行してください。",
      };
    }
    throw new Error(`既存予想の取得に失敗しました: ${existingError.message}`);
  }

  const rows = countablePredictions.map((prediction) => ({
    token_hash: tokenHash,
    batch_id: batchId,
    quest_key: prediction.questKey,
    shot_type: toStorageShotType(prediction.shotType),
    gimmicks: prediction.gimmicks,
    character_ids: prediction.characters.map((character) => character.id),
  }));

  const { error } = await supabase.from(tableName).upsert(rows, {
    onConflict: "token_hash,quest_key",
    ignoreDuplicates: false,
  });
  if (error) {
    if (isMissingTableError(error.message)) {
      return {
        stored: false,
        message:
          "Supabase\u306b\u96c6\u8a08\u30c6\u30fc\u30d6\u30eb\u304c\u3042\u308a\u307e\u305b\u3093\u3002TierMaker/supabase/seibo_predictions.sql \u3092\u5b9f\u884c\u3057\u3066\u304f\u3060\u3055\u3044\u3002",
      };
    }
    throw new Error(`\u4e88\u60f3\u306e\u4fdd\u5b58\u306b\u5931\u6557\u3057\u307e\u3057\u305f: ${error.message}`);
  }

  const activeQuestKeys = new Set(countablePredictions.map((prediction) => prediction.questKey));
  const removableQuestKeys = ((existingRows ?? []) as GenericRow[])
    .map((row) => toText(row.quest_key))
    .filter((questKey) => questKey && !activeQuestKeys.has(questKey as SeiboQuestKey));

  if (removableQuestKeys.length > 0) {
    const { error: deleteError } = await supabase
      .from(tableName)
      .delete()
      .eq("token_hash", tokenHash)
      .in("quest_key", removableQuestKeys);

    if (deleteError) {
      throw new Error(`不要な旧予想の削除に失敗しました: ${deleteError.message}`);
    }
  }

  return {
    stored: true,
    message: `${countablePredictions.length}件の予想をランキング対象として保存しました。`,
  };
}

export async function claimSeiboSubmissionSlot(
  deviceToken: string,
  cooldownHours: number
): Promise<{ allowed: boolean; message?: string }> {
  const normalizedToken = deviceToken.trim();
  if (!normalizedToken) {
    throw new Error("端末識別子の取得に失敗しました");
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.rpc(getSubmissionSlotFunctionName(), {
    p_token_hash: hashDeviceToken(normalizedToken),
    p_cooldown_hours: cooldownHours,
  });

  if (error) {
    if (isMissingFunctionError(error.message) || isMissingTableError(error.message)) {
      return {
        allowed: false,
        message:
          "Supabaseの投稿制限テーブルまたは関数がありません。TierMaker/supabase/seibo_predictions.sql を実行してください。",
      };
    }
    throw new Error(`投稿制限の確認に失敗しました: ${error.message}`);
  }

  const response = (data ?? {}) as SubmissionSlotClaimResponse;
  if (response.allowed) {
    return { allowed: true };
  }

  return {
    allowed: false,
    message: formatSubmissionLimitMessage(response.next_allowed_at, cooldownHours),
  };
}

export async function releaseSeiboSubmissionSlot(deviceToken: string): Promise<void> {
  const normalizedToken = deviceToken.trim();
  if (!normalizedToken) return;

  const supabase = getSupabaseServerClient();
  const { error } = await supabase.rpc(getReleaseSubmissionSlotFunctionName(), {
    p_token_hash: hashDeviceToken(normalizedToken),
  });

  if (error) {
    if (isMissingFunctionError(error.message) || isMissingTableError(error.message)) {
      return;
    }
    throw new Error(`投稿制限ロックの解放に失敗しました: ${error.message}`);
  }
}

export async function fetchAllSeiboRankings(): Promise<SeiboQuestRanking[]> {
  const supabase = getSupabaseServerClient();
  const tableName = getPredictionTableName();
  const empty = emptySeiboRankings();
  const { data, error } = await supabase
    .from(tableName)
    .select("quest_key,shot_type,gimmicks,character_ids");

  if (error) {
    if (isMissingTableError(error.message)) {
      return empty;
    }
    throw new Error(`\u30e9\u30f3\u30ad\u30f3\u30b0\u306e\u53d6\u5f97\u306b\u5931\u6557\u3057\u307e\u3057\u305f: ${error.message}`);
  }

  const rows = (data ?? []) as PredictionRow[];
  const rankingMap = new Map<SeiboQuestKey, SeiboQuestRanking>(empty.map((entry) => [entry.questKey, entry]));
  const gimmickCounts = new Map<SeiboQuestKey, Map<string, number>>();
  const characterCounts = new Map<SeiboQuestKey, Map<string, number>>();

  for (const quest of SEIBO_QUESTS) {
    gimmickCounts.set(quest.key, new Map());
    characterCounts.set(quest.key, new Map());
  }

  for (const row of rows) {
    const questKey = row.quest_key as SeiboQuestKey;
    const ranking = rankingMap.get(questKey);
    const normalizedShotType = normalizeShotTypeLabel(row.shot_type);
    if (!ranking || !normalizedShotType) continue;

    const gimmicks = (row.gimmicks ?? []).filter((value): value is Gimmick => isGimmick(value));
    ranking.totalSubmissions += 1;

    const gimmickLabel = buildGimmickCombinationLabel(normalizedShotType as ShotType, gimmicks);
    const gimmickCountMap = gimmickCounts.get(questKey);
    gimmickCountMap?.set(gimmickLabel, (gimmickCountMap.get(gimmickLabel) ?? 0) + 1);

    const characterCountMap = characterCounts.get(questKey);
    for (const characterId of row.character_ids ?? []) {
      if (!characterId) continue;
      characterCountMap?.set(characterId, (characterCountMap.get(characterId) ?? 0) + 1);
    }
  }

  const topCharacterIds = new Set<string>();
  for (const quest of SEIBO_QUESTS) {
    const ranking = rankingMap.get(quest.key);
    const gimmickCountMap = gimmickCounts.get(quest.key) ?? new Map<string, number>();
    const characterCountMap = characterCounts.get(quest.key) ?? new Map<string, number>();
    if (!ranking) continue;

    ranking.gimmickRanking = [...gimmickCountMap.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja"))
      .slice(0, MAX_GIMMICK_RANKING)
      .map(([label, count]) => ({ label, count }));

    const sortedCharacters = [...characterCountMap.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja"))
      .slice(0, MAX_CHARACTER_RANKING);
    for (const [characterId] of sortedCharacters) {
      topCharacterIds.add(characterId);
    }
  }

  const characterMap = await fetchCharacterMapByIds([...topCharacterIds]);

  for (const quest of SEIBO_QUESTS) {
    const ranking = rankingMap.get(quest.key);
    const characterCountMap = characterCounts.get(quest.key) ?? new Map<string, number>();
    if (!ranking) continue;

    ranking.characterRanking = [...characterCountMap.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja"))
      .slice(0, MAX_CHARACTER_RANKING)
      .map(([characterId, count]) => {
        const character = characterMap.get(characterId);
        return {
          id: characterId,
          name: character?.name ?? characterId,
          nameKana: character?.nameKana ?? "",
          iconUrl: character?.iconUrl ?? "",
          count,
        };
      });
  }

  return SEIBO_QUESTS.map((quest) => rankingMap.get(quest.key) ?? {
    questKey: quest.key,
    title: questTitleFromKey(quest.key),
    totalSubmissions: 0,
    gimmickRanking: [],
    characterRanking: [],
  });
}

export function coerceSeiboPayload(input: unknown): SeiboSubmissionPayload {
  return normalizeSubmissionPayload(input);
}
