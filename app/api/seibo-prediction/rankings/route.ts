import { NextResponse } from "next/server";
import { fetchAllSeiboRankings } from "@/lib/seiboPrediction/server";
import { isSeiboVersion } from "@/lib/seiboPrediction/shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const version = new URL(request.url).searchParams.get("version") ?? "2";
  if (!isSeiboVersion(version)) {
    return NextResponse.json({ message: "ランキングのバージョンが不正です" }, { status: 400 });
  }

  try {
    const rankings = await fetchAllSeiboRankings(version);
    return NextResponse.json({ rankings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ランキング取得に失敗しました";
    return NextResponse.json({ message }, { status: 500 });
  }
}
