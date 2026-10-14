"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ASSIST_FILTERS, filterAssistCharacters, type AssistCharacter, type AssistFilter, type AssistSort } from "@/lib/assist/characters";
import styles from "./AssistSearch.module.css";

function CharacterIcon({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false);
  return src && !failed ? (
    <img className={styles.icon} src={src} alt={name} width={64} height={64} loading="lazy" onError={() => setFailed(true)} />
  ) : (
    <span className={`${styles.icon} ${styles.placeholder}`} role="img" aria-label={`${name}の画像なし`}>画像なし</span>
  );
}

export default function AssistSearch() {
  const [characters, setCharacters] = useState<AssistCharacter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<AssistFilter[]>([]);
  const [draft, setDraft] = useState<AssistFilter[]>([]);
  const [sort, setSort] = useState<AssistSort>("number");
  const [draftSort, setDraftSort] = useState<AssistSort>("number");
  const [modalOpen, setModalOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const filterButton = useRef<HTMLButtonElement>(null);
  const activeRequest = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/assist/characters", { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error("fetch failed");
      const data = await response.json();
      if (!Array.isArray(data.characters)) throw new Error("invalid response");
      setCharacters(data.characters);
    } catch {
      if (!controller.signal.aborted) setError("キャラクターの取得に失敗しました。時間をおいて再試行してください。");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return () => activeRequest.current?.abort();
  }, [load]);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(input.trim()), 300);
    return () => clearTimeout(timer);
  }, [input]);

  const results = useMemo(() => filterAssistCharacters(characters, query, filters, sort), [characters, query, filters, sort]);

  function closeFilters() {
    dialog.current?.close();
  }

  function openFilters() {
    setDraft([...filters]);
    setDraftSort(sort);
    dialog.current?.showModal();
    setModalOpen(true);
  }

  // Native modal dialogs contain keyboard focus and handle Escape.
  useEffect(() => {
    if (!modalOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [modalOpen]);

  return (
    <section className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <Link href="/" aria-label="トップページへ"><img src="/icon/icon_Header_2.png" alt="Strike-Optima" width={192} height={64} /></Link>
          <h1>アシストスキル検索ツール</h1>
        </header>

        <div className={styles.controls}>
          <div className={styles.search}>
            <input id="assist-query" type="search" aria-label="説明文を検索" value={input} onChange={(event) => setInput(event.target.value)} placeholder="説明文を検索" />
          </div>
          <button ref={filterButton} className={styles.filterButton} type="button" onClick={openFilters} aria-haspopup="dialog">絞り込み・並び替え{filters.length > 0 ? `（${filters.length}）` : ""}</button>
          <button className={styles.resetButton} type="button" onClick={() => { setInput(""); setQuery(""); setFilters([]); setSort("number"); }}>条件をリセット</button>
        </div>

        <div aria-live="polite" role="status" className={styles.status}>
          {loading ? "読み込み中…" : error ? "" : `計 ${results.length}件`}
        </div>
        {error ? <div className={styles.message} role="alert"><p>{error}</p><button type="button" onClick={() => void load()}>再試行</button></div>
          : !loading && results.length === 0 ? <p className={styles.message}>条件に一致するキャラクターはありません。</p>
          : !loading && <ul className={styles.results}>
            {results.map((character) => <li className={styles.character} key={character.number}>
              <CharacterIcon key={character.iconUrl} src={character.iconUrl} name={character.name} />
              <div className={styles.details}><h2>{character.name}</h2><p>{character.assist_skill}</p></div>
            </li>)}
          </ul>}

        <dialog ref={dialog} className={styles.dialog} aria-labelledby="assist-filter-title"
          onClose={() => {
            if (dialog.current?.open) return;
            setModalOpen(false);
            filterButton.current?.focus();
          }}
          onClick={(event) => {
            if (event.target !== event.currentTarget) return;
            const box = event.currentTarget.getBoundingClientRect();
            if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) closeFilters();
          }}>
          <div className={styles.dialogHeader}>
            <h2 id="assist-filter-title">絞り込み・並び替え</h2>
            <button className={styles.applyButton} type="button" onClick={() => { setFilters([...draft]); setSort(draft.includes("attack_up") ? draftSort : "number"); closeFilters(); }}>検索</button>
            <button type="button" onClick={closeFilters} autoFocus>閉じる</button>
          </div>
          <p id="assist-filter-help">選択したスキルをすべて持つキャラクターを表示します。</p>
          <div className={styles.filterGrid} role="group" aria-label="スキル分類" aria-describedby="assist-filter-help">
            {ASSIST_FILTERS.map(({ key, label }) => <button type="button" key={key} aria-pressed={draft.includes(key)}
              onClick={() => {
                if (key === "attack_up" && draft.includes(key)) setDraftSort("number");
                setDraft((current) => current.includes(key) ? current.filter((value) => value !== key) : [...current, key]);
              }}>{label}</button>)}
          </div>
          <fieldset className={styles.sortOptions}>
            <legend>並び替え</legend>
            <div className={styles.sortChoices}>
              <label>
                <input type="radio" name="assist-sort" value="number" checked={draftSort === "number"} onChange={() => setDraftSort("number")} />
                番号順
              </label>
              <label className={!draft.includes("attack_up") ? styles.disabledSort : undefined}>
                <input type="radio" name="assist-sort" value="ratio" checked={draftSort === "ratio"}
                  disabled={!draft.includes("attack_up")} aria-describedby="assist-sort-help" onChange={() => setDraftSort("ratio")} />
                倍率順
              </label>
            </div>
            <p id="assist-sort-help">倍率順は「攻撃アップ」選択時に利用できます。<br />可変倍率→固定倍率→ステータスUPの順に表示</p>
          </fieldset>
        </dialog>
      </div>
    </section>
  );
}
