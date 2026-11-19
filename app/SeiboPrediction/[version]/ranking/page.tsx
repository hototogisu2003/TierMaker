import { unstable_noStore as noStore } from "next/cache";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SeiboPredictionRanking from "@/component/seiboPrediction/SeiboPredictionRanking";
import { fetchAllSeiboRankings, fetchSeiboBossCards } from "@/lib/seiboPrediction/server";
import { isSeiboVersion } from "@/lib/seiboPrediction/shared";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "予想ランキング",
};

export default async function SeiboPredictionRankingPage({ params }: { params: { version: string } }) {
  const { version } = params;
  if (!isSeiboVersion(version)) notFound();
  noStore();

  const [rankings, bossCards] = await Promise.all([
    fetchAllSeiboRankings(version),
    fetchSeiboBossCards(version),
  ]);

  return <SeiboPredictionRanking key={version} rankings={rankings} bossCards={bossCards} version={version} />;
}
