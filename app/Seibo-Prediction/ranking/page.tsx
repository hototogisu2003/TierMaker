import { unstable_noStore as noStore } from "next/cache";
import type { Metadata } from "next";
import SeiboPredictionRanking from "@/component/seiboPrediction/SeiboPredictionRanking";
import { fetchAllSeiboRankings } from "@/lib/seiboPrediction/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "星墓クエスト予想ランキング",
};

export default async function SeiboPredictionRankingPage() {
  noStore();

  const rankings = await fetchAllSeiboRankings();

  return <SeiboPredictionRanking rankings={rankings} />;
}
