import type { Metadata } from "next";
import DamageCalcTool from "@/component/damageCalc/DamageCalcTool";

export const metadata: Metadata = {
  title: "ダメージ計算ツール",
  description: "モンスト向けのダメージ計算ツールとワンパン判定を利用できます。",
};

export default function DamageCalcPage() {
  return <DamageCalcTool />;
}
