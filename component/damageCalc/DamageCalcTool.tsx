"use client";

import * as React from "react";
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
  getStageMagnitudeOptions,
  resolveStageMagnitude,
  type SelectOption,
} from "@/lib/damageCalc/constants";
import { computeDamage, judgeOneShot } from "@/lib/damageCalc/calculator";
import { createDefaultDamageCalcState } from "@/lib/damageCalc/defaultState";
import type { AttackMode, DamageCalcState, FruitGroupId, FruitSelection, StageType, ThemeMode, ToolTab } from "@/lib/damageCalc/types";
import FieldRow from "./FieldRow";
import FruitPicker from "./FruitPicker";
import styles from "./DamageCalcTool.module.css";

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
  { kind: "input", label: "弱点キラー倍率", checkedField: "weakKillerEnabled", valueField: "weakKillerRate" },
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
    description: "キャラ自身のアビリティや状態変化による倍率を配置します。",
    fields: ABILITY_STATE_FIELDS,
  },
  {
    id: "support",
    title: "サポート倍率",
    description: "バフ・フィールド・補助効果などの倍率を配置します。",
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
  const [state, setState] = React.useState<DamageCalcState>(() => createDefaultDamageCalcState());
  const [activeTab, setActiveTab] = React.useState<ToolTab>("calc");
  const [theme, setTheme] = React.useState<ThemeMode>("light");
  const [showNavMenu, setShowNavMenu] = React.useState(false);
  const [showFruitDetails, setShowFruitDetails] = React.useState(false);
  const [showBreakdown, setShowBreakdown] = React.useState(false);
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

  const result = React.useMemo(() => computeDamage(state), [state]);
  const oneShot = React.useMemo(() => judgeOneShot(result.finalDamage, state), [result.finalDamage, state]);
  const stageOptions = React.useMemo(() => getStageMagnitudeOptions(state.stageType), [state.stageType]);

  const updateStringField = React.useCallback((field: StringField, value: string) => {
    setState((prev) => ({ ...prev, [field]: value }));
  }, []);

  const updateBooleanField = React.useCallback((field: BooleanField, value: boolean) => {
    setState((prev) => ({ ...prev, [field]: value }));
  }, []);

  const updateAttackMode = React.useCallback((mode: AttackMode) => {
    setState((prev) => ({ ...prev, attackMode: mode }));
  }, []);

  const updateStageType = React.useCallback((value: StageType) => {
    setState((prev) => ({
      ...prev,
      stageType: value,
      stageMagnitude: value === "none" ? prev.stageMagnitude : resolveStageMagnitude(value, prev.stageMagnitude),
    }));
  }, []);

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
  }, []);

  const toggleSpotBonus = React.useCallback((spot: "main" | "sub") => {
    setState((prev) => {
      const nextSpot = prev.spotBonus === spot ? "none" : spot;
      const currentAmount = prev.spotBonus === "main" ? 2000 : prev.spotBonus === "sub" ? 1500 : 0;
      const nextAmount = nextSpot === "main" ? 2000 : nextSpot === "sub" ? 1500 : 0;
      return {
        ...prev,
        spotBonus: nextSpot,
        attackBonus: formatAttackBonusInput(parseNumber(prev.attackBonus, 0) - currentAmount + nextAmount),
      };
    });
  }, []);

  const handleReset = React.useCallback(() => {
    if (!window.confirm("入力内容をすべてリセットしますか？")) return;
    setState(createDefaultDamageCalcState());
    setActiveTab("calc");
    setShowNavMenu(false);
    setShowFruitDetails(false);
    setShowBreakdown(false);
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
            <h1 className={styles.heroTitle}>ダメージ計算機MS</h1>
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
            <div className={styles.summaryValue}>{result.finalDamage.toLocaleString("ja-JP")}</div>
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
        <div className={cn(styles.contentGrid, styles.contentGridWide)}>
          {activeTab === "calc" ? (
            <div className={styles.calcColumns}>
              <div className={styles.calcColumn}>
                <section className={cn(styles.card, styles.mainInputCard)}>
                  <div className={styles.cardTitleRow}>
                    <div>
                      <h2 className={styles.cardTitle}>基本入力</h2>
                      <p className={styles.cardHint}>攻撃力と基礎条件を設定します。</p>
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
                    <label className={cn(styles.inputGroup, styles.mainInputGroup)}>
                      <span className={styles.inputLabel}>{state.attackMode === "direct" ? "攻撃力" : "友情威力"}</span>
                      <Input className={styles.mainInputControl} value={state.baseAttack} onChange={(event) => updateStringField("baseAttack", event.target.value)} />
                    </label>

                    {state.attackMode === "direct" ? (
                      <label className={cn(styles.inputGroup, styles.mainInputGroup)}>
                        <span className={styles.inputLabel}>加撃量</span>
                        <Input className={styles.mainInputControl} value={state.attackBonus} onChange={(event) => updateStringField("attackBonus", event.target.value)} />
                        <button type="button" className={cn(styles.toggleButton, styles.mainInputControl)} onClick={() => setShowFruitDetails((prev) => !prev)}>
                          {showFruitDetails ? "▲ 詳細選択を閉じる" : "▼ 詳細選択"}
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

                  {state.attackMode === "direct" && showFruitDetails && (
                    <>
                      <FruitPicker selectedFruits={state.selectedFruits} onToggle={toggleFruit} spotBonus={state.spotBonus} onToggleSpot={toggleSpotBonus} />
                    </>
                  )}
                </section>

                <section className={styles.card}>
                  <div className={styles.cardTitleRow}>
                    <div>
                      <h2 className={cn(styles.cardTitle, styles.sectionTitle)}>{ABILITY_STATE_GROUP.title}</h2>
                      <p className={styles.cardHint}>{ABILITY_STATE_GROUP.description}</p>
                    </div>
                  </div>
                  <div className={styles.gridFields}>{ABILITY_STATE_GROUP.fields.map((field, index) => renderField(field, `${ABILITY_STATE_GROUP.id}-${index}`))}</div>
                </section>
              </div>

              <div className={styles.calcColumn}>
                <section className={styles.card}>
                  <div className={styles.cardTitleRow}>
                    <div>
                      <h2 className={cn(styles.cardTitle, styles.sectionTitle)}>{SUPPORT_GROUP.title}</h2>
                      <p className={styles.cardHint}>{SUPPORT_GROUP.description}</p>
                    </div>
                  </div>
                  {SUPPORT_GROUP.fields.length > 0 ? (
                    <div className={styles.gridFields}>{SUPPORT_GROUP.fields.map((field, index) => renderField(field, `${SUPPORT_GROUP.id}-${index}`))}</div>
                  ) : (
                    <p className={styles.emptySectionNote}>ここに分類したい項目を追加してください。</p>
                  )}
                </section>

                <section className={styles.card}>
                  <div className={styles.cardTitleRow}>
                    <h2 className={cn(styles.cardTitle, styles.sectionTitle)}>紋章</h2>
                  </div>
                  <div className={styles.gridFields}>{CREST_FIELDS.map((field, index) => renderField(field, `crest-${index}`))}</div>
                </section>

                <section className={styles.card}>
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

                <section className={styles.card}>
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
                  <div className={styles.summaryValue}>{result.finalDamage.toLocaleString("ja-JP")}</div>
                </div>
                <label className={styles.inputGroup}>
                  <span className={styles.inputLabel}>敵のHP (最大値)</span>
                  <Input value={state.enemyHp} onChange={(event) => updateStringField("enemyHp", event.target.value)} />
                </label>
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
            </div>
          )}

          <aside className={cn(styles.card, styles.summaryCard)} hidden>
            <div className={styles.cardTitleRow}>
              <div>
                <h2 className={styles.cardTitle}>最終ダメージ</h2>
                <p className={styles.cardHint}>レガシー版と同じ順序で倍率を乗算しています。</p>
              </div>
            </div>
            <div className={styles.summaryValue}>{result.finalDamage.toLocaleString("ja-JP")}</div>
            <div className={styles.summaryMeta}>
              <div className={styles.metaRow}>
                <span>{state.attackMode === "direct" ? "攻撃力" : "友情威力"}</span>
                <strong>{result.actualAttack.toLocaleString("ja-JP")}</strong>
              </div>
              <div className={styles.metaRow}>
                <span>属性倍率</span>
                <strong>x{result.stageRealRate}</strong>
              </div>
              <div className={styles.metaRow}>
                <span>表示テーマ</span>
                <strong>{theme === "light" ? "ライト" : "ダーク"}</strong>
              </div>
            </div>
            <Button type="button" variant="ghost" className={styles.breakdownToggle} onClick={() => setShowBreakdown((prev) => !prev)}>
              {showBreakdown ? "倍率内訳を閉じる" : "倍率内訳を開く"}
            </Button>
            {showBreakdown && (
              <ul className={styles.breakdownList}>
                {result.breakdown.map((item) => (
                  <li key={`${item.name}-${item.val}`} className={cn(styles.breakdownItem, !item.val && styles.breakdownSeparator)}>
                    <span>{item.name}</span>
                    {item.val ? <span className={styles.breakdownValue}>{item.val}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      )}
      </section>
      {activeTab === "calc" && (
        <div className={cn(styles.resultFooter, showBreakdown && styles.resultFooterOpen)} data-theme={theme}>
          <button
            type="button"
            className={styles.resultFooterSummary}
            onClick={() => setShowBreakdown((prev) => !prev)}
            aria-expanded={showBreakdown}
            aria-controls="damage-calc-breakdown"
          >
            <div className={styles.resultFooterHeader}>
              <span className={styles.resultFooterLabel}>最終ダメージ</span>
              <span className={styles.resultFooterHint}>{showBreakdown ? "(▲ 詳細)" : "(▼ 詳細)"}</span>
            </div>
            <span className={styles.resultFooterValue}>{result.finalDamage.toLocaleString("ja-JP")}</span>
          </button>
          {showBreakdown && (
            <div id="damage-calc-breakdown" className={styles.resultDetails}>
              <div className={styles.detailHeader}>倍率内訳</div>
              <ul className={styles.breakdownList}>
                {result.breakdown.map((item) => (
                  <li key={`${item.name}-${item.val}`} className={cn(styles.breakdownItem, !item.val && styles.breakdownSeparator)}>
                    <span>{item.name}</span>
                    {item.val ? <span className={styles.breakdownValue}>{item.val}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
