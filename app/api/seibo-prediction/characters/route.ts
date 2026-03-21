import { NextResponse } from "next/server";
import { fetchSeiboCharactersByIds, searchSeiboCharacters } from "@/lib/seiboPrediction/server";

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

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { ids?: unknown };
    const ids = Array.isArray(body?.ids)
      ? body.ids
          .map((value) => String(value ?? "").trim())
          .filter(Boolean)
          .slice(0, 24)
      : [];

    if (ids.length === 0) {
      return NextResponse.json({ characters: [] });
    }

    const characters = await fetchSeiboCharactersByIds(ids);
    return NextResponse.json({ characters });
  } catch (error) {
    const message = error instanceof Error ? error.message : "キャラクター取得に失敗しました";
    return NextResponse.json({ message }, { status: 500 });
  }
}
