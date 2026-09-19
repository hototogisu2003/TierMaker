import type { Metadata } from "next";
import BingoTool from "@/component/bingo/BingoTool";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "13周年獣神化予想ビンゴ",
};

export default function AnniversaryBingoPage() {
  return (
    <BingoTool
      key="13th"
      title="13周年獣神化予想ビンゴ"
      storageKey="bingo:13th:draft:v1"
      submissionUrl="/api/bingo/13th"
      rankingUrl="/bingo/13th/ranking"
    />
  );
}
