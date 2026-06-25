import { NextResponse } from "next/server";
import { fetchBingoCharacterPage, fetchBingoCharactersByIds } from "@/lib/bingo/server";
import {
  BINGO_ELEMENTS,
  BINGO_FORMS,
  BINGO_TARGET_GACHAS,
  type BingoCharacterFilters,
  type BingoElement,
  type BingoForm,
  type BingoGacha,
} from "@/lib/bingo/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("query") ?? "").trim();
  const rawLimit = Number(searchParams.get("limit") ?? "48");
  const rawOffset = Number(searchParams.get("offset") ?? "0");
  const limit = Number.isFinite(rawLimit) ? Math.min(80, Math.max(1, Math.trunc(rawLimit))) : 48;
  const offset = Number.isFinite(rawOffset) ? Math.max(0, Math.trunc(rawOffset)) : 0;
  const elementSet = new Set<string>(BINGO_ELEMENTS);
  const gachaSet = new Set<string>(BINGO_TARGET_GACHAS);
  const formSet = new Set<string>(BINGO_FORMS);
  const filters: BingoCharacterFilters = {
    elements: (searchParams.get("elements") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter((value): value is BingoElement => elementSet.has(value)),
    gachas: (searchParams.get("gachas") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter((value): value is BingoGacha => gachaSet.has(value)),
    forms: (searchParams.get("forms") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter((value): value is BingoForm => formSet.has(value)),
  };

  try {
    const page = await fetchBingoCharacterPage(query, offset, limit, filters);
    return NextResponse.json(page);
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

    const characters = await fetchBingoCharactersByIds(ids);
    return NextResponse.json({ characters });
  } catch (error) {
    const message = error instanceof Error ? error.message : "キャラクター取得に失敗しました";
    return NextResponse.json({ message }, { status: 500 });
  }
}
