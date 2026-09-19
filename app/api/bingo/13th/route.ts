import { submitBingoPrediction } from "@/lib/bingo/submission";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return submitBingoPrediction(request, "13th");
}
