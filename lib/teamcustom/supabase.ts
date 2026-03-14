import { createClient } from "@supabase/supabase-js";
import type { CharacterItem, QuestItem, ShugojuItem } from "@/lib/teamcustom/types";

type GenericRow = Record<string, unknown>;

function must(name: string): string {
  const value =
    name === "NEXT_PUBLIC_SUPABASE_URL"
      ? process.env.NEXT_PUBLIC_SUPABASE_URL
      : name === "NEXT_PUBLIC_SUPABASE_ANON_KEY"
        ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        : undefined;
  if (!value) {
    throw new Error(`Missing env: ${name}`);
  }
  return value;
}

function normalizeBaseUrl(v: string | undefined): string {
  return (v ?? "").trim().replace(/\/+$/, "");
}

function toText(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return "";
}

function toNumber(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : Number.POSITIVE_INFINITY;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
  }
  return Number.POSITIVE_INFINITY;
}

function toStatNumber(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function isObtainable(getValue: unknown): boolean {
  if (typeof getValue === "number") return getValue !== 0;
  if (typeof getValue === "string") {
    const n = Number(getValue);
    if (Number.isFinite(n)) return n !== 0;
  }
  return true;
}

function buildPublicUrl(path: string, baseUrl: string, fallback: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (baseUrl) return `${baseUrl}/${path.replace(/^\/+/, "")}`;
  return fallback;
}

function normalizeElement(raw: string): CharacterItem["element"] {
  const v = raw.trim().toLowerCase();
  if (v === "火" || v === "fire") return "火";
  if (v === "水" || v === "water") return "水";
  if (v === "木" || v === "wood") return "木";
  if (v === "光" || v === "light") return "光";
  if (v === "闇" || v === "dark") return "闇";
  return "";
}

function normalizeObtain(raw: string): CharacterItem["obtain"] {
  const v = raw.trim().toLowerCase();
  if (v === "ガチャ" || v === "gacha") return "ガチャ";
  if (v === "降臨") return "降臨";
  if (v === "コラボパック" || v === "collabpack" || v === "collab pack") return "コラボパック";
  return "";
}

function normalizeGacha(raw: string): CharacterItem["gachaType"] {
  const v = raw.trim().toLowerCase();
  if (v === "限定" || v === "limited") return "限定";
  if (v === "α" || v === "alpha") return "α";
  if (v === "恒常" || v === "normal") return "恒常";
  if (v === "コラボ" || v === "collab") return "コラボ";
  return "";
}

function normalizeForm(raw: string): CharacterItem["formType"] {
  const v = raw.trim();
  if (v === "進化/神化") return "進化/神化";
  if (v === "獣神化") return "獣神化";
  if (v === "獣神化改") return "獣神化改";
  if (v === "真獣神化") return "真獣神化";
  return "";
}

function normalizeOtherCategory(raw: string): CharacterItem["otherCategory"] {
  const v = raw.trim().toLowerCase();
  if (v === "黎絶") return "黎絶";
  if (v === "轟絶") return "轟絶";
  if (v === "爆絶") return "爆絶";
  if (v === "超絶") return "超絶";
  if (v === "超究極") return "超究極";
  if (v === "コラボ" || v === "collab") return "コラボ";
  if (v === "その他" || v === "other") return "その他";
  return "";
}

export async function fetchCharactersAndQuests(): Promise<{
  characters: CharacterItem[];
  quests: QuestItem[];
  shugojus: ShugojuItem[];
  questLoadError: string | null;
  shugojuLoadError: string | null;
}> {
  const supabase = createClient(must("NEXT_PUBLIC_SUPABASE_URL"), must("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    auth: { persistSession: false },
  });

  const charactersTable = process.env.NEXT_PUBLIC_CHARACTERS_TABLE ?? "characters";
  const shugojuTable = process.env.NEXT_PUBLIC_SHUGOJU_TABLE ?? "shugoju";
  const characterBucket = process.env.NEXT_PUBLIC_ICON_BUCKET ?? "characters";
  const r2Base = normalizeBaseUrl(process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL);

  const { data: charactersData, error: charactersError } = await supabase
    .from(charactersTable)
    .select('id,name,name_kana,hp,attack,speed,shuzoku,gekishu,senkei,"ゲージ",element,obtain,gacha,form,quest,content,get,number,icon_path')
    .order("number", { ascending: true })
    .order("id", { ascending: true })
    .limit(5000);

  if (charactersError) {
    throw new Error(`Failed to load characters: ${charactersError.message}`);
  }

  const sourceRows = charactersData ?? [];
  const characters = sourceRows
    .map((row) => {
      const r = row as GenericRow;
      const id = toText(r.id).trim();
      const iconPath = toText(r.icon_path).trim();
      const name = toText(r.name).trim() || id;
      if (!id || !iconPath) return null;
      const storageUrl = supabase.storage.from(characterBucket).getPublicUrl(iconPath).data.publicUrl;
      return {
        id,
        name,
        nameKana: toText(r.name_kana).trim(),
        hp: toStatNumber(r.hp),
        attack: toStatNumber(r.attack),
        speed: toStatNumber(r.speed),
        hasGauge: isObtainable(r["ゲージ"]),
        shuzoku: toText(r.shuzoku).trim(),
        gekishu: toText(r.gekishu).trim(),
        senkei: toText(r.senkei).trim(),
        element: normalizeElement(toText(r.element)),
        obtain: normalizeObtain(toText(r.obtain)),
        gachaType: normalizeGacha(toText(r.gacha)),
        formType: normalizeForm(toText(r.form)),
        otherCategory: normalizeOtherCategory(toText(r.quest)),
        isObtainable: isObtainable(r.get),
        sortNumber: toNumber(r.number),
        iconPath,
        iconUrl: buildPublicUrl(iconPath, r2Base, storageUrl),
      } satisfies CharacterItem;
    })
    .filter((x): x is CharacterItem => Boolean(x));

  const quests = sourceRows
    .map((row) => {
      const r = row as GenericRow;
      const id = toText(r.id).trim();
      const iconPath = toText(r.icon_path).trim();
      const name = toText(r.name).trim() || id;
      const nameKana = toText(r.name_kana).trim();
      if (!id || !name) return null;
      const fallback = iconPath ? supabase.storage.from(characterBucket).getPublicUrl(iconPath).data.publicUrl : "";
      return {
        id,
        name,
        nameKana,
        element: normalizeElement(toText(r.element)),
        questTag: toText(r.quest).trim(),
        contentTag: toText(r.content).trim(),
        iconPath,
        iconUrl: iconPath ? buildPublicUrl(iconPath, r2Base, fallback) : "",
      } satisfies QuestItem;
    })
    .filter((x): x is QuestItem => Boolean(x));

  let shugojus: ShugojuItem[] = [];
  let shugojuLoadError: string | null = null;
  const { data: shugojuData, error: shugojuError } = await supabase
    .from(shugojuTable)
    .select("id,name,name_kana,icon_path")
    .order("id", { ascending: true })
    .limit(5000);

  if (shugojuError) {
    shugojuLoadError = shugojuError.message;
  } else {
    shugojus = (shugojuData ?? [])
      .map((row) => {
        const r = row as GenericRow;
        const id = toText(r.id).trim();
        const name = toText(r.name).trim() || id;
        const nameKana = toText(r.name_kana).trim();
        const iconPath = toText(r.icon_path).trim();
        if (!id || !name) return null;
        const fallback = iconPath ? supabase.storage.from(characterBucket).getPublicUrl(iconPath).data.publicUrl : "";
        return {
          id,
          name,
          nameKana,
          iconPath,
          iconUrl: iconPath ? buildPublicUrl(iconPath, r2Base, fallback) : "",
        } satisfies ShugojuItem;
      })
      .filter((x): x is ShugojuItem => Boolean(x));
  }

  return { characters, quests, shugojus, questLoadError: null, shugojuLoadError };
}
