import { createClient } from "@supabase/supabase-js";
import type {
  CharacterContent,
  CharacterElement,
  CharacterForm,
  CharacterForUI,
  CharacterGacha,
  CharacterObtain,
  CharacterOtherCategory,
  PoolSourceType,
} from "./types";

type CharacterRow = {
  id: string | number;
  name?: string | null;
  name_kana?: string | null;
  element?: string | null;
  obtain?: string | null;
  gacha?: string | null;
  form?: string | null;
  content?: string | null;
  quest?: string | null;
  get?: number | string | null;
  number?: number | string | null;
  icon_path: string;
};

type ShugojuRow = {
  id: string | number;
  name?: string | null;
  name_kana?: string | null;
  icon_path: string;
};

type LoadTierDataResult = {
  characters: CharacterForUI[];
  shugoju: CharacterForUI[];
};

function normalizeBaseUrl(value: string | undefined): string {
  return (value ?? "").trim().replace(/\/+$/, "");
}

function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function joinUrl(base: string, path: string): string {
  return `${base}/${path.replace(/^\/+/, "")}`;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function toStringId(id: string | number): string {
  return typeof id === "number" ? String(id) : id;
}

function toScopedId(sourceType: PoolSourceType, id: string | number): string {
  return `${sourceType}:${toStringId(id)}`;
}

function toSortableNumber(value: number | string | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
  }
  return Number.POSITIVE_INFINITY;
}

function isObtainableFromGet(value: number | string | null | undefined): boolean {
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed !== 0 : true;
  }
  return true;
}

function normalizeElement(raw: string | null | undefined): CharacterElement | "" {
  const value = (raw ?? "").trim().toLowerCase();
  if (value === "火" || value === "fire") return "火";
  if (value === "水" || value === "water") return "水";
  if (value === "木" || value === "wood") return "木";
  if (value === "光" || value === "light") return "光";
  if (value === "闇" || value === "dark") return "闇";
  return "";
}

function normalizeObtain(raw: string | null | undefined): CharacterObtain | "" {
  const value = (raw ?? "").trim().toLowerCase();
  if (value === "ガチャ" || value === "gacha") return "ガチャ";
  if (value === "降臨") return "降臨";
  if (value === "その他" || value === "other") return "降臨";
  if (value === "コラボパック" || value === "collabpack" || value === "collab pack") {
    return "コラボパック";
  }
  return "";
}

function normalizeGacha(raw: string | null | undefined): CharacterGacha | "" {
  const value = (raw ?? "").trim().toLowerCase();
  if (value === "限定" || value === "limited") return "限定";
  if (value === "α" || value === "alpha") return "α";
  if (value === "恒常" || value === "normal") return "恒常";
  if (value === "コラボ" || value === "collab") return "コラボ";
  return "";
}

function normalizeForm(raw: string | null | undefined): CharacterForm | "" {
  const value = (raw ?? "").trim();
  if (value === "進化/神化") return "進化/神化";
  if (value === "獣神化") return "獣神化";
  if (value === "獣神化改") return "獣神化改";
  if (value === "真獣神化") return "真獣神化";
  return "";
}

function normalizeContent(raw: string | null | undefined): CharacterContent | "" {
  const value = (raw ?? "").trim();
  if (value === "破界の星墓") return "破界の星墓";
  if (value === "天魔の孤城") return "天魔の孤城";
  if (value === "禁忌の獄") return "禁忌の獄";
  return "";
}

function normalizeOtherCategory(raw: string | null | undefined): CharacterOtherCategory | "" {
  const value = (raw ?? "").trim().toLowerCase();
  if (value === "黎絶") return "黎絶";
  if (value === "轟絶") return "轟絶";
  if (value === "爆絶") return "爆絶";
  if (value === "超絶") return "超絶";
  if (value === "超究極") return "超究極";
  if (value === "コラボ" || value === "collab") return "コラボ";
  if (value === "その他" || value === "other") return "その他";
  return "";
}

function buildIconUrl(
  iconPath: string,
  r2BaseUrl: string,
  bucketName: string,
  getPublicUrl: (path: string) => string
): string {
  if (isAbsoluteUrl(iconPath)) return iconPath;
  if (r2BaseUrl) return joinUrl(r2BaseUrl, iconPath);
  return getPublicUrl(iconPath) || iconPath;
}

function mapBaseCharacter(
  row: {
    id: string | number;
    name?: string | null;
    name_kana?: string | null;
    icon_path: string;
  },
  iconUrl: string,
  sourceType: PoolSourceType
): Pick<CharacterForUI, "id" | "name" | "nameKana" | "iconPath" | "iconUrl" | "sourceType"> {
  return {
    id: toScopedId(sourceType, row.id),
    name: (row.name ?? "").trim() || toStringId(row.id),
    nameKana: (row.name_kana ?? "").trim(),
    iconPath: row.icon_path,
    iconUrl,
    sourceType,
  };
}

export async function loadTierCharacters(): Promise<LoadTierDataResult> {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  const charactersTableName = process.env.NEXT_PUBLIC_CHARACTERS_TABLE ?? "characters";
  const shugojuTableName = process.env.NEXT_PUBLIC_SHUGOJU_TABLE ?? "shugoju";
  const bucketName = process.env.NEXT_PUBLIC_ICON_BUCKET ?? "characters";
  const r2BaseUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL);

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  });

  const getPublicUrl = (path: string) => {
    const { data } = supabase.storage.from(bucketName).getPublicUrl(path);
    return data?.publicUrl ?? "";
  };

  const [characterResult, shugojuResult] = await Promise.all([
    supabase
      .from(charactersTableName)
      .select("id,name,name_kana,element,obtain,gacha,form,content,quest,get,number,icon_path")
      .abortSignal(AbortSignal.timeout(8000))
      .order("number", { ascending: true })
      .order("id", { ascending: true })
      .limit(5000),
    supabase
      .from(shugojuTableName)
      .select("id,name,name_kana,icon_path")
      .abortSignal(AbortSignal.timeout(8000))
      .order("id", { ascending: true })
      .limit(5000),
  ]);

  if (characterResult.error) {
    throw characterResult.error;
  }
  if (shugojuResult.error) {
    throw shugojuResult.error;
  }

  const characterRows = ((characterResult.data ?? []) as CharacterRow[])
    .filter((row) => typeof row.icon_path === "string" && row.icon_path.length > 0)
    .slice()
    .sort((a, b) => {
      const left = toSortableNumber(a.number);
      const right = toSortableNumber(b.number);
      if (left !== right) return left - right;
      return toStringId(a.id).localeCompare(toStringId(b.id), "ja");
    });

  const shugojuRows = ((shugojuResult.data ?? []) as ShugojuRow[])
    .filter((row) => typeof row.icon_path === "string" && row.icon_path.length > 0)
    .slice()
    .sort((a, b) => {
      const left = toSortableNumber(a.id);
      const right = toSortableNumber(b.id);
      if (left !== right) return left - right;
      return toStringId(a.id).localeCompare(toStringId(b.id), "ja");
    });

  const characters = characterRows.map((row) => {
    const iconUrl = buildIconUrl(row.icon_path, r2BaseUrl, bucketName, getPublicUrl);
    return {
      ...mapBaseCharacter(row, iconUrl, "character"),
      element: normalizeElement(row.element),
      obtain: normalizeObtain(row.obtain),
      gachaType: normalizeGacha(row.gacha),
      formType: normalizeForm(row.form),
      contentType: normalizeContent(row.content),
      otherCategory: normalizeOtherCategory(row.quest),
      isObtainable: isObtainableFromGet(row.get),
      sortNumber: toSortableNumber(row.number),
    } satisfies CharacterForUI;
  });

  const shugoju = shugojuRows.map((row) => {
    const iconUrl = buildIconUrl(row.icon_path, r2BaseUrl, bucketName, getPublicUrl);
    return {
      ...mapBaseCharacter(row, iconUrl, "shugoju"),
      element: "",
      obtain: "",
      gachaType: "",
      formType: "",
      contentType: "",
      otherCategory: "",
      isObtainable: true,
      sortNumber: toSortableNumber(row.id),
    } satisfies CharacterForUI;
  });

  return { characters, shugoju };
}
