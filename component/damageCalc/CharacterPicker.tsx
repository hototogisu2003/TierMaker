"use client";

import { useEffect, useState } from "react";
import Input from "@/component/ui/Input";
import type { DamageCalcCharacter } from "@/lib/damageCalc/characterTypes";
import styles from "./DamageCalcTool.module.css";

type Props = {
  onSelect: (character: DamageCalcCharacter) => void;
  onClose: () => void;
};

export default function CharacterPicker({ onSelect, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [characters, setCharacters] = useState<DamageCalcCharacter[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(
          `/api/damage-calc/characters?query=${encodeURIComponent(query)}&limit=30`,
          { cache: "no-store" }
        );
        const data = (await response.json()) as { characters?: DamageCalcCharacter[]; message?: string };
        if (!active) return;
        if (!response.ok) throw new Error(data.message ?? "キャラクターの取得に失敗しました");
        setCharacters(data.characters ?? []);
      } catch (error) {
        if (!active) return;
        setCharacters([]);
        setError(error instanceof Error ? error.message : "キャラクターの取得に失敗しました");
      } finally {
        if (active) setLoading(false);
      }
    }, query.trim() ? 250 : 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className={styles.characterModalOverlay} onClick={onClose}>
      <section className={styles.characterModal} role="dialog" aria-modal="true"
        aria-labelledby="character-picker-title" onClick={(event) => event.stopPropagation()}>
        <div className={styles.characterModalHeader}>
          <h2 id="character-picker-title" className={styles.characterModalTitle}>キャラを選択</h2>
          <button type="button" className={styles.characterModalClose} onClick={onClose} aria-label="閉じる">×</button>
        </div>
        <Input className={styles.characterSearchInput} value={query} onChange={(event) => setQuery(event.target.value)}
          placeholder="キャラクター名を検索" autoFocus />
        {error ? <p className={styles.characterMessage}>{error}</p> : null}
        {loading ? <p className={styles.characterMessage}>読み込み中...</p> : null}
        {!loading && !error && characters.length === 0 ? <p className={styles.characterMessage}>該当するキャラクターが見つかりません。</p> : null}
        <div className={styles.characterResults}>
          {characters.map((character) => (
            <button key={character.id} type="button" className={styles.characterResult} onClick={() => onSelect(character)}>
              {character.iconUrl ? <img className={styles.characterResultIcon} src={character.iconUrl} alt="" />
                : <span className={styles.characterResultFallback}>画像なし</span>}
              <span className={styles.characterResultText}><strong>{character.name}</strong></span>
              <span className={styles.characterAttack}>攻撃力 {character.attack.toLocaleString("ja-JP")}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
