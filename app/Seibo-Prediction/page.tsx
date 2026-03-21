import { unstable_noStore as noStore } from "next/cache";
import type { Metadata } from "next";
import SeiboPredictionTool from "@/component/seiboPrediction/SeiboPredictionTool";
import { fetchSeiboBossCards } from "@/lib/seiboPrediction/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "星墓クエスト予想メーカー",
};

export default async function SeiboPredictionPage() {
  noStore();

  const bossCards = await fetchSeiboBossCards();

  return <SeiboPredictionTool bossCards={bossCards} />;
}
