import { NextResponse } from "next/server";
import { searchSeiboCharacters } from "@/lib/seiboPrediction/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("query") ?? "").trim();
  const rawLimit = Number(searchParams.get("limit") ?? "12");
  const limit = Number.isFinite(rawLimit) ? Math.min(20, Math.max(1, Math.trunc(rawLimit))) : 12;

  if (!query) {
    return NextResponse.json({ characters: [] });
  }

  try {
    const characters = await searchSeiboCharacters(query, limit);
    return NextResponse.json({ characters });
  } catch (error) {
    const message = error instanceof Error ? error.message : "キャラクター検索に失敗しました";
    return NextResponse.json({ message }, { status: 500 });
  }
}
