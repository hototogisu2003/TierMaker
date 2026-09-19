import type { Metadata } from "next";
import BingoRanking from "@/component/bingo/BingoRanking";
import { fetchBingoRanking } from "@/lib/bingo/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "13周年獣神化予想ビンゴランキング",
};

export default async function AnniversaryBingoRankingPage() {
  const ranking = await fetchBingoRanking("13th");
  return <BingoRanking ranking={ranking} inputUrl="/bingo/13th" />;
}
