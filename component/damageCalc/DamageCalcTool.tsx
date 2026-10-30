"use client";

import * as React from "react";
import Link from "next/link";
import Button from "@/component/ui/button";
import Input from "@/component/ui/Input";
import {
  ANGRY_OPTIONS,
  AURA_OPTIONS,
  CONTACT_URL,
  FRIEND_YUUGEKI_OPTIONS,
  GRADE_3_OPTIONS,
  GRADE_4_OPTIONS,
  MANUAL_STEPS_CALC,
  MANUAL_STEPS_VERIFY,
  PFIELD_OPTIONS,
  REDUCE_AB_OPTIONS,
  WBOOST_GRADE_OPTIONS,
  WBOOST_WALL_OPTIONS,
  WEAK_KILLER_OPTIONS,
  getStageMagnitudeOptions,
  resolveStageMagnitude,
  type SelectOption,
} from "@/lib/damageCalc/constants";
import { calculateRequiredAttackBonus, computeDamage, getEnemyHp, judgeOneShot } from "@/lib/damageCalc/calculator";
import { createDefaultDamageCalcState } from "@/lib/damageCalc/defaultState";
import type { AttackMode, DamageCalcState, FruitGroupId, FruitSelection, SpotBonus, StageType, ThemeMode, ToolTab } from "@/lib/damageCalc/types";
import FieldRow from "./FieldRow";
import FruitPicker from "./FruitPicker";
import CharacterPicker from "./CharacterPicker";
import type { DamageCalcCharacter } from "@/lib/damageCalc/characterTypes";
import styles from "./DamageCalcTool.module.css";

type AttackEntry = {
  id: number;
  state: DamageCalcState;
  character: DamageCalcCharacter | null;
};

type AttackCollection = {
  entries: AttackEntry[];
  activeId: number;
  nextId: number;
};

function createAttackCollection(): AttackCollection {
  return {
    entries: [{ id: 1, state: createDefaultDamageCalcState(), character: null }],
    activeId: 1,
    nextId: 2,
  };
}

type BooleanField = {
  [K in keyof DamageCalcState]: DamageCalcState[K] extends boolean ? K : never;
}[keyof DamageCalcState];

type StringField = {
  [K in keyof DamageCalcState]: DamageCalcState[K] extends string ? K : never;
}[keyof DamageCalcState];

type FieldConfig =
  | { kind: "toggle"; label: string; checkedField: BooleanField; mode?: AttackMode }
  | { kind: "input"; label: string; checkedField: BooleanField; valueField: StringField; mode?: AttackMode; placeholder?: string }
  | { kind: "select"; label: string; checkedField: BooleanField; valueField: StringField; options: SelectOption[]; mode?: AttackMode }
  | {
      kind: "doubleSelect";
      label: string;
      checkedField: BooleanField;
      primaryField: StringField;
      secondaryField: StringField;
      primaryOptions: SelectOption[];
      secondaryOptions: SelectOption[];
      mode?: AttackMode;
    };

const ABILITY_STATE_FIELDS: FieldConfig[] = [
  { kind: "toggle", label: "誘発 (x0.5)", checkedField: "friendHalf", mode: "friend" },
  { kind: "toggle", label: "超ADW (x1.3)", checkedField: "superAdw", mode: "direct" },
  { kind: "input", label: "超AW", checkedField: "warpEnabled", valueField: "warpCount", placeholder: "ワープ数を入力", mode: "direct" },
  { kind: "select", label: "マインスイーパー", checkedField: "mineSweeperEnabled", valueField: "mineSweeperGrade", options: GRADE_4_OPTIONS, mode: "direct" },
  { kind: "select", label: "友情ブースト", checkedField: "friendBoostEnabled", valueField: "friendBoostGrade", options: GRADE_4_OPTIONS, mode: "friend" },
  { kind: "select", label: "底力系", checkedField: "sokoEnabled", valueField: "sokoGrade", options: GRADE_4_OPTIONS, mode: "direct" },
  { kind: "select", label: "友情底力", checkedField: "friendSokoEnabled", valueField: "friendSokoGrade", options: GRADE_4_OPTIONS, mode: "friend" },
  { kind: "select", label: "パワーオーラ", checkedField: "auraEnabled", valueField: "auraGrade", options: AURA_OPTIONS },
  {
    kind: "doubleSelect",
    label: "ウォールブースト",
    checkedField: "wallBoostEnabled",
    primaryField: "wallBoostGrade",
    secondaryField: "wallBoostWalls",
    primaryOptions: WBOOST_GRADE_OPTIONS,
    secondaryOptions: WBOOST_WALL_OPTIONS,
    mode: "direct",
  },
  { kind: "toggle", label: "ヒヨコ状態 (x1/3)", checkedField: "hiyoko" },
  { kind: "select", label: "魔法陣ブースト", checkedField: "magicCircleBoostEnabled", valueField: "magicCircleBoostGrade", options: GRADE_3_OPTIONS },
  { kind: "toggle", label: "渾身 (x3.0)", checkedField: "konshin", mode: "direct" },
  { kind: "toggle", label: "クリティカル (x7.5)", checkedField: "critical", mode: "direct" },
  { kind: "toggle", label: "友情コンボクリティカル (x3.0)", checkedField: "friendCritical", mode: "friend" },
  { kind: "toggle", label: "超パワー型（初撃x1.2）", checkedField: "superPower", mode: "direct" },
  { kind: "toggle", label: "睡眠（初撃x1.5）", checkedField: "sleep" },
  { kind: "select", label: "弱点キラー倍率", checkedField: "weakKillerEnabled", valueField: "weakKillerRate", options: WEAK_KILLER_OPTIONS },
  { kind: "input", label: "その他キラー倍率", checkedField: "killerEnabled", valueField: "killerRate" },
  { kind: "input", label: "SS倍率1", checkedField: "ss1Enabled", valueField: "ss1Rate", mode: "direct" },
  { kind: "input", label: "SS倍率2", checkedField: "ss2Enabled", valueField: "ss2Rate", mode: "direct" },
  { kind: "input", label: "その他倍率", checkedField: "otherEnabled", valueField: "otherRate" },
];

const SUPPORT_FIELDS: FieldConfig[] = [
  { kind: "select", label: "パワーフィールド", checkedField: "powerFieldEnabled", valueField: "powerFieldGrade", options: PFIELD_OPTIONS, mode: "direct" },
  { kind: "toggle", label: "友情フィールド (x1.5)", checkedField: "friendField", mode: "friend" },
  { kind: "input", label: "バフ倍率", checkedField: "buffEnabled", valueField: "buffRate" },
  { kind: "input", label: "友情バフ倍率", checkedField: "friendBuffEnabled", valueField: "friendBuffRate", mode: "friend" },
  { kind: "input", label: "守護獣倍率", checkedField: "guardianEnabled", valueField: "guardianRate" },
  { kind: "input", label: "アシストスキル倍率", checkedField: "assistSkillEnabled", valueField: "assistSkillRate" },
];

const CHARACTER_GROUPS = [
  {
    id: "ability-state",
    title: "アビリティ・状態倍率",
    fields: ABILITY_STATE_FIELDS,
  },
  {
    id: "support",
    title: "サポート倍率",
    fields: SUPPORT_FIELDS,
  },
] as const;

const ABILITY_STATE_GROUP = CHARACTER_GROUPS[0];
const SUPPORT_GROUP = CHARACTER_GROUPS[1];

const CREST_FIELDS: FieldConfig[] = [
  { kind: "toggle", label: "対属性 (x1.25)", checkedField: "crestVsAttribute" },
  { kind: "toggle", label: "対弱 (x1.10)", checkedField: "crestVsWeak" },
  { kind: "toggle", label: "対将/対兵 (x1.10)", checkedField: "crestVsBoss" },
  { kind: "toggle", label: "守護獣加勢 (x1.08)", checkedField: "crestGuardianAssist" },
];

const ENEMY_FIELDS: FieldConfig[] = [
  { kind: "input", label: "弱点倍率", checkedField: "weakEnabled", valueField: "weakRate" },
  { kind: "input", label: "弱点判定倍率", checkedField: "weakPointEnabled", valueField: "weakPointRate" },
  { kind: "input", label: "本体倍率", checkedField: "bodyEnabled", valueField: "bodyRate" },
  { kind: "input", label: "直殴り倍率", checkedField: "directEnemyRateEnabled", valueField: "directEnemyRate", mode: "direct" },
  { kind: "input", label: "友情倍率", checkedField: "friendEnemyRateEnabled", valueField: "friendEnemyRate", mode: "friend" },
  { kind: "input", label: "防御ダウン倍率", checkedField: "defDownEnabled", valueField: "defDownRate" },
  { kind: "select", label: "怒り倍率", checkedField: "angryEnabled", valueField: "angryRate", options: ANGRY_OPTIONS },
  { kind: "input", label: "地雷倍率", checkedField: "mineEnabled", valueField: "mineRate", mode: "direct" },
  { kind: "input", label: "特殊倍率", checkedField: "specialEnabled", valueField: "specialRate" },
];

function cn(...classes: Array<string | undefined | false | null>) {
  return classes.filter(Boolean).join(" ");
}

function parseNumber(value: string, fallback = 0): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatAttackBonusInput(value: number): string {
  return `${value}`;
}

function SelectControl(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, ...rest } = props;
  return <select {...rest} className={cn(styles.selectControl, className)} />;
}

export default function DamageCalcTool() {
  const [attacks, setAttacks] = React.useState<AttackCollection>(createAttackCollection);
  const activeAttack = attacks.entries.find((attack) => attack.id === attacks.activeId)!;
  const activeAttackIndex = attacks.entries.indexOf(activeAttack);
  const state = activeAttack.state;
  const selectedCharacter = activeAttack.character;
  const setState = React.useCallback((update: React.SetStateAction<DamageCalcState>) => {
    setAttacks((previous) => {
      const active = previous.entries.find((attack) => attack.id === previous.activeId)!;
      const nextState = typeof update === "function" ? update(active.state) : update;
      return {
        ...previous,
        entries: previous.entries.map((attack) => ({
          ...attack,
          state: attack.id === previous.activeId ? nextState : {
            ...attack.state,
            enemyHp: nextState.enemyHp,
            bossHpEnabled: nextState.bossHpEnabled,
            bossHps: nextState.bossHps,
            reduceAbEnabled: nextState.reduceAbEnabled,
            reduceAbGrade: nextState.reduceAbGrade,
            reduceTenPercent: nextState.reduceTenPercent,
          },
        })),
      };
    });
  }, []);
  const setSelectedCharacter = React.useCallback((character: DamageCalcCharacter | null) => {
    setAttacks((previous) => ({
      ...previous,
      entries: previous.entries.map((attack) => attack.id === previous.activeId ? { ...attack, character } : attack),
    }));
  }, []);
  const addAttack = () => {
    setAttacks((previous) => {
      const lastAttack = previous.entries[previous.entries.length - 1];
      return {
        entries: [...previous.entries, {
          id: previous.nextId,
          state: { ...lastAttack.state, bossHps: [...lastAttack.state.bossHps], selectedFruits: { ...lastAttack.state.selectedFruits } },
          character: lastAttack.character,
        }],
        activeId: previous.nextId,
        nextId: previous.nextId + 1,
      };
    });
    setShowFruitDetails(false);
  };
  const removeAttack = () => {
    setAttacks((previous) => {
      const index = previous.entries.findIndex((attack) => attack.id === previous.activeId);
      if (index <= 0) return previous;
      return {
        ...previous,
        entries: previous.entries.filter((attack) => attack.id !== previous.activeId),
        activeId: previous.entries[index - 1].id,
      };
    });
    setShowFruitDetails(false);
  };
  const [activeTab, setActiveTab] = React.useState<ToolTab>("calc");
  const [theme, setTheme] = React.useState<ThemeMode>("light");
  const [showNavMenu, setShowNavMenu] = React.useState(false);
  const [showFruitDetails, setShowFruitDetails] = React.useState(false);
  const [showBreakdown, setShowBreakdown] = React.useState(false);
  const [breakdownAttackId, setBreakdownAttackId] = React.useState(attacks.activeId);
  const [showCharacterPicker, setShowCharacterPicker] = React.useState(false);
  const resultDialogRef = React.useRef<HTMLDialogElement | null>(null);
  const fruitDialogRef = React.useRef<HTMLDialogElement | null>(null);
  const fruitTriggerRef = React.useRef<HTMLButtonElement | null>(null);
  const navMenuRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const savedTheme = window.localStorage.getItem("damage-calc-theme");
    if (savedTheme === "dark" || savedTheme === "light") setTheme(savedTheme);
  }, []);

  React.useEffect(() => {
    window.localStorage.setItem("damage-calc-theme", theme);
  }, [theme]);

  React.useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!navMenuRef.current) return;
      if (navMenuRef.current.contains(event.target as Node)) return;
      setShowNavMenu(false);
    }

    if (!showNavMenu) return;
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [showNavMenu]);

  React.useEffect(() => {
    const dialog = resultDialogRef.current;
    if (!showBreakdown || activeTab !== "calc" || !dialog) return;

    dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [showBreakdown, activeTab]);

  React.useEffect(() => {
    const dialog = fruitDialogRef.current;
    if (!showFruitDetails || activeTab !== "calc" || state.attackMode !== "direct" || !dialog) return;

    const previousFocus = fruitTriggerRef.current ?? document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [showFruitDetails, activeTab, state.attackMode]);

  const attackResults = React.useMemo(() => attacks.entries.map((attack) => ({
    id: attack.id,
    result: computeDamage(attack.state),
  })), [attacks.entries]);
  const result = attackResults[activeAttackIndex].result;
  const totalDamage = attackResults.reduce((sum, attack) => sum + attack.result.finalDamage, 0);
  const breakdownAttackIndex = Math.max(0, attackResults.findIndex((attack) => attack.id === breakdownAttackId));
  const breakdownAttack = attackResults[breakdownAttackIndex];
  const oneShot = React.useMemo(() => judgeOneShot(totalDamage, state), [totalDamage, state]);
  const hasDirectAttack = attacks.entries.some((attack) => attack.state.attackMode === "direct");
  const requiredAttackBonus = React.useMemo(
    () => calculateRequiredAttackBonus(attacks.entries.map((attack) => attack.state), oneShot.realHp),
    [attacks.entries, oneShot.realHp]
  );
  const stageOptions = React.useMemo(() => getStageMagnitudeOptions(state.stageType), [state.stageType]);

  const updateStringField = React.useCallback((field: StringField, value: string) => {
    setState((prev) => ({ ...prev, [field]: value }));
  }, [setState]);

  const updateBooleanField = React.useCallback((field: BooleanField, value: boolean) => {
    setState((prev) => ({ ...prev, [field]: value }));
  }, [setState]);

  const selectCharacter = React.useCallback((character: DamageCalcCharacter) => {
    setSelectedCharacter(character);
    updateStringField("baseAttack", String(character.attack));
    setShowCharacterPicker(false);
  }, [setSelectedCharacter, updateStringField]);

  const updateAttackMode = React.useCallback((mode: AttackMode) => {
    setState((prev) => ({ ...prev, attackMode: mode }));
  }, [setState]);

  const updateStageType = React.useCallback((value: StageType) => {
    setState((prev) => ({
      ...prev,
      stageType: value,
      stageMagnitude: value === "none" ? prev.stageMagnitude : resolveStageMagnitude(value, prev.stageMagnitude),
    }));
  }, [setState]);

  const toggleFruit = React.useCallback((groupId: FruitGroupId, amount: number) => {
    setState((prev) => {
      const currentAmount = prev.selectedFruits[groupId];
      const nextAmount = currentAmount === amount ? null : amount;
      const delta = (nextAmount ?? 0) - (currentAmount ?? 0);
      return {
        ...prev,
        attackBonus: formatAttackBonusInput(parseNumber(prev.attackBonus, 0) + delta),
        selectedFruits: {
          ...prev.selectedFruits,
          [groupId]: nextAmount,
        } as FruitSelection,
      };
    });
  }, [setState]);

  const toggleSpotBonus = React.useCallback((spot: Exclude<SpotBonus, "none">) => {
    setState((prev) => {
      const nextSpot = prev.spotBonus === spot ? "none" : spot;
      const amounts: Record<SpotBonus, number> = { none: 0, main: 2000, mainOrSubPlus: 1500, sub: 500 };
      const currentAmount = amounts[prev.spotBonus];
      const nextAmount = amounts[nextSpot];
      return {
        ...prev,
        spotBonus: nextSpot,
        attackBonus: formatAttackBonusInput(parseNumber(prev.attackBonus, 0) - currentAmount + nextAmount),
      };
    });
  }, [setState]);

  const handleReset = React.useCallback(() => {
    if (!window.confirm("入力内容をすべてリセットしますか？")) return;
    setAttacks(createAttackCollection());
    setActiveTab("calc");
    setShowNavMenu(false);
    setShowFruitDetails(false);
    setShowBreakdown(false);
    setShowCharacterPicker(false);
  }, []);

  const renderField = React.useCallback(
    (field: FieldConfig, key: string) => {
      if (field.mode && field.mode !== state.attackMode) return null;

      if (field.kind === "toggle") {
        return (
          <FieldRow
            key={key}
            label={field.label}
            checked={state[field.checkedField] as boolean}
            onCheckedChange={(checked) => updateBooleanField(field.checkedField, checked)}
          />
        );
      }

      if (field.kind === "input") {
        return (
          <FieldRow
            key={key}
            label={field.label}
            checked={state[field.checkedField] as boolean}
            onCheckedChange={(checked) => updateBooleanField(field.checkedField, checked)}
          >
            <Input
              value={state[field.valueField] as string}
              disabled={!state[field.checkedField]}
              placeholder={field.placeholder}
              onChange={(event) => updateStringField(field.valueField, event.target.value)}
            />
          </FieldRow>
        );
      }

      if (field.kind === "select") {
        return (
          <FieldRow
            key={key}
            label={field.label}
            checked={state[field.checkedField] as boolean}
            onCheckedChange={(checked) => updateBooleanField(field.checkedField, checked)}
          >
            <SelectControl
              value={state[field.valueField] as string}
              disabled={!state[field.checkedField]}
              onChange={(event) => updateStringField(field.valueField, event.target.value)}
            >
              {field.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectControl>
          </FieldRow>
        );
      }

      return (
        <FieldRow
          key={key}
          label={field.label}
          checked={state[field.checkedField] as boolean}
          onCheckedChange={(checked) => updateBooleanField(field.checkedField, checked)}
        >
          <div className={styles.doubleControl}>
            <SelectControl
              value={state[field.primaryField] as string}
              disabled={!state[field.checkedField]}
              onChange={(event) => updateStringField(field.primaryField, event.target.value)}
            >
              {field.primaryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectControl>
            <SelectControl
              value={state[field.secondaryField] as string}
              disabled={!state[field.checkedField]}
              onChange={(event) => updateStringField(field.secondaryField, event.target.value)}
            >
              {field.secondaryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectControl>
          </div>
        </FieldRow>
      );
    },
    [state, updateBooleanField, updateStringField]
  );

  return (
    <div className={cn(styles.pageSurface, activeTab === "calc" && styles.pageSurfaceWithFooter)} data-theme={theme}>
      <section className={styles.toolShell} data-theme={theme}>
      <div className={styles.hero}>
        <div className={styles.heroTop}>
          <div className={styles.heroLeft}>
            <Link href="/" className={styles.homeLink} aria-label="Home">
              <img className={styles.headerLogo} src="/icon/icon_Header_2.png" alt="Strike-Optima" />
            </Link>
            <div className={styles.headerTitleWrap} ref={navMenuRef}>
              <button
                type="button"
                className={styles.headerMenuButton}
                onClick={() => setShowNavMenu((prev) => !prev)}
                aria-label="メニューを開く"
                aria-expanded={showNavMenu}
                title="メニュー"
              >
                <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" fill="currentColor" aria-hidden="true">
                  <path d="M0 0h24v24H0V0z" fill="none" />
                  <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
                </svg>
              </button>
              <div className={styles.heroActions}>
                <button
                  type="button"
                  className={styles.headerIconButton}
                  onClick={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))}
                  aria-label={theme === "light" ? "ダーク表示" : "ライト表示"}
                  title={theme === "light" ? "ダーク表示" : "ライト表示"}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" fill="currentColor" aria-hidden="true">
                    <path d="M0 0h24v24H0V0z" fill="none" />
                    <path d="M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.79 1.42-1.41zM4 10.5H1v2h3v-2zm9-9.95h-2V3.5h2V.55zm7.45 3.91l-1.41-1.41-1.79 1.79 1.41 1.41 1.79-1.79zm-3.21 13.7l1.79 1.8 1.41-1.41-1.8-1.79-1.4 1.4zM20 10.5v2h3v-2h-3zm-8-5c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm-1 16.95h2V19.5h-2v2.95zm-7.45-3.91l1.41 1.41 1.79-1.8-1.41-1.41-1.79 1.8z" />
                  </svg>
                </button>
                <button
                  type="button"
                  className={styles.resetButton}
                  onClick={handleReset}
                  aria-label="入力をリセット"
                  title="入力をリセット"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" fill="#ffffff" aria-hidden="true">
                    <path d="M0 0h24v24H0V0z" fill="none" />
                    <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
                  </svg>
                </button>
              </div>
              {showNavMenu && (
                <div className={styles.headerMenuPanel}>
                  <button
                    type="button"
                    className={cn(styles.headerMenuItem, activeTab === "calc" && styles.headerMenuItemActive)}
                    onClick={() => {
                      setActiveTab("calc");
                      setShowNavMenu(false);
                    }}
                  >
                    計算ツール
                  </button>
                  <button
                    type="button"
                    className={cn(styles.headerMenuItem, activeTab === "manual" && styles.headerMenuItemActive)}
                    onClick={() => {
                      setActiveTab("manual");
                      setShowNavMenu(false);
                    }}
                  >
                    説明書
                  </button>
                  <button
                    type="button"
                    className={cn(styles.headerMenuItem, activeTab === "contact" && styles.headerMenuItemActive)}
                    onClick={() => {
                      setActiveTab("contact");
                      setShowNavMenu(false);
                    }}
                  >
                    お問い合わせ
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className={styles.primaryTabBar}>
          {[
            { id: "calc", label: "計算モード" },
            { id: "verify", label: "ワンパン判定" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={cn(styles.primaryTabButton, activeTab === tab.id && styles.primaryTabButtonActive)}
              onClick={() => setActiveTab(tab.id as ToolTab)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>



      {activeTab === "manual" && (
        <div className={cn(styles.contentGrid, styles.contentGridWide)}>
          <article className={cn(styles.card, styles.richPanel)}>
            <div className={styles.cardTitleRow}>
              <h2 className={styles.cardTitle}>説明書</h2>
            </div>
            <p>
              <strong>「ダメージ計算機MS」</strong>
              はモンスト用ダメージ計算ツールです。アビリティや紋章・属性効果など、キャラにかかる倍率を選択・入力することで敵に与えるダメージをシンプルに求めやすくします。
              また、ワンパン判定機能を搭載し、計算結果のダメージで仮想敵を倒せるか簡単にチェックできます。
            </p>
            <section>
              <h3 className={styles.cardTitle}>計算モード</h3>
              <p>キャラクターが敵に与えるダメージを計算します。計算結果は右側のサマリーで確認できます。</p>
              <ol>
                {MANUAL_STEPS_CALC.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <p className={styles.manualNote}>※ 本体倍率や直殴り倍率等は「(クエスト名) 敵データ」などで検索すると情報を得やすいです。</p>
            </section>
            <section>
              <h3 className={styles.cardTitle}>直殴りと友情コンボの切替</h3>
              <p>画面上部の切替ボタンにより変更できます。選択に応じて一部の倍率項目が切り替わります。</p>
            </section>
            <section>
              <h3 className={styles.cardTitle}>ワンパン判定</h3>
              <ol>
                {MANUAL_STEPS_VERIFY.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </section>
          </article>

          <aside className={cn(styles.card, styles.richPanel)}>
            <div className={styles.cardTitleRow}>
              <h2 className={styles.cardTitle}>現在の計算結果</h2>
            </div>
            <div className={styles.summaryValue}>{totalDamage.toLocaleString("ja-JP")}</div>
            <div className={styles.summaryMeta}>
              <div className={styles.metaRow}>
                <span>{state.attackMode === "direct" ? "攻撃力" : "友情威力"}</span>
                <strong>{result.actualAttack.toLocaleString("ja-JP")}</strong>
              </div>
              <div className={styles.metaRow}>
                <span>属性倍率</span>
                <strong>x{result.stageRealRate}</strong>
              </div>
            </div>
          </aside>
        </div>
      )}

      {activeTab === "contact" && (
        <div className={cn(styles.contentGrid, styles.contentGridWide)}>
          <article className={cn(styles.card, styles.richPanel, styles.contactCard)}>
            <div className={styles.cardTitleRow}>
              <h2 className={styles.cardTitle}>お問い合わせ</h2>
            </div>
            <p>不具合・バグの報告、追加機能実装の要望等はこちらにご連絡ください。</p>
            <a href={CONTACT_URL} target="_blank" rel="noreferrer" className={styles.contactButton}>
              <Button type="button" variant="primary">
                お問い合わせフォームへ
              </Button>
            </a>
            <p className={styles.linkMuted}>マシュマロが新しいタブで開きます。</p>
          </article>
        </div>
      )}

      {(activeTab === "calc" || activeTab === "verify") && (
        <div className={styles.attackWorkspace}>
          {activeTab === "calc" && (
            <div className={styles.attackToolbar}>
              <div className={styles.attackNumbers} role="group" aria-label="攻撃を選択">
                {attacks.entries.map((attack, index) => (
                  <button
                    key={attack.id}
                    type="button"
                    className={cn(styles.attackNumber, attack.id === attacks.activeId && styles.attackNumberActive)}
                    aria-label={`攻撃${index + 1}`}
                    aria-pressed={attack.id === attacks.activeId}
                    onClick={() => {
                      setAttacks((previous) => ({ ...previous, activeId: attack.id }));
                      setShowFruitDetails(false);
                    }}
                  >{index + 1}</button>
                ))}
              </div>
              <button type="button" className={styles.addAttackButton} onClick={addAttack}>+ 追加</button>
              {activeAttackIndex > 0 && (
                <button
                  type="button"
                  className={styles.removeAttackButton}
                  onClick={removeAttack}
                  aria-label={`攻撃${activeAttackIndex + 1}を削除`}
                  title={`攻撃${activeAttackIndex + 1}を削除`}
                >×</button>
              )}
            </div>
          )}
          <div className={cn(styles.contentGrid, styles.contentGridWide)}>
            {activeTab === "calc" ? (
              <div className={styles.calcColumns}>
                <div className={styles.calcColumn}>
                  <section className={cn(styles.card, styles.mainInputCard)}>
                    <div className={styles.cardTitleRow}>
                      <div>
                        <h2 className={styles.cardTitle}>基本入力</h2>
                      </div>
                    </div>

                    <div className={styles.modeSwitch}>
                      <button type="button" className={cn(styles.modeButton, state.attackMode === "direct" && styles.modeButtonActive)} onClick={() => updateAttackMode("direct")}>
                        直殴り
                      </button>
                      <button type="button" className={cn(styles.modeButton, state.attackMode === "friend" && styles.modeButtonActive)} onClick={() => updateAttackMode("friend")}>
                        友情コンボ
                      </button>
                    </div>

                    <div className={styles.mainInputGrid}>
                      <div className={cn(styles.inputGroup, styles.mainInputGroup)}>
                        <span className={styles.inputLabel}>{state.attackMode === "direct" ? "攻撃力" : "友情威力"}</span>
                        <Input
                          className={styles.mainInputControl}
                          value={state.baseAttack}
                          onChange={(event) => {
                            updateStringField("baseAttack", event.target.value);
                            setSelectedCharacter(null);
                          }}
                        />
                        {state.attackMode === "direct" ? (
                          <>
                            <button
                              type="button"
                              className={cn(styles.toggleButton, styles.mainInputControl, styles.characterSelectButton)}
                              onClick={() => {
                                setShowCharacterPicker(true);
                              }}
                            >
                              キャラを選択
                            </button>
                            {selectedCharacter ? <span className={styles.selectedCharacterName}>{selectedCharacter.name}</span> : null}
                          </>
                        ) : null}
                      </div>

                      {state.attackMode === "direct" ? (
                        <label className={cn(styles.inputGroup, styles.mainInputGroup)}>
                          <span className={styles.inputLabel}>加撃量</span>
                          <Input className={styles.mainInputControl} value={state.attackBonus} onChange={(event) => updateStringField("attackBonus", event.target.value)} />
                          <button ref={fruitTriggerRef} type="button" className={cn(styles.toggleButton, styles.mainInputControl)} onClick={() => setShowFruitDetails(true)} aria-haspopup="dialog" aria-controls="fruit-picker-dialog" aria-expanded={showFruitDetails}>
                            ▼ 詳細選択
                          </button>
                        </label>
                      ) : (
                        <label className={cn(styles.inputGroup, styles.mainInputGroup)}>
                          <span className={styles.inputLabel}>熱き友撃</span>
                          <SelectControl className={styles.mainInputControl} value={state.friendYuugeki} onChange={(event) => updateStringField("friendYuugeki", event.target.value)}>
                            {FRIEND_YUUGEKI_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </SelectControl>
                        </label>
                      )}
                    </div>

                    {state.attackMode === "direct" && (
                      <div className={styles.toggleBand}>
                        <label className={styles.checkLabel}>
                          <input type="checkbox" checked={state.gauge} onChange={(event) => updateBooleanField("gauge", event.target.checked)} />
                          <span>ゲージ成功 (x1.2)</span>
                        </label>
                      </div>
                    )}

                  </section>

                  <section className={cn(styles.card, styles.multiplierCard)}>
                    <div className={styles.cardTitleRow}>
                      <div>
                        <h2 className={cn(styles.cardTitle, styles.sectionTitle)}>{ABILITY_STATE_GROUP.title}</h2>
                      </div>
                    </div>
                    <div className={styles.gridFields}>{ABILITY_STATE_GROUP.fields.map((field, index) => renderField(field, `${ABILITY_STATE_GROUP.id}-${index}`))}</div>
                  </section>
                </div>

                <div className={styles.calcColumn}>
                  <section className={cn(styles.card, styles.multiplierCard)}>
                    <div className={styles.cardTitleRow}>
                      <div>
                        <h2 className={cn(styles.cardTitle, styles.sectionTitle)}>{SUPPORT_GROUP.title}</h2>
                      </div>
                    </div>
                    {SUPPORT_GROUP.fields.length > 0 ? (
                      <div className={styles.gridFields}>{SUPPORT_GROUP.fields.map((field, index) => renderField(field, `${SUPPORT_GROUP.id}-${index}`))}</div>
                    ) : (
                      <p className={styles.emptySectionNote}>ここに分類したい項目を追加してください。</p>
                    )}
                  </section>

                  <section className={cn(styles.card, styles.multiplierCard)}>
                    <div className={styles.cardTitleRow}>
                      <h2 className={cn(styles.cardTitle, styles.sectionTitle)}>紋章</h2>
                    </div>
                    <div className={styles.gridFields}>{CREST_FIELDS.map((field, index) => renderField(field, `crest-${index}`))}</div>
                  </section>

                  <section className={cn(styles.card, styles.multiplierCard)}>
                    <div className={styles.cardTitleRow}>
                      <div>
                        <h2 className={cn(styles.cardTitle, styles.sectionTitle)}>敵倍率</h2>
                      </div>
                    </div>

                    <div className={styles.inlineMetrics}>
                      <label className={styles.checkLabel}>
                        <input type="checkbox" checked={state.multiMode} onChange={(event) => updateBooleanField("multiMode", event.target.checked)} />
                        <span>複数判定</span>
                      </label>
                      {state.multiMode && (
                        <>
                          <label className={styles.metricPair}>
                            <span>弱点数</span>
                            <Input className={styles.countInput} value={state.weakHitCount} onChange={(event) => updateStringField("weakHitCount", event.target.value)} />
                          </label>
                          <label className={styles.metricPair}>
                            <span>弱点判定数</span>
                            <Input className={styles.countInput} value={state.weakJudgeCount} onChange={(event) => updateStringField("weakJudgeCount", event.target.value)} />
                          </label>
                        </>
                      )}
                    </div>

                    <div className={styles.gridFields}>{ENEMY_FIELDS.map((field, index) => renderField(field, `enemy-${index}`))}</div>
                  </section>

                  <section className={cn(styles.card, styles.multiplierCard)}>
                    <div className={styles.cardTitleRow}>
                      <div>
                        <h2 className={cn(styles.cardTitle, styles.sectionTitle)}>ステージ倍率</h2>
                      </div>
                    </div>

                    <div className={cn(styles.gridFields, styles.stageGridFields)}>
                      <div className={cn(styles.fieldRow, styles.stageFieldRow)}>
                        <label className={styles.inputGroup}>
                          <span className={styles.inputLabel}>属性倍率</span>
                          <SelectControl value={state.stageType} onChange={(event) => updateStageType(event.target.value as StageType)}>
                            <option value="advantage">有利</option>
                            <option value="none">なし (等倍)</option>
                            <option value="disadvantage">不利</option>
                          </SelectControl>
                        </label>
                        {state.stageType !== "none" && (
                          <label className={styles.inputGroup}>
                            <span className={styles.inputLabel}>詳細倍率</span>
                            <SelectControl value={state.stageMagnitude} onChange={(event) => updateStringField("stageMagnitude", event.target.value)}>
                              {stageOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </SelectControl>
                          </label>
                        )}
                        {state.stageType !== "none" && state.stageMagnitude === "custom" && (
                          <label className={styles.inputGroup}>
                            <span className={styles.inputLabel}>個別倍率</span>
                            <Input value={state.customStageRate} onChange={(event) => updateStringField("customStageRate", event.target.value)} />
                          </label>
                        )}
                        {state.stageType === "advantage" && (
                          <div className={styles.inputGroup}>
                            <label className={styles.checkLabel}>
                              <input type="checkbox" checked={state.superBalance} onChange={(event) => updateBooleanField("superBalance", event.target.checked)} />
                              <span>超バランス型</span>
                            </label>
                            <span className={styles.subText}>倍率: x{result.stageRealRate}</span>
                          </div>
                        )}
                      </div>

                      <FieldRow
                        className={styles.stageFieldRow}
                        label="ギミック倍率"
                        checked={state.gimmickEnabled}
                        onCheckedChange={(checked) => updateBooleanField("gimmickEnabled", checked)}
                      >
                        <Input value={state.gimmickRate} disabled={!state.gimmickEnabled} onChange={(event) => updateStringField("gimmickRate", event.target.value)} />
                      </FieldRow>
                    </div>
                  </section>
                </div>
              </div>
            ) : (
              <div className={styles.stack}>
                <section className={cn(styles.card, styles.judgeCard)}>
                  <div className={styles.cardTitleRow}>
                    <div>
                      <h2 className={styles.cardTitle}>ワンパン判定</h2>
                      <p className={styles.cardHint}>現在の計算結果に対して敵 HP を入力して判定します。</p>
                    </div>
                  </div>
                  <div className={styles.judgeHighlight}>
                    <span className={styles.judgeLabel}>現在の計算ダメージ</span>
                    <div className={styles.summaryValue}>{totalDamage.toLocaleString("ja-JP")}</div>
                  </div>
                  <div className={styles.inputGroup}>
                    <div className={styles.enemyHpHeader}>
                      <label htmlFor="enemy-hp" className={styles.inputLabel}>敵のHP</label>
                      <button
                        type="button"
                        className={cn(styles.toggleButton, state.bossHpEnabled && styles.bossHpButtonActive)}
                        onClick={() => updateBooleanField("bossHpEnabled", !state.bossHpEnabled)}
                        aria-pressed={state.bossHpEnabled}
                        aria-expanded={state.bossHpEnabled}
                        aria-controls="boss-hp-inputs"
                      >ボスHP入力</button>
                    </div>
                    <Input
                      id="enemy-hp"
                      inputMode="decimal"
                      value={state.bossHpEnabled ? String(getEnemyHp(state)) : state.enemyHp}
                      readOnly={state.bossHpEnabled}
                      onChange={(event) => updateStringField("enemyHp", event.target.value)}
                    />
                    {state.bossHpEnabled && (
                      <div id="boss-hp-inputs" className={styles.bossHpInputs}>
                        {state.bossHps.map((hp, index) => (
                          <Input
                            key={index}
                            inputMode="decimal"
                            value={hp}
                            placeholder={`ボス${index + 1}`}
                            aria-label={`ボス${index + 1}`}
                            onChange={(event) => setState((previous) => ({
                              ...previous,
                              bossHps: previous.bossHps.map((value, bossIndex) => bossIndex === index ? event.target.value : value) as DamageCalcState["bossHps"],
                            }))}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className={styles.gridFields}>
                    <FieldRow label="将命/兵命削り" checked={state.reduceAbEnabled} onCheckedChange={(checked) => updateBooleanField("reduceAbEnabled", checked)}>
                      <SelectControl value={state.reduceAbGrade} disabled={!state.reduceAbEnabled} onChange={(event) => updateStringField("reduceAbGrade", event.target.value)}>
                        {REDUCE_AB_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </SelectControl>
                    </FieldRow>
                    <FieldRow label="10%削り (-10%)" checked={state.reduceTenPercent} onCheckedChange={(checked) => updateBooleanField("reduceTenPercent", checked)} />
                  </div>
                  <div className={styles.metaRow}>
                    <span>削り後HP</span>
                    <strong>{oneShot.realHp == null ? "-" : oneShot.realHp.toLocaleString("ja-JP")}</strong>
                  </div>
                  <div className={cn(styles.judgeBox, oneShot.success === true && styles.judgeBoxSuccess, oneShot.success === false && styles.judgeBoxFail)}>
                    <div className={styles.judgeMessage}>{oneShot.message}</div>
                  </div>
                </section>
                <section aria-label="必要加撃量">
                  {hasDirectAttack ? (
                    <div className={styles.requiredAttackResult}>
                      <div className={styles.requiredAttackMain}>
                        <span>必要加撃量</span>
                        <strong>{requiredAttackBonus === null ? "-" : requiredAttackBonus.toLocaleString("ja-JP")}</strong>
                      </div>
                      <div className={styles.requiredAttackDetails}>
                        <span>全攻撃の加撃量をこの値に揃えた場合の必要量です。</span>
                      </div>
                    </div>
                  ) : (
                    <p className={styles.requiredAttackMessage}>必要加撃量は直殴りモードで計算できます。</p>
                  )}
                </section>
              </div>
            )}

          </div>
        </div>
      )}
      </section>
      {showFruitDetails && activeTab === "calc" && state.attackMode === "direct" ? (
        <dialog
          ref={fruitDialogRef}
          id="fruit-picker-dialog"
          className={cn(styles.characterModal, styles.fruitModal)}
          aria-labelledby="fruit-picker-title"
          onCancel={() => setShowFruitDetails(false)}
          onClick={(event) => {
            if (event.target !== event.currentTarget) return;
            const rect = event.currentTarget.getBoundingClientRect();
            if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {
              setShowFruitDetails(false);
            }
          }}
        >
          <div className={styles.characterModalHeader}>
            <h2 id="fruit-picker-title" className={styles.characterModalTitle}>加撃量の詳細選択</h2>
            <button type="button" className={styles.characterModalClose} onClick={() => setShowFruitDetails(false)} aria-label="加撃量の詳細選択を閉じる" autoFocus>×</button>
          </div>
          <div className={styles.fruitModalBody}>
            <FruitPicker selectedFruits={state.selectedFruits} onToggle={toggleFruit} spotBonus={state.spotBonus} onToggleSpot={toggleSpotBonus} />
          </div>
        </dialog>
      ) : null}
      {showCharacterPicker ? <CharacterPicker onSelect={selectCharacter} onClose={() => setShowCharacterPicker(false)} /> : null}
      {activeTab === "calc" && (
        <>
          <div className={styles.resultFooter} data-theme={theme}>
            <button
              type="button"
              className={styles.resultFooterSummary}
              onClick={() => {
                setBreakdownAttackId(attacks.activeId);
                setShowBreakdown(true);
              }}
              aria-haspopup="dialog"
              aria-expanded={showBreakdown}
              aria-controls="damage-calc-breakdown"
            >
              <div className={styles.resultFooterHeader}>
                <span className={styles.resultFooterLabel}>最終ダメージ</span>
                <svg className={styles.resultFooterChevron} width="12" height="6" viewBox="0 0 24 12" fill="none" aria-hidden="true">
                  <path d="M2 10L12 2L22 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span className={styles.resultFooterValue}>{totalDamage.toLocaleString("ja-JP")}</span>
            </button>
          </div>
          <dialog
            ref={resultDialogRef}
            id="damage-calc-breakdown"
            className={styles.resultModal}
            aria-labelledby="damage-calc-result-title"
            onCancel={() => setShowBreakdown(false)}
          >
            <div className={styles.resultModalHeader}>
              <h2 id="damage-calc-result-title" className={styles.cardTitle}>計算結果</h2>
              <button
                type="button"
                className={styles.characterModalClose}
                onClick={() => setShowBreakdown(false)}
                aria-label="計算結果を閉じる"
                autoFocus
              >×</button>
            </div>
            <div className={styles.resultModalContent}>
              <div className={styles.resultModalSummary}>
                <div className={styles.resultFooterLabel}>最終ダメージ</div>
                <div className={styles.summaryValue}>{totalDamage.toLocaleString("ja-JP")}</div>
                <div className={styles.resultAttackSwitch} role="group" aria-label="表示する攻撃の内訳">
                  {attackResults.map((attack, index) => (
                    <button
                      key={attack.id}
                      type="button"
                      className={cn(styles.attackNumber, breakdownAttack.id === attack.id && styles.attackNumberActive)}
                      aria-label={`攻撃${index + 1}の内訳を表示`}
                      aria-pressed={breakdownAttack.id === attack.id}
                      aria-controls="selected-attack-breakdown"
                      onClick={() => setBreakdownAttackId(attack.id)}
                    >
                      {index + 1}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.resultDetails}>
                <h3 className={styles.detailHeader}>倍率内訳</h3>
                <section id="selected-attack-breakdown" key={breakdownAttack.id} className={styles.attackBreakdown} aria-label={`攻撃${breakdownAttackIndex + 1}の内訳`} aria-live="polite">
                  <h4 className={styles.attackBreakdownTitle}>
                    <span>攻撃{breakdownAttackIndex + 1}</span>
                    <span>{breakdownAttack.result.finalDamage.toLocaleString("ja-JP")}</span>
                  </h4>
                  <ul className={styles.breakdownList}>
                    {breakdownAttack.result.breakdown.map((item, itemIndex) => (
                      <li key={itemIndex} className={cn(styles.breakdownItem, !item.val && styles.breakdownSeparator)}>
                        <span>{item.name}</span>
                        {item.val ? <span className={styles.breakdownValue}>{item.val}</span> : null}
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            </div>
          </dialog>
        </>
      )}
    </div>
  );
}
