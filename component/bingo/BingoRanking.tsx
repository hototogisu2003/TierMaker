"use client";

import Link from "next/link";
import type { BingoRanking as BingoRankingData } from "@/lib/bingo/types";
import styles from "./BingoTool.module.css";

function getCompetitionRank<T extends { count: number }>(items: T[], index: number): number {
  if (index <= 0) return 1;
  if (items[index - 1]?.count === items[index]?.count) {
    return getCompetitionRank(items, index - 1);
  }
  return index + 1;
}

export default function BingoRanking({ ranking }: { ranking: BingoRankingData }) {
  return (
    <section className={styles.page}>
      <div className={styles.headerRow}>
        <div className={styles.headerTitleGroup}>
          <Link href="/" className={styles.homeLink} aria-label="Home">
            <img className={styles.headerLogo} src="/icon/icon_Header_2.png" alt="Strike-Optima" />
          </Link>
        </div>
        <Link href="/bingo" className={styles.iconLink} aria-label="入力へ" title="入力へ">
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
            <path fill="currentColor" d="M4 20h16v-2H4v2ZM6 4v11h12V4H6Zm2 2h8v7H8V6Z" />
          </svg>
        </Link>
      </div>

      <div className={styles.panel}>
        <div className={styles.rankingHead}>
          <h2 className={styles.rankingTitle}>予想ランキング</h2>
          <div className={styles.totalCount}>投稿数 {ranking.totalSubmissions}</div>
        </div>

        {ranking.characterRanking.length > 0 ? (
          <div className={styles.rankingGrid}>
            {ranking.characterRanking.map((item, index, items) => (
              <div key={`${item.id}-${index}`} className={styles.rankingCard}>
                <div className={styles.rankingIndex}>{getCompetitionRank(items, index)}</div>
                {item.iconUrl ? (
                  <img className={styles.rankingIcon} src={item.iconUrl} alt={item.name} />
                ) : (
                  <div className={`${styles.rankingIcon} ${styles.rankingFallback}`}>{item.name}</div>
                )}
                <div className={styles.rankingName}>{item.name}</div>
                <div className={styles.rankingCount}>{item.count}票</div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.emptyRanking}>まだ投稿がありません。</div>
        )}
      </div>
    </section>
  );
}
