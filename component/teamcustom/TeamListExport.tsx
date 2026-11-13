"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { toPng } from "html-to-image";
import { loadExportImages, type ExportImageFailure, type ExportImageSource } from "@/lib/teamcustom/exportImages";
import type { TeamRecord } from "@/lib/teamcustom/types";
import styles from "./TeamListExport.module.css";

const LIMIT = 10;
const EXPORT_WIDTH = 1080;
const EMPTY_ICON = "data:image/svg+xml;charset=utf-8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="6" fill="#eef1f5"/></svg>');

function Icon({ src, name, images }: { src?: string | null; name: string; images: Map<string, string> }) {
  const dataUrl = src ? images.get(src) : undefined;
  return dataUrl ? <img className={styles.icon} src={dataUrl} alt={name} />
    : <span className={styles.emptyIcon} role="img" aria-label={`${name}${src ? "（画像未取得）" : "未設定"}`} />;
}

export default function TeamListExport({ records, saveImage }: {
  records: TeamRecord[];
  saveImage: (dataUrl: string, fileName: string) => Promise<void>;
}) {
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [preparedImages, setPreparedImages] = useState(new Map<string, string>());
  const [failedImages, setFailedImages] = useState<ExportImageFailure[]>([]);
  const [imageProgress, setImageProgress] = useState({ completed: 0, total: 0 });
  const imageCacheRef = useRef(new Map<string, string>());
  const imageAbortRef = useRef<AbortController | null>(null);
  const captureRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const generationRef = useRef(0);
  const selectedRecords = records.filter((record) => selectedIds.includes(record.id)).slice(0, LIMIT);

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => records.some((record) => record.id === id)));
  }, [records]);

  useEffect(() => {
    if (selecting && !dialogRef.current?.open) dialogRef.current?.showModal();
  }, [selecting]);

  useEffect(() => () => { generationRef.current += 1; imageAbortRef.current?.abort(); }, []);

  function closePreview() {
    generationRef.current += 1;
    imageAbortRef.current?.abort();
    setPreviewOpen(false);
    setSelecting(false);
  }

  async function generatePreview() {
    if (!selectedRecords.length || !captureRef.current) return;
    const generation = ++generationRef.current;
    imageAbortRef.current?.abort();
    const controller = new AbortController();
    imageAbortRef.current = controller;
    setPreviewOpen(true);
    setLoading(true);
    setPreviewUrl("");
    setError("");
    setSaved(false);
    setFailedImages([]);
    setImageProgress({ completed: 0, total: 0 });
    try {
      const sources: ExportImageSource[] = [];
      for (const record of selectedRecords) {
        if (record.targetQuestIconUrl) sources.push({ url: record.targetQuestIconUrl, label: `${record.title}：クエスト（${record.targetQuestName || "未設定"}）` });
        for (const slot of record.slots) {
          if (slot.slotIndex >= 0 && slot.slotIndex < 4 && slot.iconUrl) sources.push({ url: slot.iconUrl, label: `${record.title}：${slot.slotIndex + 1}体目（${slot.characterName || "キャラ"}）` });
        }
        if (record.shugojuIconUrl) sources.push({ url: record.shugojuIconUrl, label: `${record.title}：守護獣（${record.shugojuName || "未設定"}）` });
      }
      const result = await loadExportImages(sources, imageCacheRef.current, controller.signal, (completed, total) => {
        if (generation === generationRef.current) setImageProgress({ completed, total });
      });
      if (generation !== generationRef.current) return;
      flushSync(() => { setPreparedImages(result.images); setFailedImages(result.failures); });
      const node = captureRef.current;
      await document.fonts.ready;
      await Promise.all(Array.from(node.querySelectorAll("img"), (img) => img.decode()));
      if (generation !== generationRef.current) return;
      const { width, height } = node.getBoundingClientRect();
      const url = await toPng(node, {
        pixelRatio: 1,
        canvasWidth: EXPORT_WIDTH,
        canvasHeight: Math.round(height * EXPORT_WIDTH / width),
        cacheBust: false,
        imagePlaceholder: EMPTY_ICON,
      });
      if (generation === generationRef.current) setPreviewUrl(url);
    } catch {
      if (generation === generationRef.current) setError("一覧画像を生成できませんでした。再試行してください。");
    } finally {
      if (generation === generationRef.current) setLoading(false);
    }
  }

  async function savePreview() {
    if (!previewUrl || saving) return;
    setSaving(true);
    setError("");
    try {
      const timestamp = new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
      }).format(new Date()).replace(/[-:]/g, "").replace(" ", "_");
      await saveImage(previewUrl, `編成一覧_${timestamp}.png`);
      setSaved(true);
    } catch {
      setError("画像を保存できませんでした。再度お試しください。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.container}>
      <div>
        <button type="button" className={styles.button} disabled={!records.length}
          aria-haspopup="dialog" aria-expanded={selecting} onClick={() => { setPreviewOpen(false); setSelecting(true); }}>
          一覧表示
        </button>
      </div>
      {selecting ? (
        <dialog ref={dialogRef} className={styles.dialog} aria-labelledby={previewOpen ? "team-overview-title" : "team-overview-selection-title"}
          onCancel={closePreview} onClick={(event) => { if (event.target === event.currentTarget) closePreview(); }}>
        <div className={styles.dialogHeader}>
          <h2 id={previewOpen ? "team-overview-title" : "team-overview-selection-title"} className={styles.dialogTitle}>
            {previewOpen ? "一覧プレビュー" : "表示する編成を選択"}
          </h2>
          <button className={styles.button} type="button" onClick={closePreview}>閉じる</button>
        </div>
        {!previewOpen ? (
        <div className={styles.selection} id="team-overview-selection">
          <div className={styles.toolbar}>
            <span aria-live="polite">{selectedRecords.length}/{LIMIT}件</span>
            <button className={styles.button} type="button" disabled={!selectedRecords.length} onClick={() => setSelectedIds([])}>選択解除</button>
          </div>
          <div className={styles.choices}>
            {records.map((record) => (
              <label className={styles.choice} key={record.id}>
                <input type="checkbox" checked={selectedIds.includes(record.id)}
                  disabled={selectedRecords.length >= LIMIT && !selectedIds.includes(record.id)}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setSelectedIds((current) => checked
                      ? current.includes(record.id) || current.length >= LIMIT ? current : [...current, record.id]
                      : current.filter((id) => id !== record.id));
                  }} />
                <span>{record.title}</span>
              </label>
            ))}
          </div>
          <div className={styles.toolbar}>
            <button className={styles.primaryButton} type="button" disabled={!selectedRecords.length} onClick={() => void generatePreview()}>プレビューを表示</button>
          </div>
        </div>
        ) : (
          <div className={styles.dialogContent}>
            <div className={styles.toolbar}>
              <span>{selectedRecords.length}件</span>
              <button className={styles.button} type="button" onClick={() => {
                generationRef.current += 1;
                imageAbortRef.current?.abort();
                setPreviewOpen(false);
              }}>選択に戻る</button>
              <button className={styles.button} type="button" disabled={loading || !previewUrl || saving} onClick={() => void savePreview()}>画像保存</button>
            </div>
            {loading ? <p role="status">プレビュー生成中...（画像 {imageProgress.completed}/{imageProgress.total}）</p> : null}
            {!loading && failedImages.length > 0 ? (
              <div className={styles.imageWarning} role="status">
                <p>再取得しても読み込めなかった画像が{failedImages.length}種類あります。該当箇所は灰色の枠で表示しています。</p>
                <ul>{failedImages.map((failure) => <li key={failure.url}>{failure.labels.join("、")}</li>)}</ul>
                <button className={styles.button} type="button" onClick={() => void generatePreview()}>画像を再取得</button>
              </div>
            ) : null}
            {error ? <div role="alert">{error}{!previewUrl ? <button className={styles.button} type="button" onClick={() => void generatePreview()}>再試行</button> : null}</div> : null}
            {saved ? <p role="status">画像保存を開始しました</p> : null}
            {previewUrl ? <img className={styles.previewImage} src={previewUrl} alt="選択した編成の一覧画像" /> : null}
          </div>
        )}
        </dialog>
      ) : null}
      <div className={styles.offscreen} aria-hidden="true">
        <div ref={captureRef} className={styles.exportSheet}>
          {selectedRecords.map((record) => (
            <div key={record.id} className={styles.exportRow}>
              <Icon src={record.targetQuestIconUrl} name={record.targetQuestName || "クエスト"} images={preparedImages} />
              <span className={styles.teamTitle}>{record.title}</span>
              <div className={styles.teamIcons}>
                {[0, 1, 2, 3].map((slotIndex) => {
                  const slot = record.slots.find((item) => item.slotIndex === slotIndex);
                  return <Icon key={slotIndex} src={slot?.iconUrl} name={slot?.characterName || `${slotIndex + 1}体目`} images={preparedImages} />;
                })}
              </div>
              <Icon src={record.shugojuIconUrl} name={record.shugojuName || "守護獣"} images={preparedImages} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
