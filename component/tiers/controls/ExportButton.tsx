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
        backgroundColor: "#0b0f17",
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
          gap: 6px;
          justify-items: end;
        }

        .btnPrimary {
          border: 1px solid rgba(255, 255, 255, 0.18);
          background: rgba(255, 255, 255, 0.14);
          color: var(--text);
          padding: 10px 12px;
          border-radius: 14px;
          cursor: pointer;
          font-weight: 800;
        }

        .btnPrimary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btnPrimary:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.18);
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
