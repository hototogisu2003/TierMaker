import type { Metadata } from "next";
import AssistSearch from "@/component/assist/AssistSearch";

export const metadata: Metadata = {
  title: "アシストスキル検索ツール",
  description: "アシストスキルの説明文と8種類の分類から、条件に合うモンストのキャラクターを検索できます。",
};

export default function AssistPage() {
  return <AssistSearch />;
}
