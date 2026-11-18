import "server-only";
import { unstable_cache } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type ShugojuMasterRow = {
  id: string | number;
  name: string | null;
  name_kana: string | null;
  icon_path: string | number | null;
};

export type CharacterMasterRow = ShugojuMasterRow & {
  hp: number | string | null;
  attack: number | string | null;
  speed: number | string | null;
  shuzoku: string | null;
  gekishu: string | null;
  senkei: string | null;
  ゲージ: number | string | null;
  element: string | null;
  obtain: string | null;
  gacha: string | null;
  form: string | null;
  quest: string | null;
  content: string | null;
  get: number | string | null;
  number: number | string | null;
};

export type CharacterMasterResponse = {
  characters: (CharacterMasterRow & { iconUrl: string })[];
  shugojus: (ShugojuMasterRow & { iconUrl: string })[];
  shugojuLoadError: string | null;
};

const cacheOptions = { revalidate: 3600 };
const rowLimit = 5000;

function getMasterClient() {
  return getSupabaseServerClient({
    fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
  });
}

async function readCharacters(table: string): Promise<CharacterMasterRow[]> {
  const { data, error } = await getMasterClient()
    .from(table)
    .select('id,name,name_kana,hp,attack,speed,shuzoku,gekishu,senkei,"ゲージ",element,obtain,gacha,form,quest,content,get,number,icon_path')
    .abortSignal(AbortSignal.timeout(8000))
    .order("number", { ascending: true })
    .order("id", { ascending: true })
    .limit(rowLimit);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as CharacterMasterRow[];
}

async function readShugojus(table: string): Promise<ShugojuMasterRow[]> {
  const { data, error } = await getMasterClient()
    .from(table)
    .select("id,name,name_kana,icon_path")
    .abortSignal(AbortSignal.timeout(8000))
    .order("id", { ascending: true })
    .limit(rowLimit);
  if (error) throw new Error(error.message);
  return (data ?? []) as ShugojuMasterRow[];
}

export function loadCharacterMaster() {
  return unstable_cache(
    readCharacters,
    ["character-master", process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""],
    cacheOptions,
  )(process.env.NEXT_PUBLIC_CHARACTERS_TABLE ?? "characters");
}

export function loadShugojuMaster() {
  return unstable_cache(
    readShugojus,
    ["shugoju-master", process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""],
    cacheOptions,
  )(process.env.NEXT_PUBLIC_SHUGOJU_TABLE ?? "shugoju");
}

export function createMasterIconUrl() {
  const r2Base = (process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL ?? "").trim().replace(/\/+$/, "");
  if (r2Base) {
    return (path: string) => /^https?:\/\//i.test(path) ? path : `${r2Base}/${path.replace(/^\/+/, "")}`;
  }

  const bucket = getSupabaseServerClient().storage.from(process.env.NEXT_PUBLIC_ICON_BUCKET ?? "characters");
  return (path: string) => /^https?:\/\//i.test(path) ? path : bucket.getPublicUrl(path).data.publicUrl;
}
