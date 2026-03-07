"use client";

import React from "react";

type Props = {
  targetRef: React.RefObject<HTMLDivElement | null>;
};

export default function ExportButton({ targetRef }: Props) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [titleInput, setTitleInput] = React.useState("");
  const [includeTitleOnImage, setIncludeTitleOnImage] = React.useState(false);

  function sleep(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

  async function waitForImages(container: HTMLElement, timeoutMs = 10000) {
    const imgs = Array.from(container.querySelectorAll("img"));
    if (imgs.length === 0) return;

    await Promise.race([
      Promise.all(
        imgs.map(async (img) => {
          if (img.complete && img.naturalWidth > 0) {
            try {
              if ("decode" in img) {
                await img.decode();
              }
            } catch {
              // Ignore decode errors and continue.
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
      sleep(timeoutMs),
    ]);
  }

  async function stabilizeForCapture(container: HTMLElement) {
    await waitForImages(container, 10000);
    if ("fonts" in document) {
      try {
        await (document as Document & { fonts: { ready: Promise<unknown> } }).fonts.ready;
      } catch {
        // Ignore font readiness errors.
      }
    }
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }

  async function captureWithRetry(el: HTMLElement) {
    const mod = await import("html-to-image");
    const toPng = mod.toPng;
    const attempts = 3;
    let lastError: unknown = null;

    for (let i = 0; i < attempts; i += 1) {
      try {
        await stabilizeForCapture(el);
        const dataUrl = await toPng(el, {
          cacheBust: true,
          pixelRatio: 2,
          backgroundColor: "#ffffff",
          filter: (node) => {
            if (!(node instanceof Element)) return true;
            return !node.classList.contains("no-export");
          },
        });
        return dataUrl;
      } catch (e) {
        lastError = e;
        await sleep(250 * (i + 1));
      }
    }

    throw lastError ?? new Error("画像出力に失敗しました");
  }

  async function exportPng() {
    const el = targetRef.current;
    if (!el) return;

    setBusy(true);
    setError(null);

    try {
      const dataUrl = await captureWithRetry(el);
      setPreviewUrl(dataUrl);
      setTitleInput("");
      setIncludeTitleOnImage(false);
    } catch (e: any) {
      setError(e?.message ?? "画像出力に失敗しました。画像読み込み完了後に再試行してください。");
    } finally {
      setBusy(false);
    }
  }

  function closePreview() {
    setPreviewUrl(null);
    setTitleInput("");
    setIncludeTitleOnImage(false);
  }

  async function buildFinalDataUrl(baseUrl: string, title: string, includeTitle: boolean) {
    if (!includeTitle) return baseUrl;
    const img = new Image();
    img.src = baseUrl;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("プレビュー画像の読み込みに失敗しました"));
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    const ctx = canvas.getContext("2d");
    if (!ctx) return baseUrl;

    // Mobileでも見えるように大きめ基準で開始し、はみ出すときだけ縮小する。
    let fontSize = Math.min(56, Math.max(28, Math.round(canvas.width * 0.055)));
    const maxTextWidth = Math.max(0, canvas.width - 24);
    ctx.font = `bold ${fontSize}px sans-serif`;
    while (ctx.measureText(title).width > maxTextWidth && fontSize > 20) {
      fontSize -= 1;
      ctx.font = `bold ${fontSize}px sans-serif`;
    }

    const titleHeight = Math.max(56, fontSize + 16);
    canvas.height = img.height + titleHeight;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#111827";
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(title, 12, titleHeight / 2);
    ctx.drawImage(img, 0, titleHeight, img.width, img.height);
    return canvas.toDataURL("image/png");
  }

  async function savePreview() {
    if (!previewUrl) return;
    try {
      const title = titleInput.trim();
      if (!title) {
        setError("タイトルを入力してください。");
        return;
      }
      const finalDataUrl = await buildFinalDataUrl(previewUrl, title, includeTitleOnImage);
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
            <div className="previewTitle">画像プレビュー</div>
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
