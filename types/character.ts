// types/character.ts

/**
 * DBから取る行の最小表現（必要なら拡張してOK）
 */
export type CharacterRow = {
  id: string | number;
  name?: string | null;
  icon_path: string; // e.g. "characters/8000.jpg"
};

/**
 * UIで使う表現（TierMakerに渡す用）
 */
export type CharacterForUI = {
  id: string;       // stringに正規化
  name: string;
  iconPath: string; // storage path
  iconUrl: string;  // public url
};
