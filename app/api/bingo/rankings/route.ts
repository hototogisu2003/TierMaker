import { NextResponse } from "next/server";
import { fetchBingoRanking } from "@/lib/bingo/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ranking = await fetchBingoRanking();
    return NextResponse.json({ ranking });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ビンゴランキングの取得に失敗しました";
    return NextResponse.json({ message }, { status: 500 });
  }
}
