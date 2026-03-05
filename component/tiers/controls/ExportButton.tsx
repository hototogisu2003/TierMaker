"use client";

import React from "react";

type Props = {
  targetRef: React.RefObject<HTMLDivElement | null>;
};

export default function ExportButton({ targetRef }: Props) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function exportPng() {
    const el = targetRef.current;
    if (!el) return;

    setBusy(true);
    setError(null);

    try {
      // Dynamic import to avoid bundling issues
      const mod = await import("html-to-image");
      const toPng = mod.toPng;

      const dataUrl = await toPng(el, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        filter: (node) => {
          if (!(node instanceof Element)) return true;
          return !node.classList.contains("no-export");
        },
      });

      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `tier-maker-${Date.now()}.png`;
      a.click();
    } catch (e: any) {
      setError(e?.message ?? "画像出力に失敗しました");
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
          border: 1px solid #1d4ed8;
          background: #3b82f6;
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
          background: #2563eb;
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
