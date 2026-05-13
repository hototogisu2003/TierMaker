import { unstable_noStore as noStore } from "next/cache";
import type { Metadata } from "next";
import TierMaker from "@/component/tiers/TierMaker";
import { loadTierCharacters } from "./loadCharacters";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "モンストTierメーカー",
};

export default async function TierPage() {
  noStore();

  try {
    const { characters, shugoju } = await loadTierCharacters();
    return (
      <section className="stack">
        <TierMaker
          characters={characters}
          shugoju={shugoju}
          initialTiers={["S", "A", "B", "C", "D", "E"]}
        />
      </section>
    );
  } catch (error) {
    console.error("Tier page load error:", error);
    return <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(error, null, 2)}</pre>;
  }
}
