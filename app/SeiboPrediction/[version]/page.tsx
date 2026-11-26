import { unstable_noStore as noStore } from "next/cache";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SeiboPredictionTool from "@/component/seiboPrediction/SeiboPredictionTool";
import { fetchSeiboBossCards } from "@/lib/seiboPrediction/server";
import { isSeiboVersion } from "@/lib/seiboPrediction/shared";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "適正予想メーカー",
};

export default async function SeiboPredictionPage({ params }: { params: Promise<{ version: string }> }) {
  const { version } = await params;
  if (!isSeiboVersion(version)) notFound();
  noStore();

  const bossCards = await fetchSeiboBossCards(version);

  return <SeiboPredictionTool key={version} bossCards={bossCards} version={version} />;
}
