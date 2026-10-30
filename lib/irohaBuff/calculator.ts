export type Character = "A" | "B" | "C";
export type Stat = "atk" | "spd";
export type Spot = "none" | "main" | "mainOrSubPlus" | "sub";
export type Grade = "L" | "EL";

export const CHARACTERS = {
  A: { name: "いろは", stages: [{ k: 0.75, cap: 1.65 }, { k: 1.5, cap: 2.25 }] },
  B: { name: "ローレライα", stages: [{ k: 0.35, cap: 1.25 }, { k: 1.35, cap: 2 }] },
  C: { name: "カグヤ", stages: [{ k: 1.15, cap: 2 }, { k: 1.5, cap: 2.25 }] },
} as const;

export const SPOTS = {
  none: { atk: 0, spd: 0 },
  main: { atk: 2000, spd: 40.8 },
  mainOrSubPlus: { atk: 1500, spd: 30.6 },
  sub: { atk: 500, spd: 10.2 },
} as const;

type FruitGroup = { label: string; L: number; EL: number };
export const FRUITS: Record<Stat, readonly FruitGroup[]> = {
  atk: [
    { label: "同族加撃", L: 3000, EL: 3300 },
    { label: "同族加撃速", L: 2000, EL: 2200 },
    { label: "同族加命撃", L: 2000, EL: 2200 },
    { label: "撃種加撃", L: 1500, EL: 1650 },
    { label: "撃種加撃速", L: 1000, EL: 1100 },
    { label: "撃種加命撃", L: 1000, EL: 1100 },
    { label: "戦型加撃", L: 1500, EL: 1650 },
    { label: "戦型加撃速", L: 1000, EL: 1100 },
    { label: "戦型加命撃", L: 1000, EL: 1100 },
    { label: "孤高加撃", L: 3000, EL: 3300 },
  ],
  spd: [
    { label: "同族加速", L: 33.3, EL: 36.6 },
    { label: "同族加撃速", L: 26.6, EL: 29.3 },
    { label: "同族加速命", L: 26.6, EL: 29.3 },
    { label: "撃種加速", L: 16.6, EL: 18.3 },
    { label: "撃種加撃速", L: 13.2, EL: 14.5 },
    { label: "撃種加速命", L: 13.2, EL: 14.5 },
    { label: "戦型加速", L: 16.6, EL: 18.3 },
    { label: "戦型加撃速", L: 13.2, EL: 14.5 },
    { label: "戦型加速命", L: 13.2, EL: 14.5 },
  ],
};

export type Inputs = { atk: string; spd: string; atkBonus: string; spdBonus: string };
export type BuffState = Inputs & {
  character: Character;
  spot: Spot;
  fruits: Record<Stat, Record<string, Grade | undefined>>;
};

export function createInitialState(character: Character = "A"): BuffState {
  return { character, atk: "", spd: "", atkBonus: "", spdBonus: "", spot: "none", fruits: { atk: {}, spd: {} } };
}

export function formatNumber(value: number): string {
  return Number.isFinite(value) ? String(Number(value.toFixed(6))) : "-";
}

// Bonus fields contain the complete total, including selected fruits and spot.
// Apply only the difference so manually entered additions are retained.
export function selectSpot(state: BuffState, spot: Spot): BuffState {
  return {
    ...state, spot,
    atkBonus: formatNumber(Number(state.atkBonus) - SPOTS[state.spot].atk + SPOTS[spot].atk),
    spdBonus: formatNumber(Number(state.spdBonus) - SPOTS[state.spot].spd + SPOTS[spot].spd),
  };
}

export function toggleFruit(state: BuffState, stat: Stat, label: string, grade: Grade): BuffState {
  const group = FRUITS[stat].find((fruit) => fruit.label === label);
  if (!group) return state;
  const previous = state.fruits[stat][label];
  const next = previous === grade ? undefined : grade;
  const field = stat === "atk" ? "atkBonus" : "spdBonus";
  return {
    ...state,
    [field]: formatNumber(Number(state[field]) - (previous ? group[previous] : 0) + (next ? group[next] : 0)),
    fruits: { ...state.fruits, [stat]: { ...state.fruits[stat], [label]: next } },
  };
}

export function calculateBuff(inputs: Inputs, character: Character) {
  const atk = Number(inputs.atk);
  const spd = Number(inputs.spd);
  if (!inputs.atk.trim() || !inputs.spd.trim() || !Number.isFinite(atk) || !Number.isFinite(spd)) {
    return { error: "攻撃力とスピードを数値で入力してください。", stages: [] };
  }
  if (atk < 0 || spd < 0) {
    return { error: "攻撃力とスピードは0以上で入力してください。", stages: [] };
  }
  const effectiveAtk = atk + Number(inputs.atkBonus);
  const effectiveSpd = spd + Number(inputs.spdBonus);
  const scaledSpd = effectiveSpd * 100;
  if (![effectiveAtk, effectiveSpd, scaledSpd].every(Number.isFinite)) {
    return { error: "加撃量と加速量を有限の数値で入力してください。", stages: [] };
  }
  if (effectiveAtk <= 0 || effectiveSpd <= 0) {
    return { error: "補正後の攻撃力とスピードは、どちらも0より大きい値にしてください。", stages: [] };
  }
  const ratio = Math.max(effectiveAtk, scaledSpd) / Math.min(effectiveAtk, scaledSpd) - 1;
  const stages = CHARACTERS[character].stages.map(({ k, cap }) => {
    const raw = 1 + k * ratio;
    return { value: Math.trunc(Math.min(raw, cap) * 1000) / 1000, cap, capped: raw > cap };
  });
  return { error: "", stages };
}
