import type { FruitGroupId, FruitSelection, StageType } from "./types";

export type SelectOption = {
  label: string;
  value: string;
};

export const FRIEND_YUUGEKI_OPTIONS: SelectOption[] = [
  { label: "なし", value: "1.0" },
  { label: "L (x1.25)", value: "1.25" },
  { label: "EL (x1.275)", value: "1.275" },
];

export const GRADE_4_OPTIONS: SelectOption[] = [
  { label: "無印 (x1.5)", value: "1.5" },
  { label: "M (x2.0)", value: "2.0" },
  { label: "L (x2.5)", value: "2.5" },
  { label: "EL (x3.0)", value: "3.0" },
];

export const GRADE_3_OPTIONS: SelectOption[] = [
  { label: "無印 (x1.5)", value: "1.5" },
  { label: "M (x2.0)", value: "2.0" },
  { label: "L (x2.5)", value: "2.5" },
];

export const AURA_OPTIONS: SelectOption[] = [
  { label: "無印 (x1.5)", value: "1.5" },
  { label: "M (x2.0)", value: "2.0" },
];

export const WBOOST_GRADE_OPTIONS: SelectOption[] = [
  { label: "無印 (x1.5)", value: "1.5" },
  { label: "M (x2.0)", value: "2.0" },
  { label: "L (x2.5)", value: "2.5" },
];

export const WBOOST_WALL_OPTIONS: SelectOption[] = [
  { label: "1壁", value: "1" },
  { label: "2壁", value: "2" },
  { label: "3壁", value: "3" },
  { label: "4壁", value: "4" },
];

export const PFIELD_OPTIONS: SelectOption[] = [
  { label: "主友情 (x1.5)", value: "1.5" },
  { label: "副友情[神化] (x1.1)", value: "1.1" },
];

export const ANGRY_OPTIONS: SelectOption[] = [
  { label: "小 (x1.05)", value: "1.05" },
  { label: "中 (x1.10)", value: "1.10" },
  { label: "大 (x1.15)", value: "1.15" },
];

export const REDUCE_AB_OPTIONS: SelectOption[] = [
  { label: "L (-16%)", value: "0.16" },
  { label: "EL (-17%)", value: "0.17" },
];

export const STAGE_ATTR_DATA: Record<
  Exclude<StageType, "none">,
  { label: string; options: SelectOption[] }
> = {
  advantage: {
    label: "有利",
    options: [
      { label: "通常 (x1.33)", value: "1.33" },
      { label: "属性効果UP (x1.5016)", value: "1.5016" },
      { label: "属性効果超UP (x1.99)", value: "1.99" },
      { label: "属性効果超絶UP (x2.9998)", value: "2.9998" },
      { label: "エレメント系", value: "custom" },
    ],
  },
  disadvantage: {
    label: "不利",
    options: [
      { label: "通常 (x0.66)", value: "0.66" },
      { label: "属性効果UP (x0.4832)", value: "0.4832" },
      { label: "属性効果超UP (x0.3)", value: "0.3" },
      { label: "属性効果超絶UP (x0.3)", value: "0.3" },
    ],
  },
};

export const WALL_BOOST_DATA: Record<string, Record<string, number>> = {
  "1.5": { "1": 1.12, "2": 1.25, "3": 1.37, "4": 1.5 },
  "2.0": { "1": 1.25, "2": 1.5, "3": 1.75, "4": 2.0 },
  "2.5": { "1": 1.37, "2": 1.75, "3": 2.12, "4": 2.5 },
};

export const FRUIT_GROUPS: Array<{
  id: FruitGroupId;
  label: string;
  options: Array<{ label: string; amount: number; imageSrc: string }>;
}> = [
  {
    id: "sameAttack",
    label: "同族加撃",
    options: [
      { label: "L", amount: 3000, imageSrc: "/calc-legacy/特級L.png" },
      { label: "EL", amount: 3300, imageSrc: "/calc-legacy/特級EL.png" },
    ],
  },
  {
    id: "sameAttackSpeed",
    label: "同族加撃速",
    options: [
      { label: "L", amount: 2000, imageSrc: "/calc-legacy/特級L.png" },
      { label: "EL", amount: 2200, imageSrc: "/calc-legacy/特級EL.png" },
    ],
  },
  {
    id: "sameAttackHp",
    label: "同族加命撃",
    options: [
      { label: "L", amount: 2000, imageSrc: "/calc-legacy/特級L.png" },
      { label: "EL", amount: 2200, imageSrc: "/calc-legacy/特級EL.png" },
    ],
  },
  {
    id: "typeAttack",
    label: "撃種加撃",
    options: [
      { label: "L", amount: 1500, imageSrc: "/calc-legacy/特級L.png" },
      { label: "EL", amount: 1650, imageSrc: "/calc-legacy/特級EL.png" },
    ],
  },
  {
    id: "typeAttackSpeed",
    label: "撃種加撃速",
    options: [
      { label: "L", amount: 1000, imageSrc: "/calc-legacy/特級L.png" },
      { label: "EL", amount: 1100, imageSrc: "/calc-legacy/特級EL.png" },
    ],
  },
  {
    id: "typeAttackHp",
    label: "撃種加命撃",
    options: [
      { label: "L", amount: 1000, imageSrc: "/calc-legacy/特級L.png" },
      { label: "EL", amount: 1100, imageSrc: "/calc-legacy/特級EL.png" },
    ],
  },
  {
    id: "battleAttack",
    label: "戦型加撃",
    options: [
      { label: "L", amount: 1500, imageSrc: "/calc-legacy/特級L.png" },
      { label: "EL", amount: 1650, imageSrc: "/calc-legacy/特級EL.png" },
    ],
  },
  {
    id: "battleAttackSpeed",
    label: "戦型加撃速",
    options: [
      { label: "L", amount: 1000, imageSrc: "/calc-legacy/特級L.png" },
      { label: "EL", amount: 1100, imageSrc: "/calc-legacy/特級EL.png" },
    ],
  },
  {
    id: "battleAttackHp",
    label: "戦型加命撃",
    options: [
      { label: "L", amount: 1000, imageSrc: "/calc-legacy/特級L.png" },
      { label: "EL", amount: 1100, imageSrc: "/calc-legacy/特級EL.png" },
    ],
  },
  {
    id: "kodakaAttack",
    label: "孤高加撃",
    options: [
      { label: "L", amount: 3000, imageSrc: "/calc-legacy/特級L.png" },
      { label: "EL", amount: 3300, imageSrc: "/calc-legacy/特級EL.png" },
    ],
  },
];

export const RELEASE_NOTES = [
  { date: "2025/12/29", content: "ダークモードを追加しました。また、一部のUIを変更しました。" },
  { date: "2025/12/28", content: "アシストスキル倍率の枠を追加しました。" },
  { date: "2025/12/28", content: "リセットボタンに関する不具合を修正しました。" },
  { date: "2025/12/19", content: "モンスポット(サブ)の加撃量をチェックボックスから選べるようにしました。" },
  { date: "2025/12/19", content: "加撃量からわくわくの実を個別選択できるようにしました。" },
  { date: "2025/12/19", content: "不利属性倍率を計算できるようにしました。" },
  { date: "2025/12/18", content: "複数判定を攻撃した時にまとめて計算できる機能を追加しました。" },
  { date: "2025/12/15", content: "説明書・お問い合わせフォームを追加しました。" },
  { date: "2025/12/15", content: "9加撃L、9加撃EL、モンスポットによる加撃量の加算をチェックボックスから選択できる機能を実装しました。" },
  { date: "2025/12/10", content: "ダメージ計算結果をフッター表示に変更しました。詳細をタップすると倍率内訳を確認できます。" },
  { date: "2025/12/09", content: "SS倍率の枠を増やしました。自強化+弱点特攻のような2種の乗算が発生するSSに対して効果的です。" },
  { date: "2025/12/09", content: "直殴り/友情コンボの切り替え機能を実装しました。" },
  { date: "2025/12/09", content: "入力リセットボタンを追加しました。" },
];

export const MANUAL_STEPS_CALC = [
  "キャラクターの素の攻撃力と、加算される加撃量を入力してください。",
  "アビリティやSS、バフなどによりキャラクターにかかる倍率を選択・入力してください。",
  "紋章によりかかる倍率を選択してください。",
  "攻撃対象とする敵のデータを入力してください。",
  "ステージにかかる属性倍率およびギミック倍率を入力してください。",
];

export const MANUAL_STEPS_VERIFY = [
  "「計算モード」タブで数値・倍率をすべて入力してください。",
  "「ワンパン判定」タブに切り替え、敵の最大HPを入力してください。",
  "将命/兵命削り、10%削りアイテムを使用している場合はチェックを入れてください。",
];

export const CONTACT_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSeZ7JKaFwb9q92ilmPJGnLsRUds6kXEJ9tQfhUurErLQF6vug/viewform?usp=publish-editor";

export function createEmptyFruitSelection(): FruitSelection {
  return {
    sameAttack: null,
    sameAttackSpeed: null,
    sameAttackHp: null,
    typeAttack: null,
    typeAttackSpeed: null,
    typeAttackHp: null,
    battleAttack: null,
    battleAttackSpeed: null,
    battleAttackHp: null,
    kodakaAttack: null,
  };
}

export function getStageMagnitudeOptions(stageType: StageType): SelectOption[] {
  if (stageType === "none") return [];
  return STAGE_ATTR_DATA[stageType].options;
}

export function getInitialStageMagnitude(stageType: StageType): string {
  const options = getStageMagnitudeOptions(stageType);
  return options[0]?.value ?? "1.33";
}

export function resolveStageMagnitude(stageType: StageType, currentValue: string): string {
  const options = getStageMagnitudeOptions(stageType);
  if (!options.length) return currentValue;
  return options.some((option) => option.value === currentValue) ? currentValue : options[0].value;
}
