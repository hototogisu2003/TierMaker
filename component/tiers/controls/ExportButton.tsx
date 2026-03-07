"use client";

import React from "react";

type Props = {
  targetRef: React.RefObject<HTMLDivElement | null>;
};

export default function ExportButton({ targetRef }: Props) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

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

      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `tier-maker-${Date.now()}.png`;
      a.click();
    } catch (e: any) {
      setError(e?.message ?? "画像出力に失敗しました。画像読み込み完了後に再試行してください。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="exportWrap">
      <button className="btnPrimary" type="button" onClick={exportPng} disabled={busy}>
        {busy ? "出力中..." : "画像として保存"}
      </button>
      {error ? <div className="error">{error}</div> : null}

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
      `}</style>
    </div>
  );
}
