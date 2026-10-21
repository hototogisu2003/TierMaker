"use client";

import { FRUIT_GROUPS } from "@/lib/damageCalc/constants";
import type { FruitGroupId, FruitSelection, SpotBonus } from "@/lib/damageCalc/types";
import styles from "./DamageCalcTool.module.css";

type FruitPickerProps = {
  selectedFruits: FruitSelection;
  onToggle: (groupId: FruitGroupId, amount: number) => void;
  spotBonus: SpotBonus;
  onToggleSpot: (spot: Exclude<SpotBonus, "none">) => void;
};

function cn(...classes: Array<string | undefined | false | null>) {
  return classes.filter(Boolean).join(" ");
}

export default function FruitPicker({ selectedFruits, onToggle, spotBonus, onToggleSpot }: FruitPickerProps) {
  const mainGroups = FRUIT_GROUPS.filter((group) => group.id !== "kodakaAttack");
  const kodakaGroup = FRUIT_GROUPS.find((group) => group.id === "kodakaAttack");

  return (
    <div className={styles.fruitPicker}>
      <div className={styles.fruitGrid}>
        {mainGroups.map((group) => (
          <section key={group.id} className={styles.fruitGroup}>
            <div className={styles.fruitLabel}>{group.label}</div>
            <div className={styles.fruitOptions}>
              {group.options.map((option) => (
                <button
                  key={`${group.id}-${option.amount}`}
                  type="button"
                  className={cn(
                    styles.fruitButton,
                    selectedFruits[group.id] === option.amount && styles.fruitButtonActive
                  )}
                  onClick={() => onToggle(group.id, option.amount)}
                  aria-label={`${group.label} ${option.label}`}
                >
                  <img src={option.imageSrc} alt={option.label} className={styles.fruitImage} />
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className={styles.fruitBottomRow}>
        {kodakaGroup ? (
          <section className={styles.fruitGroup}>
            <div className={styles.fruitLabel}>{kodakaGroup.label}</div>
            <div className={styles.fruitOptions}>
              {kodakaGroup.options.map((option) => (
                <button
                  key={`${kodakaGroup.id}-${option.amount}`}
                  type="button"
                  className={cn(
                    styles.fruitButton,
                    selectedFruits[kodakaGroup.id] === option.amount && styles.fruitButtonActive
                  )}
                  onClick={() => onToggle(kodakaGroup.id, option.amount)}
                  aria-label={`${kodakaGroup.label} ${option.label}`}
                >
                  <img src={option.imageSrc} alt={option.label} className={styles.fruitImage} />
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section className={cn(styles.fruitGroup, styles.spotGroup)}>
          <div className={styles.fruitLabel}>スポット</div>
          <div className={styles.spotGridInline}>
            <button type="button" className={cn(styles.spotCard, spotBonus === "main" && styles.spotCardActive)} onClick={() => onToggleSpot("main")} aria-pressed={spotBonus === "main"}>
              <span>メイン+</span>
              <span>+2,000</span>
            </button>
            <button type="button" className={cn(styles.spotCard, spotBonus === "mainOrSubPlus" && styles.spotCardActive)} onClick={() => onToggleSpot("mainOrSubPlus")} aria-pressed={spotBonus === "mainOrSubPlus"}>
              <span>メイン/サブ+</span>
              <span>+1,500</span>
            </button>
            <button type="button" className={cn(styles.spotCard, spotBonus === "sub" && styles.spotCardActive)} onClick={() => onToggleSpot("sub")} aria-pressed={spotBonus === "sub"}>
              <span>サブ</span>
              <span>+500</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
