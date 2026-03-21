export const SHOT_TYPE_OPTIONS = ["\u53cd\u5c04", "\u8cab\u901a", "\u53cd\u5c04/\u8cab\u901a"] as const;
export const GIMMICK_OPTIONS = [
  "\u91cd\u529b",
  "DW",
  "\u30ef\u30fc\u30d7",
  "\u5730\u96f7",
  "\u30d6\u30ed\u30c3\u30af",
  "\u30a6\u30a3\u30f3\u30c9",
  "\u9b54\u6cd5\u9663",
  "\u6e1b\u901f\u58c1",
  "\u8ee2\u9001\u58c1",
  "\u6e1b\u901f\u5e8a",
] as const;
export const SEIBO_QUESTS = [
  { key: "nigimitama", bossName: "\u30cb\u30ae\u30df\u30bf\u30de" },
  { key: "tougenkyo", bossName: "\u6843\u6e90\u90f7" },
  { key: "cocytus", bossName: "\u30b3\u30ad\u30e5\u30fc\u30c8\u30b9" },
  { key: "largamente", bossName: "\u30e9\u30eb\u30ac\u30e1\u30f3\u30c6" },
  { key: "melangcolin", bossName: "\u30e1\u30e9\u30f3&\u30b3\u30ea\u30f3" },
  { key: "ex", bossName: "EX" },
] as const;

export const MAX_GIMMICKS = 4;
export const MAX_CHARACTERS = 4;
export const MAX_GIMMICK_RANKING = 5;
export const MAX_CHARACTER_RANKING = 15;

export type ShotType = (typeof SHOT_TYPE_OPTIONS)[number];
export type Gimmick = (typeof GIMMICK_OPTIONS)[number];
export type SeiboQuestKey = (typeof SEIBO_QUESTS)[number]["key"];

export type SeiboCharacterSummary = {
  id: string;
  name: string;
  nameKana: string;
  iconUrl: string;
};

export type SeiboBossCard = {
  questKey: SeiboQuestKey;
  bossName: string;
  title: string;
  iconUrl: string;
};

export type SeiboQuestPrediction = {
  questKey: SeiboQuestKey;
  shotType: ShotType | "";
  gimmicks: Gimmick[];
  characters: SeiboCharacterSummary[];
};

export type SeiboSubmissionPayload = {
  predictions: SeiboQuestPrediction[];
};

export type GimmickRankingItem = {
  label: string;
  count: number;
};

export type CharacterRankingItem = SeiboCharacterSummary & {
  count: number;
};

export type SeiboQuestRanking = {
  questKey: SeiboQuestKey;
  title: string;
  totalSubmissions: number;
  gimmickRanking: GimmickRankingItem[];
  characterRanking: CharacterRankingItem[];
};
