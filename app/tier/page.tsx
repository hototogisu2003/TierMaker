import { createClient } from "@supabase/supabase-js";
import { unstable_noStore as noStore } from "next/cache";
import type { Metadata } from "next";
import TierMaker from "@/component/tiers/TierMaker";
import type {
  CharacterElement,
  CharacterForUI,
  CharacterGacha,
  CharacterObtain,
  CharacterOtherCategory,
} from "./types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "モンストTierメーカー",
};

type CharacterRow = {
  id: string | number;
  name?: string | null;
  name_kana?: string | null;
  element?: string | null;
  obtain?: string | null;
  gacha?: string | null;
  quest?: string | null;
  number?: number | string | null;
  release_year?: number | string | null;
  icon_path: string;
};

function normalizeBaseUrl(v: string | undefined): string {
  return (v ?? "").trim().replace(/\/+$/, "");
}

function isAbsoluteUrl(v: string): boolean {
  return /^https?:\/\//i.test(v);
}

function joinUrl(base: string, path: string): string {
  return `${base}/${path.replace(/^\/+/, "")}`;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return v;
}

function toStringId(id: string | number): string {
  return typeof id === "number" ? String(id) : id;
}

function toSortableNumber(v: number | string | null | undefined): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : Number.POSITIVE_INFINITY;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
  }
  return Number.POSITIVE_INFINITY;
}

function toNullableNumber(v: number | string | null | undefined): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function normalizeElement(raw: string | null | undefined): CharacterElement | "" {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "火" || v === "fire") return "火";
  if (v === "水" || v === "water") return "水";
  if (v === "木" || v === "wood") return "木";
  if (v === "光" || v === "light") return "光";
  if (v === "闇" || v === "dark") return "闇";
  return "";
}

function normalizeObtain(raw: string | null | undefined): CharacterObtain | "" {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "ガチャ" || v === "gacha") return "ガチャ";
  if (v === "降臨") return "降臨";
  if (v === "その他" || v === "other") return "降臨";
  if (v === "コラボパック" || v === "collabpack" || v === "collab pack") return "コラボパック";
  return "";
}

function normalizeGacha(raw: string | null | undefined): CharacterGacha | "" {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "限定" || v === "limited") return "限定";
  if (v === "α" || v === "alpha") return "α";
  if (v === "恒常" || v === "normal") return "恒常";
  if (v === "コラボ" || v === "collab") return "コラボ";
  return "";
}

function normalizeOtherCategory(raw: string | null | undefined): CharacterOtherCategory | "" {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "黎絶") return "黎絶";
  if (v === "轟絶") return "轟絶";
  if (v === "爆絶") return "爆絶";
  if (v === "超究極") return "超究極";
  if (v === "超絶") return "超絶";
  if (v === "コラボ" || v === "collab") return "コラボ";
  if (v === "その他" || v === "other") return "その他";
  return "";
}

export default async function TierPage() {
  noStore();

  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  const tableName = process.env.NEXT_PUBLIC_CHARACTERS_TABLE ?? "characters";
  const bucketName = process.env.NEXT_PUBLIC_ICON_BUCKET ?? "characters";
  const r2BaseUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL);

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase
    .from(tableName)
    .select("id,name,name_kana,element,obtain,gacha,quest,number,release_year,icon_path")
    .abortSignal(AbortSignal.timeout(8000))
    .order("number", { ascending: true })
    .order("id", { ascending: true })
    .limit(5000);

  if (error) {
    console.error("Supabase error:", error);
    return <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(error, null, 2)}</pre>;
  }

  const rows = ((data ?? []) as CharacterRow[]).slice().sort((a, b) => {
    const an = toSortableNumber(a.number);
    const bn = toSortableNumber(b.number);
    if (an !== bn) return an - bn;
    return toStringId(a.id).localeCompare(toStringId(b.id), "ja");
  });

  const characters: CharacterForUI[] = rows
    .filter((r) => typeof r.icon_path === "string" && r.icon_path.length > 0)
    .map((r) => {
      const iconPath = r.icon_path;
      let iconUrl = iconPath;
      if (isAbsoluteUrl(iconPath)) {
        iconUrl = iconPath;
      } else if (r2BaseUrl) {
        iconUrl = joinUrl(r2BaseUrl, iconPath);
      } else {
        const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(iconPath);
        iconUrl = urlData?.publicUrl ?? iconPath;
      }

      return {
        id: toStringId(r.id),
        name: (r.name ?? "").trim() || toStringId(r.id),
        nameKana: (r.name_kana ?? "").trim(),
        element: normalizeElement(r.element),
        obtain: normalizeObtain(r.obtain),
        gachaType: normalizeGacha(r.gacha),
        otherCategory: normalizeOtherCategory(r.quest),
        catalogNumber: toNullableNumber(r.number),
        releaseYear: toNullableNumber(r.release_year),
        sortNumber: toSortableNumber(r.number),
        iconPath,
        iconUrl,
      };
    });

  return (
    <section className="stack">
      <TierMaker characters={characters} initialTiers={["S", "A", "B", "C", "D", "E"]} />
    </section>
  );
}
