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
  SEIBO_QUESTS,
  SHOT_TYPE_OPTIONS,
  validateSubmissionPayload,
} from "@/lib/seiboPrediction/shared";
import type { Gimmick, SeiboBossCard, SeiboCharacterSummary, SeiboQuestKey, ShotType } from "@/lib/seiboPrediction/types";

type DraftPrediction = {
  questKey: SeiboQuestKey;
  shotType: ShotType | "";
  gimmicks: Gimmick[];
  characters: SeiboCharacterSummary[];
};

type NoticeTone = "info" | "warn" | "error";

type CharacterSearchResponse = {
  characters?: SeiboCharacterSummary[];
  message?: string;
};

type SubmissionResponse = {
  stored?: boolean;
  message?: string;
};

const SEIBO_PREDICTION_STORAGE_KEY = "seibo-prediction:draft:v1";
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

function createInitialPredictions(): DraftPrediction[] {
  return SEIBO_QUESTS.map((quest) => ({
    questKey: quest.key,
    shotType: "",
    gimmicks: [],
    characters: [],
  }));
}

function normalizeStoredPredictions(input: unknown): DraftPrediction[] {
  const fallback = createInitialPredictions();
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

    return {
      questKey: basePrediction.questKey,
      shotType: validShotType,
      gimmicks,
      characters,
    };
  });
}

function readStoredPredictions(): DraftPrediction[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SEIBO_PREDICTION_STORAGE_KEY);
    if (!raw) return null;
    return normalizeStoredPredictions(JSON.parse(raw));
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

function writeStoredPredictions(predictions: DraftPrediction[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SEIBO_PREDICTION_STORAGE_KEY, JSON.stringify(predictions));
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
        if (img.complete && img.naturalWidth > 0) {
          if ("decode" in img) {
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
    cacheBust: true,
    pixelRatio: 3,
    backgroundColor: "#ffffff",
  });
}

function PredictionEditorCard({
  bossCard,
  prediction,
  disabled,
  onShotTypeChange,
  onToggleGimmick,
  onCharactersChange,
}: {
  bossCard: SeiboBossCard;
  prediction: DraftPrediction;
  disabled: boolean;
  onShotTypeChange: (value: ShotType | "") => void;
  onToggleGimmick: (gimmick: Gimmick) => void;
  onCharactersChange: (characters: SeiboCharacterSummary[]) => void;
}) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [draftCharacters, setDraftCharacters] = useState<SeiboCharacterSummary[]>(prediction.characters);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SeiboCharacterSummary[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  useEffect(() => {
    if (!isPickerOpen) {
      setDraftCharacters(prediction.characters);
    }
  }, [prediction.characters, isPickerOpen]);

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
  }, [query]);

  const canSelectMore = draftCharacters.length < MAX_CHARACTERS;

  function openPicker() {
    setDraftCharacters(prediction.characters);
    setQuery("");
    setResults([]);
    setSearchError("");
    setIsPickerOpen(true);
  }

  function closePicker() {
    onCharactersChange(draftCharacters);
    setIsPickerOpen(false);
    setQuery("");
    setResults([]);
    setSearchError("");
  }

  function toggleDraftCharacter(character: SeiboCharacterSummary) {
    setDraftCharacters((current) => {
      if (current.some((entry) => entry.id === character.id)) {
        return current.filter((entry) => entry.id !== character.id);
      }
      if (current.length >= MAX_CHARACTERS) {
        return current;
      }
      return [...current, character];
    });
  }

  return (
    <article className={styles.questCard}>
      <div className={styles.questHead}>
        <div className={styles.bossCell}>
          {bossCard.iconUrl ? (
            <img className={styles.bossIcon} src={bossCard.iconUrl} alt={bossCard.bossName} />
          ) : (
            <div className={`${styles.bossIcon} ${styles.bossFallback}`}>{bossCard.bossName}</div>
          )}
        </div>
        <div className={styles.questTitleCell}>{bossCard.title}</div>
      </div>

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
                <div className={styles.helper}>選択中 {draftCharacters.length}/{MAX_CHARACTERS}</div>
                {!canSelectMore ? <div className={styles.helper}>4体まで選択済みです。</div> : null}
              </div>
              <p className={styles.helper}>タップして適正を選択</p>
              <div className={styles.selectedCharacters}>
                {draftCharacters.map((character) => (
                  <div key={`draft-${character.id}`} className={styles.selectedCharacter}>
                    <button
                      type="button"
                      className={styles.removeCharacter}
                      onClick={() => toggleDraftCharacter(character)}
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
                    const alreadySelected = draftCharacters.some((selected) => selected.id === character.id);
                    const isDisabled = !alreadySelected && !canSelectMore;
                    return (
                      <div key={character.id} className={styles.searchResult}>
                        {character.iconUrl ? (
                          <img className={styles.searchResultIcon} src={character.iconUrl} alt={character.name} />
                        ) : (
                          <div className={`${styles.searchResultIcon} ${styles.characterFallback}`}>{character.name}</div>
                        )}
                        <div>
                          <div className={styles.searchResultName}>{character.name}</div>
                        </div>
                        <button
                          type="button"
                          className={`${styles.searchResultAction} ${styles.searchResultActionMuted}`}
                          disabled={isDisabled}
                          onClick={() => toggleDraftCharacter(character)}
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

export default function SeiboPredictionTool({ bossCards }: { bossCards: SeiboBossCard[] }) {
  const [predictions, setPredictions] = useState<DraftPrediction[]>(() => createInitialPredictions());
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<NoticeTone>("info");
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isRankingSubmitting, setIsRankingSubmitting] = useState(false);
  const [hasSubmittedRanking, setHasSubmittedRanking] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewFileName, setPreviewFileName] = useState("");
  const exportRef = useRef<HTMLDivElement>(null);
  const hasLoadedDraftRef = useRef(false);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    let active = true;

    const loadStoredPredictions = async () => {
      try {
        const storedPredictions = readStoredPredictions();
        if (!storedPredictions) {
          return;
        }

        if (active) {
          setPredictions(storedPredictions);
        }

        try {
          const refreshedPredictions = await refreshStoredPredictionCharacters(storedPredictions);
          if (active) {
            setPredictions(refreshedPredictions);
          }
        } catch {
          if (active) {
            setPredictions(storedPredictions);
          }
        }
      } catch {
        window.localStorage.removeItem(SEIBO_PREDICTION_STORAGE_KEY);
      } finally {
        if (active) {
          hasLoadedDraftRef.current = true;
        }
      }
    };

    void loadStoredPredictions();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedDraftRef.current) return;
    writeStoredPredictions(predictions);
  }, [predictions]);

  const bossCardMap = useMemo(() => new Map(bossCards.map((card) => [card.questKey, card])), [bossCards]);

  function updatePrediction(questKey: SeiboQuestKey, updater: (current: DraftPrediction) => DraftPrediction) {
    setPredictions((current) => current.map((entry) => (entry.questKey === questKey ? updater(entry) : entry)));
  }

  function resetAll() {
    setPredictions(createInitialPredictions());
    setNotice("");
    setHasSubmittedRanking(false);
    try {
      window.localStorage.removeItem(SEIBO_PREDICTION_STORAGE_KEY);
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
      validateSubmissionPayload({ predictions });
      await generatePreview();
      setNotice("画像プレビューを生成しました。必要なら確認後にランキングへ反映してください。");
      setNoticeTone("info");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "処理に失敗しました");
      setNoticeTone("error");
    } finally {
      setIsPreviewLoading(false);
    }
  }

  async function submitRanking() {
    let payload;
    try {
      payload = validateSubmissionPayload({ predictions });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "入力内容を確認してください");
      setNoticeTone("error");
      return;
    }

    setIsRankingSubmitting(true);
    setNotice("");

    try {
      const response = await fetch("/api/seibo-prediction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as SubmissionResponse;
      if (!response.ok && response.status !== 202) {
        throw new Error(data.message ?? "ランキング反映に失敗しました");
      }

      setHasSubmittedRanking(true);
      setNotice(data.message ?? "ランキングへ反映しました。");
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

  return (
    <section className={styles.page}>
      <div className={styles.headerRow}>
        <div className={styles.headerTitleGroup}>
          <Link href="/" className={styles.homeLink} aria-label="Home">
            <img className={styles.headerLogo} src="/icon/icon_Header_2.png" alt="Strike-Optima" />
          </Link>
          <h1 className={styles.title}>適正予想メーカー</h1>
        </div>
        <Link
          href="/Seibo-Prediction/ranking"
          className={styles.iconLink}
          aria-label="ランキングへ"
          title="ランキングへ"
          onClick={() => writeStoredPredictions(predictions)}
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
        <Button variant="primary" className={styles.actionButton} onClick={() => void openPreviewModal()} disabled={isPreviewLoading || isRankingSubmitting}>
          {isPreviewLoading ? "生成中..." : "画像を作成"}
        </Button>
        <Button variant="ghost" className={styles.resetButton} onClick={resetAll} disabled={isPreviewLoading || isRankingSubmitting}>
          リセット
        </Button>
      </div>

      {notice ? (
        <div
          className={`${styles.status} ${
            noticeTone === "warn" ? styles.statusWarn : noticeTone === "error" ? styles.statusError : ""
          }`}
        >
          {notice}
        </div>
      ) : null}

      <div className={styles.panel}>
        <div className={styles.questList}>
          {predictions.map((prediction) => {
            const bossCard = bossCardMap.get(prediction.questKey);
            if (!bossCard) return null;
            return (
              <PredictionEditorCard
                key={prediction.questKey}
                bossCard={bossCard}
                prediction={prediction}
                disabled={isPreviewLoading || isRankingSubmitting}
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
                  {bossCard.title}
                </div>
                <div className={styles.exportLandscapeIconCell}>
                  {bossCard.iconUrl ? (
                    <img className={styles.exportLandscapeBossIcon} src={bossCard.iconUrl} alt={bossCard.bossName} />
                  ) : (
                    <div className={`${styles.exportLandscapeBossIcon} ${styles.bossFallback}`}>{bossCard.bossName}</div>
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
            <p className={styles.helper}>ランキングへ反映するのは、このボタンを押した後だけです。</p>
            <img className={styles.previewImage} src={previewUrl} alt="星墓予想プレビュー" />
            <div className={styles.previewFooterActions}>
              <Button variant="primary" onClick={() => void shareToTwitter()}>
                Twitter投稿
              </Button>
              <Button
                variant="primary"
                className={styles.actionButton}
                onClick={() => void submitRanking()}
                disabled={isRankingSubmitting || hasSubmittedRanking}
              >
                {hasSubmittedRanking ? "反映済み" : isRankingSubmitting ? "反映中..." : "ランキングに反映"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
