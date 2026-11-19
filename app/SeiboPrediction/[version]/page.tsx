import { unstable_noStore as noStore } from "next/cache";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SeiboPredictionTool from "@/component/seiboPrediction/SeiboPredictionTool";
import { fetchSeiboBossCandidates, fetchSeiboBossCards } from "@/lib/seiboPrediction/server";
import { isSeiboVersion } from "@/lib/seiboPrediction/shared";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "適正予想メーカー",
};

export default async function SeiboPredictionPage({ params }: { params: { version: string } }) {
  const { version } = params;
  if (!isSeiboVersion(version)) notFound();
  noStore();

  const [bossCards, bossCandidates] = await Promise.all([
    fetchSeiboBossCards(version),
    version === "3" ? fetchSeiboBossCandidates().catch((error: unknown) => {
      console.error("Failed to load Seibo boss candidates:", error);
      return null;
    }) : null,
  ]);

  return <SeiboPredictionTool key={version} bossCards={bossCards} bossCandidates={bossCandidates} version={version} />;
}
