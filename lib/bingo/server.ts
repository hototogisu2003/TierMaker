import { createHash } from "node:crypto";
import { getSupabaseServerClient, getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  BINGO_ELEMENTS,
  BINGO_EXCEPTION_CHARACTER_IDS,
  BINGO_EXCLUDED_CHARACTER_IDS,
  BINGO_FORMS,
  BINGO_GRID_SIZE,
  BINGO_TARGET_GACHAS,
  MAX_BINGO_RANKING,
  type BingoCharacterFilters,
  type BingoCharacterSummary,
  type BingoElement,
  type BingoForm,
  type BingoGacha,
  type BingoRanking,
  type BingoSubmissionPayload,
} from "./types";
import { emptyBingoRanking, normalizeBingoSubmissionPayload } from "./shared";

type GenericRow = Record<string, unknown>;

type BingoPredictionRow = {
  character_ids: string[] | null;
};

export type BingoCharacterPage = {
  characters: BingoCharacterSummary[];
  nextOffset: number;
  hasMore: boolean;
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

function getBingoPredictionTableName(): string {
  return process.env.NEXT_PUBLIC_BINGO_PREDICTIONS_TABLE ?? "bingo_predictions";
}

function isMissingTableError(message: string): boolean {
  return /relation .* does not exist|Could not find the table|schema cache/i.test(message);
}

function hashDeviceToken(deviceToken: string): string {
  return createHash("sha256").update(deviceToken).digest("hex");
}

function toCharacterSummary(
  row: GenericRow,
  supabase: ReturnType<typeof getSupabaseServerClient>,
  r2BaseUrl: string
): BingoCharacterSummary | null {
  const id = toText(row.id);
  const name = toText(row.name) || id;
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

function buildEligibleCharacterFilter(): string {
  const gachaFilter = BINGO_TARGET_GACHAS.map((value) => `"${value}"`).join(",");
  const exceptionFilter = BINGO_EXCEPTION_CHARACTER_IDS.join(",");
  return `and(obtain.eq.ガチャ,gacha.in.(${gachaFilter})),id.in.(${exceptionFilter})`;
}

function isExcludedCharacterId(id: string): boolean {
  return BINGO_EXCLUDED_CHARACTER_IDS.includes(id as (typeof BINGO_EXCLUDED_CHARACTER_IDS)[number]);
}

function normalizeFilters(filters?: Partial<BingoCharacterFilters>): BingoCharacterFilters {
  const elementSet = new Set<string>(BINGO_ELEMENTS);
  const gachaSet = new Set<string>(BINGO_TARGET_GACHAS);
  const formSet = new Set<string>(BINGO_FORMS);
  return {
    elements: [...new Set(filters?.elements ?? [])].filter((value): value is BingoElement => elementSet.has(value)),
    gachas: [...new Set(filters?.gachas ?? [])].filter((value): value is BingoGacha => gachaSet.has(value)),
    forms: [...new Set(filters?.forms ?? [])].filter((value): value is BingoForm => formSet.has(value)),
  };
}

function applyCharacterFilters(
  query: { in: (column: string, values: string[]) => unknown },
  filters?: Partial<BingoCharacterFilters>
): any {
  const normalized = normalizeFilters(filters);
  let next: any = query;
  if (normalized.elements.length > 0) {
    next = next.in("element", normalized.elements);
  }
  if (normalized.gachas.length > 0) {
    next = next.in("gacha", normalized.gachas);
  }
  if (normalized.forms.length > 0) {
    next = next.in("form", normalized.forms);
  }
  return next;
}

function matchesAppliedFilters(row: GenericRow, filters?: Partial<BingoCharacterFilters>): boolean {
  const normalized = normalizeFilters(filters);
  if (normalized.elements.length > 0 && !normalized.elements.includes(toText(row.element) as BingoElement)) {
    return false;
  }
  if (normalized.gachas.length > 0 && !normalized.gachas.includes(toText(row.gacha) as BingoGacha)) {
    return false;
  }
  if (normalized.forms.length > 0 && !normalized.forms.includes(toText(row.form) as BingoForm)) {
    return false;
  }
  return true;
}

function dedupeRowsByNameKeepingSmallestNumber(rows: GenericRow[]): GenericRow[] {
  const byName = new Map<string, GenericRow>();
  for (const row of rows) {
    const name = toText(row.name);
    if (!name) continue;
    const current = byName.get(name);
    if (!current || toNumber(row.number) < toNumber(current.number)) {
      byName.set(name, row);
    }
  }

  return [...byName.values()].sort((a, b) => {
    const byNumber = toNumber(a.number) - toNumber(b.number);
    if (byNumber !== 0) return byNumber;
    return toText(a.id).localeCompare(toText(b.id), "ja");
  });
}

async function fetchEligibleCharacterRowsByIds(
  ids: string[],
  filters?: Partial<BingoCharacterFilters>
): Promise<GenericRow[]> {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) return [];

  const supabase = getSupabaseServerClient();
  const query = supabase
    .from(getCharactersTableName())
    .select("id,name,name_kana,icon_path,number,element,obtain,gacha,form")
    .in("id", uniqueIds)
    .or(buildEligibleCharacterFilter());
  const { data, error } = await applyCharacterFilters(query, filters);

  if (error) {
    throw new Error(`キャラクター取得に失敗しました: ${error.message}`);
  }

  return (data ?? []) as GenericRow[];
}

export async function fetchBingoInitialCharacters(
  limit = 60,
  filters?: Partial<BingoCharacterFilters>
): Promise<BingoCharacterSummary[]> {
  const supabase = getSupabaseServerClient();
  const r2BaseUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL);
  const query = supabase
    .from(getCharactersTableName())
    .select("id,name,name_kana,icon_path,number,element,obtain,gacha,form")
    .or(buildEligibleCharacterFilter())
    .order("number", { ascending: true });
  const { data, error } = await applyCharacterFilters(query, filters).limit(Math.max(1, Math.min(120, limit)));

  if (error) {
    throw new Error(`キャラクター一覧の取得に失敗しました: ${error.message}`);
  }

  return dedupeRowsByNameKeepingSmallestNumber(
    ((data ?? []) as GenericRow[]).filter((row) => !isExcludedCharacterId(toText(row.id)))
  )
    .map((row) => toCharacterSummary(row, supabase, r2BaseUrl))
    .filter((row): row is BingoCharacterSummary => Boolean(row));
}

export async function fetchBingoCharacterPage(
  query: string,
  offset = 0,
  limit = 48,
  filters?: Partial<BingoCharacterFilters>
): Promise<BingoCharacterPage> {
  const normalizedOffset = Math.max(0, Math.trunc(offset));
  const normalizedLimit = Math.max(1, Math.min(80, Math.trunc(limit)));
  const trimmed = query.trim();
  const supabase = getSupabaseServerClient();
  const r2BaseUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL);

  if (!trimmed) {
    const baseQuery = supabase
      .from(getCharactersTableName())
      .select("id,name,name_kana,icon_path,number,element,obtain,gacha,form")
      .or(buildEligibleCharacterFilter())
      .order("number", { ascending: true });
    const { data, error } = await applyCharacterFilters(baseQuery, filters).range(
      normalizedOffset,
      normalizedOffset + normalizedLimit - 1
    );

    if (error) {
      throw new Error(`キャラクター一覧の取得に失敗しました: ${error.message}`);
    }

    const rows = (data ?? []) as GenericRow[];
    const characters = dedupeRowsByNameKeepingSmallestNumber(
      rows.filter((row) => !isExcludedCharacterId(toText(row.id)) && matchesAppliedFilters(row, filters))
    )
      .map((row) => toCharacterSummary(row, supabase, r2BaseUrl))
      .filter((row): row is BingoCharacterSummary => Boolean(row));

    return {
      characters,
      nextOffset: normalizedOffset + rows.length,
      hasMore: rows.length === normalizedLimit,
    };
  }

  const searchLimit = Math.max((normalizedOffset + normalizedLimit) * 4, 80);
  const characters = await searchBingoCharacters(trimmed, searchLimit, filters);
  return {
    characters: characters.slice(normalizedOffset, normalizedOffset + normalizedLimit),
    nextOffset: Math.min(characters.length, normalizedOffset + normalizedLimit),
    hasMore: characters.length > normalizedOffset + normalizedLimit,
  };
}

export async function searchBingoCharacters(
  query: string,
  limit = 24,
  filters?: Partial<BingoCharacterFilters>
): Promise<BingoCharacterSummary[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return fetchBingoInitialCharacters(limit, filters);
  }

  const supabase = getSupabaseServerClient();
  const r2BaseUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL);
  const escaped = trimmed.replace(/[%_,]/g, (value) => `\\${value}`);
  const like = `%${escaped}%`;
  const searchLimit = Math.max(limit * 4, 40);

  const characterSearchQuery: any = (supabase as any)
    .from(getCharactersTableName())
    .select("id,number")
    .or(`name.ilike.${like},name_kana.ilike.${like}`)
    .or(buildEligibleCharacterFilter())
    .order("number", { ascending: true });

  const [otherResult, characterResult] = await Promise.all([
    supabase
      .from(getCharacterOtherTableName())
      .select("id,number")
      .or(`name.ilike.${like},name_kana.ilike.${like},name2.ilike.${like},name2_kana.ilike.${like}`)
      .order("number", { ascending: true })
      .limit(searchLimit),
    applyCharacterFilters(characterSearchQuery, filters).limit(searchLimit),
  ]);

  if (otherResult.error) {
    throw new Error(`キャラクター検索に失敗しました: ${otherResult.error.message}`);
  }
  if (characterResult.error) {
    throw new Error(`キャラクター検索に失敗しました: ${characterResult.error.message}`);
  }

  const orderedIds: string[] = [];
  const pushId = (id: string) => {
    if (id && !orderedIds.includes(id)) orderedIds.push(id);
  };

  for (const row of (otherResult.data ?? []) as GenericRow[]) pushId(toText(row.id));
  for (const row of (characterResult.data ?? []) as GenericRow[]) pushId(toText(row.id));
  if (orderedIds.length === 0) return [];

  const eligibleRows = await fetchEligibleCharacterRowsByIds(orderedIds, filters);
  const orderIndex = new Map<string, number>(orderedIds.map((id, index) => [id, index]));

  return eligibleRows
    .slice()
    .filter((row) => !isExcludedCharacterId(toText(row.id)) && matchesAppliedFilters(row, filters))
    .sort((a, b) => {
      const byNumber = toNumber(a.number) - toNumber(b.number);
      if (byNumber !== 0) return byNumber;
      const aId = toText(a.id);
      const bId = toText(b.id);
      return (orderIndex.get(aId) ?? Number.POSITIVE_INFINITY) - (orderIndex.get(bId) ?? Number.POSITIVE_INFINITY);
    })
    .filter((row, index, rows) => rows.findIndex((entry) => toText(entry.name) === toText(row.name)) === index)
    .slice(0, limit)
    .map((row) => toCharacterSummary(row, supabase, r2BaseUrl))
    .filter((row): row is BingoCharacterSummary => Boolean(row));
}

async function fetchCharacterMapByIds(ids: string[]): Promise<Map<string, BingoCharacterSummary>> {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map();

  const supabase = getSupabaseServerClient();
  const r2BaseUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL);
  const rows = await fetchEligibleCharacterRowsByIds(uniqueIds);
  const result = new Map<string, BingoCharacterSummary>();
  for (const row of rows) {
    if (isExcludedCharacterId(toText(row.id))) continue;
    const summary = toCharacterSummary(row, supabase, r2BaseUrl);
    if (summary) result.set(summary.id, summary);
  }
  return result;
}

export async function fetchBingoCharactersByIds(ids: string[]): Promise<BingoCharacterSummary[]> {
  const uniqueIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (uniqueIds.length === 0) return [];

  const characterMap = await fetchCharacterMapByIds(uniqueIds);
  return uniqueIds
    .map((id) => characterMap.get(id))
    .filter((character): character is BingoCharacterSummary => Boolean(character));
}

export async function insertBingoSubmission(
  input: unknown,
  deviceToken: string
): Promise<{ stored: boolean; message?: string }> {
  const payload = normalizeBingoSubmissionPayload(input);
  const tableName = getBingoPredictionTableName();
  const supabase = getSupabaseServiceRoleClient();
  const tokenHash = hashDeviceToken(deviceToken.trim());
  const characterIds = payload.characters.map((character) => character.id);
  const eligibleCharacters = await fetchBingoCharactersByIds(characterIds);

  if (eligibleCharacters.length !== BINGO_GRID_SIZE) {
    throw new Error("ランキング対象外のキャラクターが含まれています");
  }

  const { error } = await supabase.from(tableName).upsert(
    {
      token_hash: tokenHash,
      character_ids: characterIds,
    },
    {
      onConflict: "token_hash",
      ignoreDuplicates: false,
    }
  );

  if (error) {
    if (isMissingTableError(error.message)) {
      return {
        stored: false,
        message: "Supabaseにビンゴ集計テーブルがありません。TierMaker/supabase/bingo_predictions.sql を実行してください。",
      };
    }
    throw new Error(`ビンゴ予想の保存に失敗しました: ${error.message}`);
  }

  return {
    stored: true,
    message: "ビンゴ予想をランキング対象として保存しました。",
  };
}

export async function fetchBingoRanking(): Promise<BingoRanking> {
  const supabase = getSupabaseServerClient();
  const tableName = getBingoPredictionTableName();
  const { data, error } = await supabase.from(tableName).select("character_ids");

  if (error) {
    if (isMissingTableError(error.message)) {
      return emptyBingoRanking();
    }
    throw new Error(`ビンゴランキングの取得に失敗しました: ${error.message}`);
  }

  const rows = (data ?? []) as BingoPredictionRow[];
  const counts = new Map<string, number>();
  for (const row of rows) {
    const ids = [...new Set(row.character_ids ?? [])];
    for (const id of ids) {
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }

  const sorted = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja"))
    .slice(0, MAX_BINGO_RANKING);
  const characterMap = await fetchCharacterMapByIds(sorted.map(([id]) => id));

  return {
    totalSubmissions: rows.length,
    characterRanking: sorted.map(([characterId, count]) => {
      const character = characterMap.get(characterId);
      return {
        id: characterId,
        name: character?.name ?? characterId,
        nameKana: character?.nameKana ?? "",
        iconUrl: character?.iconUrl ?? "",
        count,
      };
    }),
  };
}

export function coerceBingoPayload(input: unknown): BingoSubmissionPayload {
  return normalizeBingoSubmissionPayload(input);
}
