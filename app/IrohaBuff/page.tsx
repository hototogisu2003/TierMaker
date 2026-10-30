import type { Metadata } from "next";
import IrohaBuffTool from "@/component/irohaBuff/IrohaBuffTool";

export const metadata: Metadata = {
  title: "あのSS",
  description: "いろは・ローレライα・カグヤのSSバフ倍率を、味方の攻撃力・スピード・わくわくの実・スポットから計算できます。",
};

export default function IrohaBuffPage() {
  return <IrohaBuffTool />;
}
