import { NextResponse } from "next/server";
import { fetchAllSeiboRankings } from "@/lib/seiboPrediction/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rankings = await fetchAllSeiboRankings();
    return NextResponse.json({ rankings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ランキング取得に失敗しました";
    return NextResponse.json({ message }, { status: 500 });
  }
}
