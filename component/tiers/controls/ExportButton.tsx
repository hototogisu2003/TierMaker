"use client";

import React from "react";

type Props = {
  targetRef: React.RefObject<HTMLDivElement | null>;
};

const OUTPUT_WIDTH = 1280;
const OUTPUT_TITLE_HEIGHT = 40;
const OUTPUT_ROW_HEIGHT = 94;
const MIN_EXPORTED_ROWS = 1;
const EXPORT_WRAP_COLUMNS = 12;
const EXPORT_MIN_RANK_WIDTH = 92;
const EXPORT_RANK_FONT_SIZE = 24;
const EXPORT_FALLBACK_FONT_FAMILY = "sans-serif";
const EXPORT_ICON_SCALE = 0.91;

type ExportIconData = {
  src: string;
  alt: string;
  element?: HTMLImageElement | null;
};

type ExportRowData = {
  name: string;
  color: string;
  icons: ExportIconData[];
};

type ExportSnapshot = {
  rows: ExportRowData[];
  rankFontFamily: string;
};

type LoadedIcon = ExportIconData & {
  image: HTMLImageElement | null;
};

type LoadedRow = Omit<ExportRowData, "icons"> & {
  icons: LoadedIcon[];
};

type LoadedSnapshot = {
  rows: LoadedRow[];
  rankFontFamily: string;
};

export default function ExportButton({ targetRef }: Props) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [previewSnapshot, setPreviewSnapshot] = React.useState<LoadedSnapshot | null>(null);
  const [titleInput, setTitleInput] = React.useState("");
  const [includeTitleOnImage, setIncludeTitleOnImage] = React.useState(false);

  function sleep(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

  function buildSnapshot(container: HTMLElement): ExportSnapshot {
    const tierRows = Array.from(container.querySelectorAll<HTMLElement>(".tierRow"));

    const rows = tierRows.map<ExportRowData>((row) => {
      const tierLeft = row.querySelector<HTMLElement>(".tierLeft");
      const tierNameInput = row.querySelector<HTMLInputElement>(".tierNameInput");
      const images = Array.from(row.querySelectorAll<HTMLImageElement>(".tierItems .iconImg"));

      return {
        name: tierNameInput?.value?.trim() || "",
        color: tierLeft ? getComputedStyle(tierLeft).backgroundColor || "#ffffff" : "#ffffff",
        icons: images.map((img) => ({
          src: img.currentSrc || img.src,
          alt: img.alt || "",
          element: img,
        })),
      };
    });

    const lastOccupiedIndex = rows.reduce((acc, row, index) => (row.icons.length > 0 ? index : acc), -1);
    const exportCount = lastOccupiedIndex >= 0 ? lastOccupiedIndex + 1 : MIN_EXPORTED_ROWS;

    return {
      rows: rows.slice(0, exportCount),
      rankFontFamily:
        tierRows.length > 0
          ? getComputedStyle(
              tierRows[0].querySelector<HTMLInputElement>(".tierNameInput") ?? tierRows[0]
            ).fontFamily || EXPORT_FALLBACK_FONT_FAMILY
          : EXPORT_FALLBACK_FONT_FAMILY,
    };
  }

  async function loadImage(icon: ExportIconData): Promise<LoadedIcon> {
    const src = icon.src;
    const canReuseExisting =
      !!icon.element &&
      icon.element.complete &&
      icon.element.naturalWidth > 0 &&
      (() => {
        if (src.startsWith("blob:") || src.startsWith("data:")) return true;
        try {
          return new URL(src, window.location.href).origin === window.location.origin;
        } catch {
          return false;
        }
      })();

    if (canReuseExisting) {
      return {
        ...icon,
        image: icon.element ?? null,
      };
    }

    const attempts = 3;
    for (let i = 0; i < attempts; i += 1) {
      const loaded = await new Promise<LoadedIcon>((resolve) => {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.onload = () => resolve({ ...icon, image });
        image.onerror = () => resolve({ ...icon, image: null });
        image.src = `${icon.src}${icon.src.includes("?") ? "&" : "?"}exportTry=${i}`;
      });

      if (loaded.image) {
        return loaded;
      }

      if (icon.element && icon.element.complete && icon.element.naturalWidth > 0) {
        return {
          ...icon,
          image: icon.element ?? null,
        };
      }

      await sleep(250 * (i + 1));
    }

    return {
      ...icon,
      image: null,
    };
  }

  async function loadSnapshot(snapshot: ExportSnapshot): Promise<LoadedSnapshot> {
    const rows = await Promise.all(
      snapshot.rows.map(async (row) => ({
        ...row,
        icons: await Promise.all(row.icons.map((icon) => loadImage(icon))),
      }))
    );

    return { rows, rankFontFamily: snapshot.rankFontFamily };
  }

  function renderSnapshotToCanvas(snapshot: LoadedSnapshot, title: string, includeTitle: boolean) {
    const rankFontFamily = snapshot.rankFontFamily || EXPORT_FALLBACK_FONT_FAMILY;
    const measureCanvas = document.createElement("canvas");
    const measureCtx = measureCanvas.getContext("2d");
    if (!measureCtx) {
      throw new Error("画像描画に失敗しました。");
    }

    measureCtx.font = `800 ${EXPORT_RANK_FONT_SIZE}px ${rankFontFamily}`;
    const widestRankLabel = snapshot.rows.reduce((max, row) => {
      const label = row.name || " ";
      return Math.max(max, measureCtx.measureText(label).width);
    }, 0);
    const rankWidth = Math.max(EXPORT_MIN_RANK_WIDTH, Math.ceil(widestRankLabel + 24));
    const iconSize = ((OUTPUT_WIDTH - rankWidth) / EXPORT_WRAP_COLUMNS) * EXPORT_ICON_SCALE;
    const rowGap = Math.max(0, OUTPUT_ROW_HEIGHT - iconSize);

    const rowHeights = snapshot.rows.map((row) => {
      const lineCount = Math.max(1, Math.ceil(row.icons.length / EXPORT_WRAP_COLUMNS));
      return lineCount * OUTPUT_ROW_HEIGHT;
    });
    const boardHeight = rowHeights.reduce((sum, height) => sum + height, 0);
    const titleHeight = includeTitle ? OUTPUT_TITLE_HEIGHT : 0;

    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_WIDTH;
    canvas.height = titleHeight + boardHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("画像描画に失敗しました。");
    }

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (includeTitle) {
      let fontSize = 22;
      const maxTextWidth = OUTPUT_WIDTH - 24;
      ctx.font = `bold ${fontSize}px ${rankFontFamily}`;
      while (ctx.measureText(title).width > maxTextWidth && fontSize > 12) {
        fontSize -= 1;
        ctx.font = `bold ${fontSize}px ${rankFontFamily}`;
      }
      ctx.fillStyle = "#111827";
      ctx.font = `bold ${fontSize}px ${rankFontFamily}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(title, 16, titleHeight / 2);
    }

    let currentY = titleHeight;
    snapshot.rows.forEach((row, rowIndex) => {
      const rowHeight = rowHeights[rowIndex];
      const rowTop = currentY;
      const rowBottom = rowTop + rowHeight;

      ctx.fillStyle = row.color;
      ctx.fillRect(0, rowTop, rankWidth, rowHeight);

      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 2;
      if (rowIndex === 0) {
        ctx.beginPath();
        ctx.moveTo(0, rowTop + 0.5);
        ctx.lineTo(OUTPUT_WIDTH, rowTop + 0.5);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(0, rowBottom - 0.5);
      ctx.lineTo(OUTPUT_WIDTH, rowBottom - 0.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0.5, rowTop);
      ctx.lineTo(0.5, rowBottom);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(rankWidth + 0.5, rowTop);
      ctx.lineTo(rankWidth + 0.5, rowBottom);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(OUTPUT_WIDTH - 0.5, rowTop);
      ctx.lineTo(OUTPUT_WIDTH - 0.5, rowBottom);
      ctx.stroke();

      ctx.fillStyle = "#111111";
      ctx.font = `800 ${EXPORT_RANK_FONT_SIZE}px ${rankFontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(row.name, rankWidth / 2, rowTop + rowHeight / 2);

      row.icons.forEach((icon, index) => {
        if (!icon.image) return;
        const col = index % EXPORT_WRAP_COLUMNS;
        const line = Math.floor(index / EXPORT_WRAP_COLUMNS);
        const iconX = rankWidth + col * iconSize;
        const iconY = rowTop + line * OUTPUT_ROW_HEIGHT + rowGap / 2;
        ctx.drawImage(icon.image, iconX, iconY, iconSize, iconSize);
      });

      currentY += rowHeight;
    });

    return canvas.toDataURL("image/png");
  }

  async function exportPng() {
    const el = targetRef.current;
    if (!el) return;

    setBusy(true);
    setError(null);

    try {
      const rawSnapshot = buildSnapshot(el);
      const loadedSnapshot = await loadSnapshot(rawSnapshot);
      const fixedPreviewUrl = renderSnapshotToCanvas(loadedSnapshot, "", false);
      setPreviewSnapshot(loadedSnapshot);
      setPreviewUrl(fixedPreviewUrl);
      setTitleInput("");
      setIncludeTitleOnImage(false);
    } catch (e: any) {
      setError(e?.message ?? "画像出力に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  function closePreview() {
    setPreviewUrl(null);
    setPreviewSnapshot(null);
    setTitleInput("");
    setIncludeTitleOnImage(false);
  }

  async function savePreview() {
    if (!previewUrl || !previewSnapshot) return;
    try {
      const title = titleInput.trim();
      if (!title) {
        setError("タイトルを入力してください。");
        return;
      }
      const finalDataUrl = renderSnapshotToCanvas(previewSnapshot, title, includeTitleOnImage);
      const a = document.createElement("a");
      a.href = finalDataUrl;
      a.download = `${title}.png`;
      a.click();
      closePreview();
    } catch (e: any) {
      setError(e?.message ?? "画像保存に失敗しました。");
    }
  }

  return (
    <div className="exportWrap">
      <button className="btnPrimary" type="button" onClick={exportPng} disabled={busy}>
        {busy ? "出力中..." : "画像として保存"}
      </button>
      {error ? <div className="error">{error}</div> : null}

      {previewUrl ? (
        <div className="previewOverlay" role="dialog" aria-modal="true" aria-label="画像保存プレビュー">
          <div className="previewPanel">
            <div className="previewTitle">画像保存プレビュー</div>
            <img className="previewImage" src={previewUrl} alt="出力画像プレビュー" />
            <label className="nameLabel">
              タイトル
              <input
                className="nameInput"
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
              />
            </label>
            <label className="titleToggle">
              <input
                type="checkbox"
                checked={includeTitleOnImage}
                onChange={(e) => setIncludeTitleOnImage(e.target.checked)}
              />
              <span>表の上部にタイトルを表示する</span>
            </label>
            <div className="previewActions">
              <button type="button" className="btnSecondary" onClick={closePreview}>
                キャンセル
              </button>
              <button type="button" className="btnPrimary" onClick={savePreview}>
                保存
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <style jsx>{`
        .exportWrap {
          display: grid;
          gap: 4px;
          justify-items: end;
        }

        .btnPrimary {
          border: 1px solid #15803d;
          background: #22c55e;
          color: #ffffff;
          padding: 6px 10px;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 800;
          font-size: 13px;
          line-height: 1.15;
        }

        .btnPrimary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btnPrimary:hover:not(:disabled) {
          background: #16a34a;
        }

        .error {
          color: #ffb4b4;
          font-size: 12px;
          max-width: 360px;
          text-align: right;
        }

        .previewOverlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          display: grid;
          place-items: center;
          z-index: 70;
          padding: 16px;
        }

        .previewPanel {
          width: min(92vw, 760px);
          max-height: 88vh;
          overflow: auto;
          background: #ffffff;
          border: 1px solid #d1d5db;
          border-radius: 12px;
          padding: 12px;
          display: grid;
          gap: 10px;
        }

        .previewTitle {
          font-size: 14px;
          font-weight: 800;
          color: #111827;
        }

        .previewImage {
          width: 100%;
          height: auto;
          border: 1px solid #d1d5db;
          background: #ffffff;
          border-radius: 8px;
          object-fit: contain;
        }

        .nameLabel {
          display: grid;
          gap: 4px;
          font-size: 12px;
          color: #374151;
          justify-items: start;
        }

        .nameInput {
          width: min(100%, 360px);
          border: 1px solid #9ca3af;
          border-radius: 8px;
          padding: 6px 8px;
          font-size: 13px;
          color: #111827;
          background: #ffffff;
        }

        .titleToggle {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: #374151;
          font-size: 12px;
          line-height: 1.2;
        }

        .previewActions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          flex-wrap: wrap;
        }

        .btnSecondary {
          border: 1px solid #9ca3af;
          background: #f3f4f6;
          color: #111827;
          padding: 6px 10px;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 700;
          font-size: 13px;
          line-height: 1.15;
        }

        .btnSecondary:hover {
          background: #e5e7eb;
        }
      `}</style>
    </div>
  );
}
