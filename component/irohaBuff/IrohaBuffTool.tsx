"use client";

import Link from "next/link";
import { useState } from "react";
import {
  CHARACTERS, FRUITS, SPOTS, calculateBuff, createInitialState, selectSpot, toggleFruit,
  type Character, type Grade, type Stat,
} from "@/lib/irohaBuff/calculator";
import styles from "./IrohaBuffTool.module.css";
import pickerStyles from "@/component/damageCalc/DamageCalcTool.module.css";
import CharacterPicker from "@/component/damageCalc/CharacterPicker";
import type { DamageCalcCharacter } from "@/lib/damageCalc/characterTypes";

const STAT_LABELS = {
  atk: { base: "攻撃力", bonus: "加撃量", field: "atkBonus" },
  spd: { base: "スピード", bonus: "加速量", field: "spdBonus" },
} as const;

export default function IrohaBuffTool() {
  const [state, setState] = useState(createInitialState);
  const [submitted, setSubmitted] = useState(false);
  const [showCharacterPicker, setShowCharacterPicker] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<DamageCalcCharacter | null>(null);
  const ready = state.atk !== "" && state.spd !== "";
  const result = ready || submitted ? calculateBuff(state, state.character) : null;

  return (
    <div className={styles.surface}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <Link href="/" aria-label="ホームへ戻る" className={styles.logoLink}>
            <img src="/icon/icon_Header_2.png" alt="Strike-Optima" width="162" height="54" />
          </Link>
          <h1>あのSS</h1>
        </header>
        <p className={styles.intro}>
          <strong className={styles.introQuote}>「攻撃力とスピードの差が最も大きい味方の攻撃力とスピードの値の比率に応じて、ふれた味方のパワーを一定期間アップ」</strong>
          <br />
          するSSのバフ倍率計算ツール
        </p>

        <form className={styles.card} onSubmit={(event) => { event.preventDefault(); setSubmitted(true); }} noValidate>
          <div className={styles.cardHeader}>
            <h2>味方のステータス</h2>
          </div>
          <div className={styles.characterRow}>
            <label className={styles.field}>
              <span>SS使用キャラクター</span>
              <select value={state.character} onChange={(event) => setState({ ...state, character: event.target.value as Character })}>
                {Object.entries(CHARACTERS).map(([id, character]) => <option key={id} value={id}>{character.name}</option>)}
              </select>
            </label>
            <div className={styles.field}>
              <span>計算対象キャラクター</span>
              <button type="button" className={`${styles.characterSelectButton} ${pickerStyles.toggleButton} ${pickerStyles.mainInputControl} ${pickerStyles.characterSelectButton}`} onClick={() => setShowCharacterPicker(true)}>キャラを選択</button>
              {selectedCharacter ? <span className={styles.selectedCharacterName}>{selectedCharacter.name}</span> : null}
            </div>
          </div>
          <div className={styles.statGrid}>
            {(["atk", "spd"] as const).map((stat: Stat) => {
              const labels = STAT_LABELS[stat];
              return (
                <section key={stat} className={styles.statBlock} aria-label={labels.base}>
                  <div className={styles.inputRow}>
                    <label className={styles.field}>
                      <span>{labels.base}</span>
                      <input type="number" inputMode="decimal" min="0" step="any" value={state[stat]}
                        onChange={(event) => { setState({ ...state, [stat]: event.target.value }); setSelectedCharacter(null); }} />
                    </label>
                    <label className={styles.field}>
                      <span>{labels.bonus}</span>
                      <input type="number" inputMode="decimal" step="any" value={state[labels.field]} placeholder="0"
                        onChange={(event) => setState({ ...state, [labels.field]: event.target.value })} />
                    </label>
                  </div>
                  <details className={styles.details}>
                    <summary>わくわくの実を詳細選択</summary>
                    <div className={styles.fruitGrid}>
                      {FRUITS[stat].map((group) => (
                        <div key={group.label} className={styles.fruitGroup}>
                          <div className={styles.fruitLabel}>{group.label}</div>
                          <div className={styles.fruitOptions}>
                            {(["L", "EL"] as Grade[]).map((grade) => (
                              <button key={grade} type="button" className={styles.fruitButton}
                                aria-label={`${group.label} 特級${grade}（+${group[grade]}）`}
                                aria-pressed={state.fruits[stat][group.label] === grade}
                                onClick={() => setState((current) => toggleFruit(current, stat, group.label, grade))}>
                                <img src={`/calc-legacy/特級${grade}.png`} alt={`特級${grade}`} width="42" height="42" />
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                </section>
              );
            })}
          </div>
          <p className={styles.hint}>加撃量・加速量は実とスポットを含む合計です。手入力でも調整できます。</p>
          <div className={styles.spots} role="group" aria-label="スポット">
            {([
              { spot: "main", label: "メイン+" },
              { spot: "mainOrSubPlus", label: "メイン/サブ+" },
              { spot: "sub", label: "サブ" },
            ] as const).map(({ spot, label }) => (
              <button key={spot} type="button" className={styles.spot}
                aria-pressed={state.spot === spot}
                title={"加撃 +" + SPOTS[spot].atk.toLocaleString("ja-JP") + " / 加速 +" + SPOTS[spot].spd}
                onClick={() => setState((current) => selectSpot(current, current.spot === spot ? "none" : spot))}>
                <span>{label}</span>
                <span>+{SPOTS[spot].atk.toLocaleString("ja-JP")}</span>
              </button>
            ))}
          </div>
          <div className={styles.actions}>
            <button type="submit" className={styles.primary}>計算</button>
            <button type="button" onClick={() => { setState(createInitialState(state.character)); setSubmitted(false); setSelectedCharacter(null); setShowCharacterPicker(false); }}>リセット</button>
          </div>
          <div className={styles.error} role="status">{result?.error}</div>
        </form>

        <section className={styles.card} aria-labelledby="buff-results">
          <h2 id="buff-results">計算結果</h2>
          <div className={styles.results} aria-live="polite" aria-atomic="true">
            {CHARACTERS[state.character].stages.map((stage, index) => {
              const value = result?.stages[index];
              return (
                <div key={index} className={styles.result}>
                  <div>{index + 1}段階目（上限 {stage.cap}倍）</div>
                  <div className={styles.value}>{value ? `${value.value}倍` : "-"}</div>
                  <div className={styles.hint}>{value?.capped ? "上限適用" : ""}</div>
                </div>
              );
            })}
          </div>
          <p className={styles.hint}>倍率は小数第3位まで表示し、第4位以降を切り捨てます。補正後の攻撃力・スピードが0以下の場合は計算できません。</p>
        </section>
      </div>
      {showCharacterPicker ? (
        <div className={pickerStyles.toolShell}>
          <CharacterPicker onClose={() => setShowCharacterPicker(false)} onSelect={(character) => {
            setSelectedCharacter(character);
            setState((current) => ({ ...current, atk: String(character.attack), spd: String(character.speed) }));
            setShowCharacterPicker(false);
          }} />
        </div>
      ) : null}
    </div>
  );
}
