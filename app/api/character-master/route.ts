import { NextResponse } from "next/server";
import {
  createMasterIconUrl,
  loadCharacterMaster,
  loadShugojuMaster,
  type CharacterMasterResponse,
  type ShugojuMasterRow,
} from "@/lib/characterMaster/server";

export const dynamic = "force-dynamic";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function GET() {
  try {
    const [characters, shugojus] = await Promise.allSettled([loadCharacterMaster(), loadShugojuMaster()]);
    if (characters.status === "rejected") {
      throw characters.reason;
    }

    const iconUrl = createMasterIconUrl();
    const withIconUrl = <Row extends ShugojuMasterRow>(row: Row) => {
      const path = String(row.icon_path ?? "").trim();
      return { ...row, iconUrl: path ? iconUrl(path) : "" };
    };

    return NextResponse.json({
      characters: characters.value.map(withIconUrl),
      shugojus: shugojus.status === "fulfilled" ? shugojus.value.map(withIconUrl) : [],
      shugojuLoadError: shugojus.status === "rejected" ? errorMessage(shugojus.reason) : null,
    } satisfies CharacterMasterResponse);
  } catch (error) {
    return NextResponse.json({ message: errorMessage(error) }, { status: 500 });
  }
}
