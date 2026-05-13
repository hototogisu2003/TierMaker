import { unstable_noStore as noStore } from "next/cache";
import type { Metadata } from "next";
import SavedBoardsPage from "@/component/tiers/SavedBoardsPage";
import { loadTierCharacters } from "../loadCharacters";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "モンストTierメーカー",
};

export default async function TierSavedPage() {
  noStore();

  try {
    const { characters, shugoju } = await loadTierCharacters();
    return <SavedBoardsPage characters={[...characters, ...shugoju]} />;
  } catch (error) {
    console.error("Saved tier boards load error:", error);
    return <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(error, null, 2)}</pre>;
  }
}
