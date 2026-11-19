"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { toBlob } from "html-to-image";
import Input from "@/component/ui/Input";
import Button from "@/component/ui/button";
import styles from "./SeiboPredictionTool.module.css";
import {
  GIMMICK_OPTIONS,
  MAX_CHARACTERS,
  MAX_GIMMICKS,
  getSeiboQuests,
  isCountablePrediction,
  isSeiboBossForQuest,
  SHOT_TYPE_OPTIONS,
  normalizeSubmissionPayload,
} from "@/lib/seiboPrediction/shared";
import { NEW_SEIBO_BOSS } from "@/lib/seiboPrediction/types";
import type { Gimmick, SeiboBossCandidate, SeiboBossCard, SeiboCharacterSummary, SeiboQuestKey, SeiboQuestPrediction, SeiboVersion, ShotType } from "@/lib/seiboPrediction/types";

type DraftPrediction = SeiboQuestPrediction;

type NoticeTone = "info" | "warn" | "error";

type CharacterSearchResponse = {
  characters?: SeiboCharacterSummary[];
  message?: string;
};

type SubmissionResponse = {
  stored?: boolean;
  message?: string;
};

const STORAGE_KEYS: Record<SeiboVersion, string> = {
  "2": "seibo-prediction:draft:v1",
  "3": "seibo-prediction:3:draft:v1",
};
const PREVIEW_IMAGE_PLACEHOLDER = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#eef1f5"/></svg>',
);
const EXPORT_ROW_COLORS: Record<SeiboQuestKey, string> = {
  nigimitama: "#ff9b9b",
  tougenkyo: "#b8dcee",
  cocytus: "#b7e9b8",
  largamente: "#fff45c",
  melangcolin: "#e6c1e5",
  ex: "#ffffff",
};

function getExportShotIconPath(shotType: ShotType | ""): string {
  if (shotType === "反射") return "/gimmick/icon_反射.png";
  if (shotType === "貫通") return "/gimmick/icon_貫通.png";
  return "";
}

function getExportGimmickIconPath(gimmick: Gimmick | ""): string {
  if (!gimmick) return "";
  return `/gimmick/icon_${gimmick}.jpg`;
}

function createInitialPredictions(version: SeiboVersion): DraftPrediction[] {
  return getSeiboQuests(version).map((quest) => ({
    questKey: quest.key,
    bossId: null,
    shotType: "",
    gimmicks: [],
    characters: [],
  }));
}

function normalizeStoredPredictions(input: unknown, version: SeiboVersion): DraftPrediction[] {
  const fallback = createInitialPredictions(version);
  if (!Array.isArray(input)) {
    return fallback;
  }

  const byQuestKey = new Map<string, unknown>();
  for (const entry of input) {
    if (!entry || typeof entry !== "object") continue;
    const questKey = String((entry as { questKey?: unknown }).questKey ?? "").trim();
    if (questKey) {
      byQuestKey.set(questKey, entry);
    }
  }

  return fallback.map((basePrediction) => {
    const raw = byQuestKey.get(basePrediction.questKey);
    if (!raw || typeof raw !== "object") {
      return basePrediction;
    }

    const shotType = String((raw as { shotType?: unknown }).shotType ?? "").trim();
    const validShotType = SHOT_TYPE_OPTIONS.includes(shotType as ShotType) ? (shotType as ShotType) : "";

    const gimmicks = Array.isArray((raw as { gimmicks?: unknown }).gimmicks)
      ? ((raw as { gimmicks: unknown[] }).gimmicks ?? [])
          .map((value) => String(value))
          .filter((value, index, list): value is Gimmick => GIMMICK_OPTIONS.includes(value as Gimmick) && list.indexOf(value) === index)
          .slice(0, MAX_GIMMICKS)
      : [];

    const characters = Array.isArray((raw as { characters?: unknown }).characters)
      ? ((raw as { characters: unknown[] }).characters ?? [])
          .flatMap((character) => {
            if (!character || typeof character !== "object") return [];
            const id = String((character as { id?: unknown }).id ?? "").trim();
            const name = String((character as { name?: unknown }).name ?? "").trim();
            if (!id || !name) return [];
            return [{
              id,
              name,
              nameKana: String((character as { nameKana?: unknown }).nameKana ?? "").trim(),
              iconUrl: String((character as { iconUrl?: unknown }).iconUrl ?? "").trim(),
            }];
          })
          .filter((character, index, list) => list.findIndex((entry) => entry.id === character.id) === index)
          .slice(0, MAX_CHARACTERS)
      : [];

    const { bossId } = raw as { bossId?: unknown };
    return {
      questKey: basePrediction.questKey,
      bossId: version === "3" && typeof bossId === "string" && bossId.length <= 128 ? bossId.trim() || null : null,
      shotType: validShotType,
      gimmicks,
      characters,
    };
  });
}

function readStoredPredictions(version: SeiboVersion): DraftPrediction[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS[version]);
    if (!raw) return null;
    return normalizeStoredPredictions(JSON.parse(raw), version);
  } catch {
    return null;
  }
}

async function refreshStoredPredictionCharacters(predictions: DraftPrediction[]): Promise<DraftPrediction[]> {
  const ids = [...new Set(predictions.flatMap((prediction) => prediction.characters.map((character) => character.id)).filter(Boolean))];
  if (ids.length === 0) {
    return predictions;
  }

  const response = await fetch("/api/seibo-prediction/characters", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
    cache: "no-store",
  });
  const data = (await response.json()) as CharacterSearchResponse;
  if (!response.ok) {
    throw new Error(data.message ?? "キャラクター取得に失敗しました");
  }

  const latestById = new Map((data.characters ?? []).map((character) => [character.id, character]));
  return predictions.map((prediction) => ({
    ...prediction,
    characters: prediction.characters.map((character) => latestById.get(character.id) ?? character),
  }));
}

function writeStoredPredictions(predictions: DraftPrediction[], version: SeiboVersion) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEYS[version], JSON.stringify(predictions));
  } catch {
    // ignore localStorage write failures
  }
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function waitForImages(container: HTMLElement, timeoutMs = 8000) {
  const images = Array.from(container.querySelectorAll("img"));
  if (images.length === 0) return;

  await Promise.race([
    Promise.all(
      images.map(async (img) => {
        if (img.complete) {
          if (img.naturalWidth > 0 && "decode" in img) {
            try {
              await img.decode();
            } catch {
              // ignore image decode failures
            }
          }
          return;
        }

        await new Promise<void>((resolve) => {
          const done = () => {
            img.removeEventListener("load", done);
            img.removeEventListener("error", done);
            resolve();
          };
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
        });
      })
    ),
    delay(timeoutMs),
  ]);
}

function fileNameDateText(date: Date): string {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}_${String(
    date.getHours()
  ).padStart(2, "0")}${String(date.getMinutes()).padStart(2, "0")}`;
}

async function createPreviewBlob(node: HTMLElement) {
  await waitForImages(node);
  if ("fonts" in document) {
    try {
      await (document as Document & { fonts: { ready: Promise<unknown> } }).fonts.ready;
    } catch {
      // ignore font readiness failures
    }
  }
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  return toBlob(node, {
    // An icon may load in an img tag but fail when the exporter fetches its bytes.
    imagePlaceholder: PREVIEW_IMAGE_PLACEHOLDER,
    onImageErrorHandler(event) {
      if (typeof event === "string" || !(event.currentTarget instanceof HTMLImageElement)) return;
      const image = event.currentTarget;
      image.onerror = null;
      image.src = PREVIEW_IMAGE_PLACEHOLDER;
      // html-to-image replaces the clone's decode method.
      return HTMLImageElement.prototype.decode.call(image);
    },
    pixelRatio: 3,
    backgroundColor: "#ffffff",
  });
}

function PredictionEditorCard({
  bossCard,
  bossCandidates,
  selectedBoss,
  prediction,
  disabled,
  onBossChange,
  onShotTypeChange,
  onToggleGimmick,
  onCharactersChange,
}: {
  bossCard: SeiboBossCard;
  bossCandidates: SeiboBossCandidate[] | null;
  selectedBoss?: SeiboCharacterSummary;
  prediction: DraftPrediction;
  disabled: boolean;
  onBossChange?: (bossId: string | null) => void;
  onShotTypeChange: (value: ShotType | "") => void;
  onToggleGimmick: (gimmick: Gimmick) => void;
  onCharactersChange: (characters: SeiboCharacterSummary[]) => void;
}) {
  const [isBossPickerOpen, setIsBossPickerOpen] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SeiboCharacterSummary[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  useEffect(() => {
    if (!isPickerOpen || !query.trim()) {
      setResults([]);
      setSearchError("");
      setIsSearching(false);
      return;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      setIsSearching(true);
      setSearchError("");
      try {
        const response = await fetch(`/api/seibo-prediction/characters?query=${encodeURIComponent(query)}&limit=12`, {
          cache: "no-store",
        });
        const data = (await response.json()) as CharacterSearchResponse;
        if (!active) return;
        if (!response.ok) {
          throw new Error(data.message ?? "キャラクター検索に失敗しました");
        }
        setResults(data.characters ?? []);
      } catch (error) {
        if (!active) return;
        setResults([]);
        setSearchError(error instanceof Error ? error.message : "キャラクター検索に失敗しました");
      } finally {
        if (active) {
          setIsSearching(false);
        }
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [isPickerOpen, query]);

  const selectedCharacters = prediction.characters;
  const canSelectMore = selectedCharacters.length < MAX_CHARACTERS;
  const bossIconUrl = selectedBoss ? selectedBoss.iconUrl : bossCard.iconUrl;
  const bossIconName = selectedBoss?.name ?? bossCard.bossName;

  function openPicker() {
    setQuery("");
    setResults([]);
    setSearchError("");
    setIsPickerOpen(true);
  }

  function closePicker() {
    setIsPickerOpen(false);
    setQuery("");
    setResults([]);
    setSearchError("");
  }

  function toggleCharacter(character: SeiboCharacterSummary) {
    if (selectedCharacters.some((entry) => entry.id === character.id)) {
      onCharactersChange(selectedCharacters.filter((entry) => entry.id !== character.id));
    } else if (canSelectMore) {
      onCharactersChange([...selectedCharacters, character]);
    }
  }

  return (
    <article className={styles.questCard}>
      <div className={styles.questHead}>
        <div className={styles.bossCell}>
          {bossIconUrl ? (
            <img className={styles.bossIcon} src={bossIconUrl} alt={bossIconName} />
          ) : (
            <div className={`${styles.bossIcon} ${styles.bossFallback}`}>{bossIconName}</div>
          )}
        </div>
        <div className={styles.questTitleCell}>
          {onBossChange ? (
            <div className={styles.questBossControls}>
              <span>{bossCard.title}</span>
              <Button type="button" className={styles.selectButton} disabled={disabled} onClick={() => setIsBossPickerOpen(true)}>
                ボスを選択
              </Button>
              {selectedBoss ? <span className={styles.selectedBossName}>{selectedBoss.name}</span> : null}
            </div>
          ) : bossCard.title}
        </div>
      </div>

      {isBossPickerOpen && onBossChange ? (
        <div className={`${styles.modalOverlay} ${styles.bossPickerOverlay}`}>
          <div
            className={`${styles.modal} ${styles.bossPickerModal}`}
            role="dialog"
            aria-modal="true"
            aria-label={`${bossCard.title}のボスを選択`}
            onKeyDown={(event) => {
              if (event.key === "Escape") setIsBossPickerOpen(false);
            }}
          >
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>ボスを選択</h2>
              <div className={styles.modalActions}>
                {prediction.bossId ? (
                  <Button type="button" onClick={() => {
                    onBossChange(null);
                    setIsBossPickerOpen(false);
                  }}>
                    未選択に戻す
                  </Button>
                ) : null}
                <Button type="button" className={styles.closeButton} autoFocus onClick={() => setIsBossPickerOpen(false)}>閉じる</Button>
              </div>
            </div>
            {bossCandidates === null ? <p className={styles.helper}>爆絶のボス候補を取得できませんでした。</p> : null}
            <div className={styles.searchResults}>
              {(bossCandidates ?? [NEW_SEIBO_BOSS]).filter((boss) => isSeiboBossForQuest(boss, bossCard.questKey)).map((boss) => (
                <button
                  key={boss.id}
                  type="button"
                  className={styles.bossOption}
                  aria-pressed={prediction.bossId === boss.id}
                  onClick={() => {
                    onBossChange(boss.id);
                    setIsBossPickerOpen(false);
                  }}
                >
                  {boss.iconUrl ? <img className={styles.searchResultIcon} src={boss.iconUrl} alt="" loading="lazy" /> : null}
                  <span className={styles.searchResultName}>{boss.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className={styles.table}>
        <div className={styles.row}>
          <div className={styles.labelCell}>撃種</div>
          <div className={styles.valueCell}>
            <select
              className={styles.shotSelect}
              value={prediction.shotType}
              onChange={(event) => onShotTypeChange(event.target.value as ShotType | "")}
              disabled={disabled}
            >
              <option value="">選択</option>
              {SHOT_TYPE_OPTIONS.map((shotType) => (
                <option key={shotType} value={shotType}>
                  {shotType}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.labelCell}>ギミック</div>
          <div className={styles.valueCell}>
            <div className={styles.gimmickGrid}>
              {GIMMICK_OPTIONS.map((gimmick) => {
                const selected = prediction.gimmicks.includes(gimmick);
                const disabledByLimit = !selected && prediction.gimmicks.length >= MAX_GIMMICKS;
                return (
                  <button
                    key={gimmick}
                    type="button"
                    className={styles.gimmickButton}
                    data-selected={selected ? "1" : "0"}
                    onClick={() => onToggleGimmick(gimmick)}
                    disabled={disabled || disabledByLimit}
                  >
                    {gimmick}
                  </button>
                );
              })}
            </div>
            <p className={styles.helper}>最大{MAX_GIMMICKS}個まで選択できます。</p>
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.labelCell}>適正</div>
          <div className={styles.valueCell}>
            <div className={styles.selectedCharacters}>
              {prediction.characters.map((character) => (
                <div key={character.id} className={styles.selectedCharacter}>
                  {character.iconUrl ? (
                    <img className={styles.characterIcon} src={character.iconUrl} alt={character.name} />
                  ) : (
                    <div className={`${styles.characterIcon} ${styles.characterFallback}`}>{character.name}</div>
                  )}
                </div>
              ))}
            </div>
            <Button type="button" onClick={openPicker} disabled={disabled} className={styles.selectButton}>
              適正を選択
            </Button>
            <p className={styles.helper}>タップして適正を選択</p>
          </div>
        </div>
      </div>

      {isPickerOpen ? (
        <div className={styles.modalOverlay} onClick={closePicker}>
          <div className={`${styles.modal} ${styles.topAlignedModal}`} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>適正を選択</h2>
              <div className={styles.modalActions}>
                <Button type="button" className={styles.closeButton} onClick={closePicker}>
                  閉じる
                </Button>
              </div>
            </div>

            <div className={styles.searchRow}>
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="名前を入力して適正キャラを検索"
                disabled={disabled}
              />
              <div className={styles.modalSelectionHeader}>
                <div className={styles.helper}>選択中 {selectedCharacters.length}/{MAX_CHARACTERS}</div>
                {!canSelectMore ? <div className={styles.helper}>4体まで選択済みです。</div> : null}
              </div>
              <p className={styles.helper}>タップして適正を選択</p>
              <div className={styles.selectedCharacters}>
                {selectedCharacters.map((character) => (
                  <div key={character.id} className={styles.selectedCharacter}>
                    <button
                      type="button"
                      className={styles.removeCharacter}
                      onClick={() => toggleCharacter(character)}
                      aria-label={`${character.name}を削除`}
                    >
                      ×
                    </button>
                    {character.iconUrl ? (
                      <img className={styles.characterIcon} src={character.iconUrl} alt={character.name} />
                    ) : (
                      <div className={`${styles.characterIcon} ${styles.characterFallback}`}>{character.name}</div>
                    )}
                  </div>
                ))}
              </div>
              {searchError ? <p className={styles.helper}>{searchError}</p> : null}
              {isSearching ? <p className={styles.helper}>検索中...</p> : null}
              {!isSearching && query.trim() && results.length === 0 && !searchError ? (
                <p className={styles.helper}>一致するキャラが見つかりませんでした。</p>
              ) : null}
              {results.length > 0 ? (
                <div className={styles.searchResults}>
                  {results.map((character) => {
                    const alreadySelected = selectedCharacters.some((selected) => selected.id === character.id);
                    const isDisabled = !alreadySelected && !canSelectMore;
                    return (
                      <div key={character.id} className={styles.searchResult}>
                        {character.iconUrl ? (
                          <img className={styles.searchResultIcon} src={character.iconUrl} alt="" />
                        ) : (
                          <span className={`${styles.searchResultIcon} ${styles.characterFallback}`} aria-hidden="true">?</span>
                        )}
                        <div className={styles.searchResultName}>{character.name}</div>
                        <button
                          type="button"
                          className={`${styles.searchResultAction} ${styles.searchResultActionMuted}`}
                          disabled={isDisabled}
                          onClick={() => toggleCharacter(character)}
                        >
                          {alreadySelected ? "解除" : "選択"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}

export default function SeiboPredictionTool({
  bossCards,
  bossCandidates,
  version,
}: {
  bossCards: SeiboBossCard[];
  bossCandidates: SeiboBossCandidate[] | null;
  version: SeiboVersion;
}) {
  const autoSubmitRanking = version === "3";
  const [predictions, setPredictions] = useState<DraftPrediction[]>(() => createInitialPredictions(version));
  const [isDraftReady, setIsDraftReady] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<NoticeTone>("info");
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isRankingSubmitting, setIsRankingSubmitting] = useState(false);
  const [hasSubmittedRanking, setHasSubmittedRanking] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewFileName, setPreviewFileName] = useState("");
  const exportRef = useRef<HTMLDivElement>(null);
  const predictionsRef = useRef(predictions);
  const bossCandidateMap = useMemo(() => new Map(
    (bossCandidates ?? [NEW_SEIBO_BOSS]).map((boss) => [boss.id, boss]),
  ), [bossCandidates]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    let active = true;
    const draft = readStoredPredictions(version);

    if (draft) {
      const storedPredictions = bossCandidates === null ? draft : draft.map((prediction) => {
        if (!prediction.bossId) return prediction;
        const boss = bossCandidateMap.get(prediction.bossId);
        return boss && isSeiboBossForQuest(boss, prediction.questKey) ? prediction : { ...prediction, bossId: null };
      });
      if (storedPredictions.some((prediction, index) => prediction !== draft[index])) {
        writeStoredPredictions(storedPredictions, version);
      }
      predictionsRef.current = storedPredictions;
      setPredictions(storedPredictions);
      void refreshStoredPredictionCharacters(storedPredictions).then((refreshedPredictions) => {
        // Keep edits made while the character request was in flight.
        if (active && predictionsRef.current === storedPredictions) {
          predictionsRef.current = refreshedPredictions;
          setPredictions(refreshedPredictions);
        }
      }).catch(() => {
        // The saved selections can still be used when character refresh fails.
      });
    }
    setIsDraftReady(true);

    return () => {
      active = false;
    };
  }, [bossCandidateMap, bossCandidates, version]);

  const bossCardMap = useMemo(() => new Map(bossCards.map((card) => [card.questKey, card])), [bossCards]);
  const isEditorDisabled = !isDraftReady || isPreviewLoading || isRankingSubmitting;

  function updatePrediction(questKey: SeiboQuestKey, updater: (current: DraftPrediction) => DraftPrediction) {
    const nextPredictions = predictionsRef.current.map((entry) => (entry.questKey === questKey ? updater(entry) : entry));
    predictionsRef.current = nextPredictions;
    writeStoredPredictions(nextPredictions, version);
    setPredictions(nextPredictions);
  }

  function resetAll() {
    const initialPredictions = createInitialPredictions(version);
    predictionsRef.current = initialPredictions;
    setPredictions(initialPredictions);
    setNotice("");
    setHasSubmittedRanking(false);
    try {
      window.localStorage.removeItem(STORAGE_KEYS[version]);
    } catch {
      // ignore localStorage remove failures
    }
  }

  async function generatePreview() {
    const node = exportRef.current;
    if (!node) {
      throw new Error("画像出力領域が見つかりませんでした");
    }
    const blob = await createPreviewBlob(node);
    if (!blob) {
      throw new Error("画像の生成に失敗しました");
    }
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    const url = URL.createObjectURL(blob);
    setPreviewBlob(blob);
    setPreviewUrl(url);
    setPreviewFileName(`seibo_prediction_${fileNameDateText(new Date())}.png`);
    setHasSubmittedRanking(false);
  }

  async function openPreviewModal() {
    setIsPreviewLoading(true);
    setNotice("");
    try {
      normalizeSubmissionPayload({ predictions }, version);
      await generatePreview();
      if (autoSubmitRanking) {
        await submitRanking();
      } else {
        setNotice("画像プレビューを生成しました。必要なら確認後にランキングへ反映してください。");
        setNoticeTone("info");
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "予想画像を生成できませんでした。");
      setNoticeTone("error");
    } finally {
      setIsPreviewLoading(false);
    }
  }

  async function submitRanking() {
    let payload;
    try {
      payload = normalizeSubmissionPayload({ predictions }, version);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "入力内容を確認してください");
      setNoticeTone("error");
      return;
    }

    setIsRankingSubmitting(true);
    setNotice("");

    try {
      const postSubmission = () => fetch(`/api/seibo-prediction?version=${version}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      // A first submission sets the device cookie. Serialize requests across tabs so they can reuse it.
      const response = autoSubmitRanking && navigator.locks
        ? await navigator.locks.request("seibo-prediction:submit", postSubmission)
        : await postSubmission();
      const data = (await response.json()) as SubmissionResponse;
      if (!response.ok || (autoSubmitRanking && !data.stored)) {
        throw new Error(data.message ?? "ランキング反映に失敗しました");
      }

      setHasSubmittedRanking(true);
      const savedRankedPrediction = autoSubmitRanking &&
        payload.predictions.some((prediction) => prediction.bossId || isCountablePrediction(prediction));
      setNotice(savedRankedPrediction ? "" : data.message ?? "");
      setNoticeTone("info");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "ランキング反映に失敗しました");
      setNoticeTone("error");
    } finally {
      setIsRankingSubmitting(false);
    }
  }

  async function savePreview() {
    if (!previewBlob) return;
    const url = URL.createObjectURL(previewBlob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = previewFileName || `seibo_prediction_${fileNameDateText(new Date())}.png`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  async function shareToTwitter() {
    if (!previewBlob) return;
    const text = "星墓クエスト予想を作成しました #MSOptimize";
    const shareUrl = typeof window !== "undefined" ? window.location.href : "";
    const navigatorWithShare = navigator as Navigator & {
      canShare?: (data?: ShareData) => boolean;
    };

    try {
      const file = new File([previewBlob], previewFileName || "seibo_prediction.png", { type: "image/png" });
      if (navigatorWithShare.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({
          text,
          url: shareUrl,
          files: [file],
          title: "星墓予想",
        });
        return;
      }
    } catch {
      // fall through to intent URL
    }

    const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${text}\n${shareUrl}`)}`;
    window.open(intentUrl, "_blank", "noopener,noreferrer");
    setNotice("X投稿画面を開きました。画像添付に未対応の環境では、保存した画像を手動で添付してください。");
    setNoticeTone("warn");
  }

  const status = notice ? (
    <div
      role="status"
      className={`${styles.status} ${
        noticeTone === "warn" ? styles.statusWarn : noticeTone === "error" ? styles.statusError : ""
      }`}
    >
      {notice}
    </div>
  ) : null;

  return (
    <section className={styles.page}>
      <div className={styles.headerRow}>
        <div className={styles.headerTitleGroup}>
          <Link prefetch={false} href="/" className={styles.homeLink} aria-label="Home">
            <img className={styles.headerLogo} src="/icon/icon_Header_2.png" alt="Strike-Optima" />
          </Link>
          <h1 className={styles.title}>適正予想メーカー</h1>
        </div>
        <Link prefetch={false}
          href={`/SeiboPrediction/${version}/ranking`}
          className={styles.iconLink}
          aria-label="ランキングへ"
          title="ランキングへ"
        >
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M18 4h3v5c0 3.19-2.61 5.8-5.8 5.8h-.54A5.99 5.99 0 0 1 13 16.92V19h4v2H7v-2h4v-2.08A5.99 5.99 0 0 1 9.34 14.8H8.8C5.61 14.8 3 12.19 3 9V4h3V2h12v2ZM5 6v3c0 2.09 1.71 3.8 3.8 3.8h.08A5.99 5.99 0 0 1 8 10V6H5Zm14 0h-3v4c0 .99-.24 1.92-.66 2.75h.06C17.49 12.75 19 11.24 19 9V6Z"
            />
          </svg>
        </Link>
      </div>

      <div className={styles.toolbar}>
        <Button variant="primary" className={styles.actionButton} onClick={() => void openPreviewModal()} disabled={isEditorDisabled}>
          {isPreviewLoading ? "生成中..." : "画像を作成"}
        </Button>
        <Button variant="ghost" className={styles.resetButton} onClick={resetAll} disabled={isEditorDisabled}>
          リセット
        </Button>
      </div>

      {autoSubmitRanking && previewUrl ? null : status}

      <div className={styles.panel}>
        <div className={styles.questList}>
          {predictions.map((prediction) => {
            const bossCard = bossCardMap.get(prediction.questKey);
            if (!bossCard) return null;
            return (
              <PredictionEditorCard
                key={prediction.questKey}
                bossCard={bossCard}
                bossCandidates={bossCandidates}
                selectedBoss={bossCandidateMap.get(prediction.bossId ?? "")}
                prediction={prediction}
                disabled={isEditorDisabled}
                onBossChange={autoSubmitRanking ? (bossId) =>
                  updatePrediction(prediction.questKey, (current) => ({ ...current, bossId })) : undefined}
                onShotTypeChange={(shotType) => updatePrediction(prediction.questKey, (current) => ({ ...current, shotType }))}
                onToggleGimmick={(gimmick) =>
                  updatePrediction(prediction.questKey, (current) => ({
                    ...current,
                    gimmicks: current.gimmicks.includes(gimmick)
                      ? current.gimmicks.filter((value) => value !== gimmick)
                      : [...current.gimmicks, gimmick],
                  }))
                }
                onCharactersChange={(characters) =>
                  updatePrediction(prediction.questKey, (current) => ({
                    ...current,
                    characters,
                  }))
                }
              />
            );
          })}
        </div>
      </div>

      <div className={styles.hiddenExport} aria-hidden="true">
        <div ref={exportRef} className={styles.exportSheet}>
          <div className={styles.exportLandscapeHeader}>
            <div className={styles.exportLandscapeHeaderSpacer} />
            <div className={styles.exportLandscapeHeaderSpacer} />
            <div className={styles.exportLandscapeHeaderCell}>ギミック</div>
            <div className={styles.exportLandscapeHeaderCell}>適正</div>
          </div>
          {predictions.map((prediction) => {
            const bossCard = bossCardMap.get(prediction.questKey);
            if (!bossCard) return null;
            const selectedBoss = bossCandidateMap.get(prediction.bossId ?? "");
            const bossIconUrl = selectedBoss ? selectedBoss.iconUrl : bossCard.iconUrl;
            const bossIconName = selectedBoss?.name ?? bossCard.bossName;
            const orderedGimmicks = [...prediction.gimmicks].sort(
              (a, b) => GIMMICK_OPTIONS.indexOf(a) - GIMMICK_OPTIONS.indexOf(b)
            );
            const gimmickSlots = Array.from({ length: 4 }, (_, index) => orderedGimmicks[index] ?? "");
            const shotIconPath = getExportShotIconPath(prediction.shotType);
            return (
              <article key={`export-${prediction.questKey}`} className={styles.exportLandscapeRow}>
                <div
                  className={styles.exportLandscapeTitleCell}
                  style={{ backgroundColor: EXPORT_ROW_COLORS[prediction.questKey] }}
                >
                  {selectedBoss ? `${bossCard.title}（${selectedBoss.name}）` : bossCard.title}
                </div>
                <div className={styles.exportLandscapeIconCell}>
                  {bossIconUrl ? (
                    <img className={styles.exportLandscapeBossIcon} src={bossIconUrl} alt={bossIconName} />
                  ) : (
                    <div className={`${styles.exportLandscapeBossIcon} ${styles.bossFallback}`}>{bossIconName}</div>
                  )}
                </div>
                <div className={styles.exportLandscapeMechanicsCell}>
                  <div className={styles.exportLandscapeGimmickGrid}>
                    {gimmickSlots.map((gimmick, index) => {
                      const gimmickIconPath = getExportGimmickIconPath(gimmick);
                      return (
                        <div key={`${prediction.questKey}-gimmick-${index}`} className={styles.exportLandscapeGimmickCell}>
                          {gimmickIconPath ? (
                            <img
                              className={styles.exportLandscapeMechanicIcon}
                              src={gimmickIconPath}
                              alt={gimmick}
                            />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                  <div className={styles.exportLandscapeShotIconWrap}>
                    {shotIconPath ? (
                      <img
                        className={styles.exportLandscapeShotIcon}
                        src={shotIconPath}
                        alt={prediction.shotType}
                      />
                    ) : null}
                  </div>
                </div>
                <div className={styles.exportLandscapeCharactersCell}>
                  {prediction.characters.length > 0 ? (
                    prediction.characters.map((character) => (
                      <div key={character.id} className={styles.exportLandscapeCharacter}>
                        {character.iconUrl ? (
                          <img className={styles.exportLandscapeCharacterIcon} src={character.iconUrl} alt={character.name} />
                        ) : (
                          <div className={`${styles.exportLandscapeCharacterIcon} ${styles.characterFallback}`}>{character.name}</div>
                        )}
                      </div>
                    ))
                  ) : (
                    <span className={styles.exportLandscapeEmptyText} />
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {previewUrl ? (
        <div className={styles.modalOverlay} onClick={() => setPreviewUrl("")}>
          <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>画像プレビュー</h2>
              <div className={styles.modalActions}>
                <Button className={styles.actionButton} onClick={() => void savePreview()}>画像を保存</Button>
                <Button variant="ghost" className={styles.closeButton} onClick={() => setPreviewUrl("")}>
                  閉じる
                </Button>
              </div>
            </div>
            {autoSubmitRanking ? status : (
              <p className={styles.helper}>ランキングへ反映するのは、このボタンを押した後だけです。</p>
            )}
            <img className={styles.previewImage} src={previewUrl} alt="星墓予想プレビュー" />
            <div className={styles.previewFooterActions}>
              <Button variant="primary" onClick={() => void shareToTwitter()}>
                Twitter投稿
              </Button>
              {autoSubmitRanking ? null : (
                <Button
                  variant="primary"
                  className={styles.actionButton}
                  onClick={() => void submitRanking()}
                  disabled={isRankingSubmitting || hasSubmittedRanking}
                >
                  {hasSubmittedRanking ? "反映済み" : isRankingSubmitting ? "反映中..." : "ランキングに反映"}
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
