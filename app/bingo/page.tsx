import { unstable_noStore as noStore } from "next/cache";
import type { Metadata } from "next";
import BingoTool from "@/component/bingo/BingoTool";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "予想ビンゴツール",
};

export default async function BingoPage() {
  noStore();

  return <BingoTool />;
}
