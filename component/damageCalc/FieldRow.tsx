"use client";

import * as React from "react";
import styles from "./DamageCalcTool.module.css";

type FieldRowProps = {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children?: React.ReactNode;
  className?: string;
};

function cn(...classes: Array<string | undefined | false | null>) {
  return classes.filter(Boolean).join(" ");
}

export default function FieldRow({ label, checked, onCheckedChange, children, className }: FieldRowProps) {
  return (
    <div className={cn(styles.fieldRow, className)}>
      <label className={styles.checkLabel}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onCheckedChange(event.target.checked)}
        />
        <span>{label}</span>
      </label>
      {children ? <div className={styles.fieldControl}>{children}</div> : null}
    </div>
  );
}
