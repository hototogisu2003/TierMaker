"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "./SeiboPredictionTool.module.css";
import { SEIBO_QUESTS } from "@/lib/seiboPrediction/shared";
import type { Gimmick, SeiboQuestKey, SeiboQuestRanking, ShotType } from "@/lib/seiboPrediction/types";

function getShotIconPath(shotType: ShotType | ""): string {
  if (shotType === "反射") return "/gimmick/icon_反射.png";
  if (shotType === "貫通") return "/gimmick/icon_貫通.png";
  return "";
}

function getGimmickIconPath(gimmick: Gimmick | ""): string {
  if (!gimmick) return "";
  return `/gimmick/icon_${gimmick}.jpg`;
}

function parseGimmickRankingLabel(label: string): { shotType: ShotType | ""; gimmicks: string[] } {
  const parts = label.split(" + ").map((value) => value.trim()).filter(Boolean);
  const [shotType = "", ...gimmicks] = parts;
  return {
    shotType: shotType as ShotType | "",
    gimmicks,
  };
}

function getCompetitionRank<T extends { count: number }>(items: T[], index: number): number {
  if (index <= 0) return 1;
  if (items[index - 1]?.count === items[index]?.count) {
    return getCompetitionRank(items, index - 1);
  }
  return index + 1;
}

export default function SeiboPredictionRanking({ rankings }: { rankings: SeiboQuestRanking[] }) {
  const [activeQuestKey, setActiveQuestKey] = useState<SeiboQuestKey>(SEIBO_QUESTS[0].key);
  const activeRanking = rankings.find((entry) => entry.questKey === activeQuestKey) ?? null;

  return (
    <section className={styles.page}>
      <div className={styles.headerRow}>
        <h1 className={styles.title}>星墓クエスト予想ランキング</h1>
        <Link href="/Seibo-Prediction" className={styles.iconLink} aria-label="予想入力へ" title="予想入力へ">
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M13 3 4 14h6l-1 7 9-11h-6l1-7Z"
            />
          </svg>
        </Link>
      </div>

      <div className={styles.panel}>
        <div className={styles.rankingTabs}>
          {SEIBO_QUESTS.map((quest) => (
            <button
              key={quest.key}
              type="button"
              className={styles.rankingTab}
              data-selected={activeQuestKey === quest.key ? "1" : "0"}
              onClick={() => setActiveQuestKey(quest.key)}
            >
              {quest.bossName}
            </button>
          ))}
        </div>

        {activeRanking ? (
          <>
            <div className={styles.rankingBlocks}>
              <section className={styles.rankingBlock}>
                <h2 className={styles.rankingTitle}>撃種 + ギミック 上位5件</h2>
                {activeRanking.gimmickRanking.length > 0 ? (
                  <div className={styles.rankingList}>
                    {activeRanking.gimmickRanking.map((item, index) => {
                      const parsed = parseGimmickRankingLabel(item.label);
                      const shotIconPath = getShotIconPath(parsed.shotType);
                      return (
                        <div key={item.label} className={styles.rankingRow}>
                          <div className={styles.rankingIndex}>{index + 1}</div>
                          <div className={styles.rankingIconRow}>
                            {parsed.gimmicks.map((gimmick) => {
                              const iconPath = getGimmickIconPath(gimmick as Gimmick);
                              return iconPath ? (
                                <img
                                  key={`${item.label}-${gimmick}`}
                                  className={styles.rankingMechanicIcon}
                                  src={iconPath}
                                  alt={gimmick}
                                />
                              ) : null;
                            })}
                            {shotIconPath ? (
                              <img
                                className={styles.rankingMechanicIcon}
                                src={shotIconPath}
                                alt={parsed.shotType}
                              />
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className={styles.empty}>まだ投稿がありません。</div>
                )}
              </section>

              <section className={styles.rankingBlock}>
                <h2 className={styles.rankingTitle}>適正キャラ 上位15件</h2>
                {activeRanking.characterRanking.length > 0 ? (
                  <div className={styles.characterRankingGrid}>
                    {activeRanking.characterRanking.map((item, index, items) => (
                      <div key={`${item.id}-${index}`} className={styles.characterRankingCard}>
                        <div className={styles.rankingIndex}>{getCompetitionRank(items, index)}</div>
                        {item.iconUrl ? (
                          <img className={styles.characterRankingIcon} src={item.iconUrl} alt={item.name} />
                        ) : (
                          <div className={`${styles.characterRankingIcon} ${styles.characterFallback}`}>{item.name}</div>
                        )}
                        <div className={styles.characterRankingName}>{item.name}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={styles.empty}>まだ投稿がありません。</div>
                )}
              </section>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
