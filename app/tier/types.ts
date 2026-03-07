export type CharacterElement = "火" | "水" | "木" | "光" | "闇";
export type CharacterObtain = "ガチャ" | "降臨" | "コラボパック";
export type CharacterGacha = "限定" | "α" | "恒常" | "コラボ";
export type CharacterOtherCategory =
  | "黎絶"
  | "轟絶"
  | "爆絶"
  | "超究極"
  | "超絶"
  | "コラボ"
  | "その他";

export type CharacterForUI = {
  id: string;
  name: string;
  nameKana: string;
  element: CharacterElement | "";
  obtain: CharacterObtain | "";
  gachaType: CharacterGacha | "";
  otherCategory: CharacterOtherCategory | "";
  isObtainable: boolean;
  sortNumber: number;
  iconPath: string;
  iconUrl: string;
};
