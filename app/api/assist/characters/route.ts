import { NextResponse } from "next/server";
import { loadAssistCharacters } from "@/lib/assist/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ characters: await loadAssistCharacters() }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Assist characters could not be loaded", error);
    return NextResponse.json({ message: "キャラクターの取得に失敗しました。時間をおいて再試行してください。" }, {
      status: 500,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
