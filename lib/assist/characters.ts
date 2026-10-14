export const ASSIST_FILTERS = [
  { key: "attack_up", label: "攻撃アップ" },
  { key: "friendship_up", label: "友情アップ" },
  { key: "hp_up", label: "HPアップ" },
  { key: "ss_shortening", label: "SS短縮" },
  { key: "damage_reduction", label: "ダメージ軽減" },
  { key: "recovery", label: "回復" },
  { key: "barrier_grant", label: "バリア付与" },
  { key: "status_grant", label: "状態付与" },
] as const;

export type AssistFilter = (typeof ASSIST_FILTERS)[number]["key"];
export type AssistSort = "number" | "ratio";
export type AssistCharacter = {
  number: number;
  ratio: number | null;
  name: string;
  assist_skill: string;
  iconUrl: string;
} & Record<AssistFilter, 0 | 1>;

export function filterAssistCharacters(
  characters: AssistCharacter[],
  query: string,
  filters: readonly AssistFilter[],
  sort: AssistSort = "number",
): AssistCharacter[] {
  const text = query.trim();
  return characters
    .filter((character) => character.assist_skill.includes(text) && filters.every((key) => character[key] === 1))
    .sort((a, b) => {
      if (sort === "ratio" && filters.includes("attack_up")) {
        if (a.ratio == null && b.ratio != null) return 1;
        if (a.ratio != null && b.ratio == null) return -1;
        if (a.ratio != null && b.ratio != null && a.ratio !== b.ratio) return b.ratio - a.ratio;
      }
      return b.number - a.number;
    });
}
