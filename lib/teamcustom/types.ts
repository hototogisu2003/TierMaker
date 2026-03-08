export type CharacterItem = {
  id: string;
  name: string;
  nameKana: string;
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
  iconPath: string;
  iconUrl: string;
};

export type ShugojuItem = {
  id: string;
  name: string;
  iconPath: string;
  iconUrl: string;
};

export type TeamSlot = {
  slotIndex: number;
  characterId: string;
  characterName: string;
  iconUrl: string;
  fruits: string[];
  crests: string[];
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
  slots: TeamSlot[];
  memoText?: string;
  createdAt: string;
};
