"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "./SeiboPredictionTool.module.css";
import type { CharacterRankingItem, Gimmick, SeiboBossCard, SeiboQuestRanking, SeiboVersion, ShotType } from "@/lib/seiboPrediction/types";

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

function RankedCharacters({ items }: { items: CharacterRankingItem[] }) {
  const [namedCharacterId, setNamedCharacterId] = useState<string | null>(null);
  if (!items.length) return <div className={styles.empty}>まだ投稿がありません。</div>;

  let rank = 1;
  return (
    <div className={styles.characterRankingGrid}>
      {items.map((item, index) => {
        if (index > 0 && items[index - 1].count !== item.count) rank = index + 1;
        const showName = namedCharacterId === item.id;
        return (
          <div key={item.id} className={styles.characterRankingCard}>
            <button
              type="button"
              className={styles.characterRankingButton}
              aria-label={`${rank}位 ${item.name}`}
              aria-pressed={showName}
              onClick={() => setNamedCharacterId(showName ? null : item.id)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setNamedCharacterId(null);
              }}
            >
              <span className={styles.characterRankingRank} aria-hidden="true">{rank}</span>
              {item.iconUrl ? (
                <img className={styles.characterRankingIcon} src={item.iconUrl} alt="" />
              ) : (
                <span className={styles.characterRankingPlaceholder} aria-hidden="true">?</span>
              )}
            </button>
            {showName ? <span className={styles.characterRankingName} aria-hidden="true">{item.name}</span> : null}
          </div>
        );
      })}
    </div>
  );
}

export default function SeiboPredictionRanking({
  rankings,
  bossCards,
  version,
}: {
  rankings: SeiboQuestRanking[];
  bossCards: SeiboBossCard[];
  version: SeiboVersion;
}) {
  const [activeQuestKey, setActiveQuestKey] = useState(bossCards[0]?.questKey);
  const activeRanking = rankings.find((entry) => entry.questKey === activeQuestKey) ?? null;

  return (
    <section className={styles.page}>
      <div className={styles.headerRow}>
        <div className={styles.headerTitleGroup}>
          <Link prefetch={false} href="/" className={styles.homeLink} aria-label="Home">
            <img className={styles.headerLogo} src="/icon/icon_Header_2.png" alt="Strike-Optima" />
          </Link>
          <h1 className={styles.title}>予想ランキング</h1>
        </div>
        <Link prefetch={false} href={`/SeiboPrediction/${version}`} className={styles.iconLink} aria-label="予想入力へ" title="予想入力へ">
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M13 3 4 14h6l-1 7 9-11h-6l1-7Z"
            />
          </svg>
        </Link>
      </div>

      <div className={`${styles.panel} ${styles.rankingPanel}`}>
        <div className={styles.rankingTabs}>
          {bossCards.map(({ questKey, bossName, iconUrl }) => (
            <button
              key={questKey}
              type="button"
              className={styles.rankingTab}
              aria-label={bossName}
              aria-pressed={activeQuestKey === questKey}
              title={bossName}
              onClick={() => setActiveQuestKey(questKey)}
            >
              {iconUrl ? <img className={styles.rankingTabIcon} src={iconUrl} alt="" /> : bossName}
            </button>
          ))}
        </div>

        {activeRanking ? (
          <>
            <div className={styles.rankingBlocks}>
              {version === "3" ? (
                <section className={styles.rankingBlock}>
                  <h2 className={styles.rankingTitle}>ボス予想</h2>
                  <RankedCharacters key={activeRanking.questKey} items={activeRanking.bossRanking} />
                </section>
              ) : null}
              <section className={styles.rankingBlock}>
                <h2 className={styles.rankingTitle}>ギミック 上位5件</h2>
                {activeRanking.gimmickRanking.length > 0 ? (
                  <div className={styles.rankingList}>
                    {activeRanking.gimmickRanking.map((item, index, items) => {
                      const parsed = parseGimmickRankingLabel(item.label);
                      const shotIconPath = getShotIconPath(parsed.shotType);
                      return (
                        <div key={item.label} className={styles.rankingRow}>
                          <div className={styles.rankingIndex}>{getCompetitionRank(items, index)}</div>
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
                          <div className={styles.rankingGimmickCharacters}>
                            {item.topCharacters.map(({ id, iconUrl, name }) => iconUrl ? (
                              <img key={id} className={styles.rankingGimmickCharacterIcon} src={iconUrl} alt={name} />
                            ) : (
                              <span key={id} className={styles.rankingGimmickCharacterIcon} role="img" aria-label={name}>?</span>
                            ))}
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
                <h2 className={styles.rankingTitle}>適正キャラ上位</h2>
                <RankedCharacters key={activeRanking.questKey} items={activeRanking.characterRanking} />
              </section>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
