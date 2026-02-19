"use client";

import React from "react";
import ExportButton from "./ExportButton";

type Props = {
  onReset: () => void;
  exportTargetRef: React.RefObject<HTMLDivElement | null>;
};

export default function BoardControls({ onReset, exportTargetRef }: Props) {
  return (
    <div className="controlsRow">
      <div className="left">
        <button className="btn" type="button" onClick={onReset}>
          リセット
        </button>
        <span className="muted note">※ページを開き直してもリセットされます</span>
      </div>

      <div className="right">
        <ExportButton targetRef={exportTargetRef} />
      </div>

      <style jsx>{`
        .controlsRow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }

        .left,
        .right {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .btn {
          border: 1px solid var(--border);
          background: rgba(255, 255, 255, 0.06);
          color: var(--text);
          padding: 10px 12px;
          border-radius: 14px;
          cursor: pointer;
          font-weight: 700;
        }

        .btn:hover {
          background: rgba(255, 255, 255, 0.09);
        }

        .note {
          font-size: 13px;
        }
      `}</style>
    </div>
  );
}
