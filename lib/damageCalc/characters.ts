import "server-only";

import { getSupabaseServerClient } from "@/lib/supabase/server";

type GenericRow = Record<string, unknown>;

export type DamageCalcCharacter = {
  id: string;
  name: string;
  nameKana: string;
  attack: number;
  iconUrl: string;
};

function toText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

function toNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildIconUrl(row: GenericRow, supabase: ReturnType<typeof getSupabaseServerClient>): string {
  const iconPath = toText(row.icon_path);
  if (!iconPath) return "";
  if (/^https?:\/\//i.test(iconPath)) return iconPath;
  const r2BaseUrl = (process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL ?? "").trim().replace(/\/+$/, "");
  if (r2BaseUrl) return `${r2BaseUrl}/${iconPath.replace(/^\/+/, "")}`;
  return supabase.storage
    .from(process.env.NEXT_PUBLIC_ICON_BUCKET ?? "characters")
    .getPublicUrl(iconPath).data.publicUrl;
}

function toCharacter(
  row: GenericRow,
  supabase: ReturnType<typeof getSupabaseServerClient>
): DamageCalcCharacter | null {
  const id = toText(row.id);
  if (!id) return null;
  return {
    id,
    name: toText(row.name) || id,
    nameKana: toText(row.name_kana),
    attack: toNumber(row.attack),
    iconUrl: buildIconUrl(row, supabase),
  };
}

export async function searchDamageCalcCharacters(query: string, limit = 30): Promise<DamageCalcCharacter[]> {
  const supabase = getSupabaseServerClient();
  const charactersTable = process.env.NEXT_PUBLIC_CHARACTERS_TABLE ?? "characters";
  const normalizedLimit = Math.max(1, Math.min(limit, 60));
  const trimmed = query.trim();

  if (!trimmed) {
    const { data, error } = await supabase
      .from(charactersTable)
      .select("id,name,name_kana,attack,icon_path,number")
      .order("number", { ascending: false })
      .limit(normalizedLimit);
    if (error) throw new Error(`キャラクター一覧の取得に失敗しました: ${error.message}`);
    return ((data ?? []) as GenericRow[])
      .map((row) => toCharacter(row, supabase))
      .filter((character): character is DamageCalcCharacter => Boolean(character));
  }

  const escaped = trimmed.replace(/[%_,]/g, (value) => `\\${value}`);
  const like = `%${escaped}%`;
  const otherTable = process.env.NEXT_PUBLIC_CHARA_OTHER_TABLE ?? "chara_other";
  const [otherResult, characterResult] = await Promise.all([
    supabase
      .from(otherTable)
      .select("id,number")
      .or(`name.ilike.${like},name_kana.ilike.${like},name2.ilike.${like},name2_kana.ilike.${like}`)
      .order("number", { ascending: false })
      .limit(Math.max(normalizedLimit * 3, 30)),
    supabase
      .from(charactersTable)
      .select("id,number")
      .or(`name.ilike.${like},name_kana.ilike.${like}`)
      .order("number", { ascending: false })
      .limit(Math.max(normalizedLimit * 2, 30)),
  ]);
  if (otherResult.error) throw new Error(`キャラクター検索に失敗しました: ${otherResult.error.message}`);
  if (characterResult.error) throw new Error(`キャラクター検索に失敗しました: ${characterResult.error.message}`);

  const ids: string[] = [];
  for (const row of [...((otherResult.data ?? []) as GenericRow[]), ...((characterResult.data ?? []) as GenericRow[])]) {
    const id = toText(row.id);
    if (id && !ids.includes(id)) ids.push(id);
  }
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from(charactersTable)
    .select("id,name,name_kana,attack,icon_path,number")
    .in("id", ids);
  if (error) throw new Error(`キャラクター検索に失敗しました: ${error.message}`);

  const order = new Map(ids.map((id, index) => [id, index]));
  return ((data ?? []) as GenericRow[])
    .sort((a, b) => (order.get(toText(a.id)) ?? ids.length) - (order.get(toText(b.id)) ?? ids.length))
    .slice(0, normalizedLimit)
    .map((row) => toCharacter(row, supabase))
    .filter((character): character is DamageCalcCharacter => Boolean(character));
}
