import { unstable_noStore as noStore } from "next/cache";
import type { Metadata } from "next";
import BingoRanking from "@/component/bingo/BingoRanking";
import { fetchBingoRanking } from "@/lib/bingo/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "予想ビンゴランキング",
};

export default async function BingoRankingPage() {
  noStore();

  const ranking = await fetchBingoRanking();

  return <BingoRanking ranking={ranking} />;
}
