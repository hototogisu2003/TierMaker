import { NextRequest, NextResponse } from "next/server";
import { searchDamageCalcCharacters } from "@/lib/damageCalc/characters";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("query") ?? "";
    const requestedLimit = Number(request.nextUrl.searchParams.get("limit") ?? "30");
    const characters = await searchDamageCalcCharacters(query, Number.isFinite(requestedLimit) ? requestedLimit : 30);
    return NextResponse.json({ characters });
  } catch (error) {
    const message = error instanceof Error ? error.message : "キャラクターの取得に失敗しました";
    return NextResponse.json({ characters: [], message }, { status: 500 });
  }
}
