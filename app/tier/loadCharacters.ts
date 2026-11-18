import {
  createMasterIconUrl,
  loadCharacterMaster,
  loadShugojuMaster,
  type ShugojuMasterRow,
} from "@/lib/characterMaster/server";
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

type LoadTierDataResult = {
  characters: CharacterForUI[];
  shugoju: CharacterForUI[];
};

function hasIcon<Row extends ShugojuMasterRow>(row: Row): row is Row & { icon_path: string } {
  return typeof row.icon_path === "string" && row.icon_path.length > 0;
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
  if (value === "滅絶") return "滅絶";
  if (value === "黎絶") return "黎絶";
  if (value === "轟絶") return "轟絶";
  if (value === "爆絶") return "爆絶";
  if (value === "超絶") return "超絶";
  if (value === "超究極") return "超究極";
  if (value === "コラボ" || value === "collab") return "コラボ";
  if (value === "その他" || value === "other") return "その他";
  return "";
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
  const [characterMaster, shugojuMaster] = await Promise.all([loadCharacterMaster(), loadShugojuMaster()]);
  const getIconUrl = createMasterIconUrl();

  const characterRows = characterMaster
    .filter(hasIcon)
    .sort((a, b) => {
      const left = toSortableNumber(a.number);
      const right = toSortableNumber(b.number);
      if (left !== right) return left - right;
      return toStringId(a.id).localeCompare(toStringId(b.id), "ja");
    });

  const shugojuRows = shugojuMaster
    .filter(hasIcon)
    .sort((a, b) => {
      const left = toSortableNumber(a.id);
      const right = toSortableNumber(b.id);
      if (left !== right) return left - right;
      return toStringId(a.id).localeCompare(toStringId(b.id), "ja");
    });

  const characters = characterRows.map((row) => {
    const iconUrl = getIconUrl(row.icon_path);
    return {
      ...mapBaseCharacter(row, iconUrl, "character"),
      element: normalizeElement(row.element),
      obtain: normalizeObtain(row.obtain),
      gachaType: normalizeGacha(row.gacha),
      formType: normalizeForm(row.form),
      contentType: normalizeContent(row.content),
      otherCategory: normalizeOtherCategory(row.quest),
      sortNumber: toSortableNumber(row.number),
    } satisfies CharacterForUI;
  });

  const shugoju = shugojuRows.map((row) => {
    const iconUrl = getIconUrl(row.icon_path);
    return {
      ...mapBaseCharacter(row, iconUrl, "shugoju"),
      element: "",
      obtain: "",
      gachaType: "",
      formType: "",
      contentType: "",
      otherCategory: "",
      sortNumber: toSortableNumber(row.id),
    } satisfies CharacterForUI;
  });

  return { characters, shugoju };
}
