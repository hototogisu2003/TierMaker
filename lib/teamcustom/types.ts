export type CharacterItem = {
  id: string;
  name: string;
  nameKana: string;
  hp: number;
  attack: number;
  speed: number;
  hasGauge: boolean;
  shuzoku: string;
  gekishu: string;
  senkei: string;
  element: "火" | "水" | "木" | "光" | "闇" | "";
  obtain: "ガチャ" | "降臨" | "コラボパック" | "";
  gachaType: "限定" | "α" | "恒常" | "コラボ" | "";
  formType: "進化/神化" | "獣神化" | "獣神化改" | "真獣神化" | "";
  otherCategory: "黎絶" | "轟絶" | "爆絶" | "超絶" | "超究極" | "コラボ" | "その他" | "";
  isObtainable: boolean;
  sortNumber: number;
  iconPath: string;
  iconUrl: string;
};

export type QuestItem = {
  id: string;
  name: string;
  nameKana: string;
  element: CharacterItem["element"];
  questTag: string;
  contentTag: string;
  iconPath: string;
  iconUrl: string;
};

export type ShugojuItem = {
  id: string;
  name: string;
  nameKana: string;
  iconPath: string;
  iconUrl: string;
};

export type SpotKey = "火" | "水" | "木" | "光" | "闇" | "王者";

export type FruitGrade = "L" | "EL";
export type CrestGrade = 0 | 1 | 2;

export type TeamSlot = {
  slotIndex: number;
  characterId: string;
  characterName: string;
  iconUrl: string;
  fruits: string[];
  fruitGradesList?: FruitGrade[];
  fruitGrades?: Record<string, FruitGrade>;
  crests: string[];
  crestGrades?: Record<string, CrestGrade>;
  slotMemo?: string;
};

export type TeamRecord = {
  id: string;
  title: string;
  targetQuestId: string | null;
  targetQuestName: string | null;
  targetQuestIconUrl: string | null;
  shugojuId?: string | null;
  shugojuName?: string | null;
  shugojuIconUrl?: string | null;
  mainSpot?: SpotKey | null;
  subSpot?: SpotKey | null;
  slots: TeamSlot[];
  memoText?: string;
  createdAt: string;
};
