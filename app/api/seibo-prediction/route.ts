import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isCountablePrediction } from "@/lib/seiboPrediction/shared";
import { claimSeiboSubmissionSlot, coerceSeiboPayload, insertSeiboSubmission } from "@/lib/seiboPrediction/server";

export const dynamic = "force-dynamic";

const SEIBO_DEVICE_COOKIE_NAME = "seibo_device_token";
const SEIBO_SUBMISSION_COOLDOWN_HOURS = 12;

function normalizeDeviceToken(rawValue: string | undefined): string {
  const value = (rawValue ?? "").trim();
  if (!value) return "";
  if (value.length > 128) return "";
  if (!/^[A-Za-z0-9-]+$/.test(value)) return "";
  return value;
}

function setDeviceTokenCookie(response: NextResponse, deviceToken: string) {
  response.cookies.set(SEIBO_DEVICE_COOKIE_NAME, deviceToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function POST(request: Request) {
  const cookieStore = cookies();
  let deviceToken = normalizeDeviceToken(cookieStore.get(SEIBO_DEVICE_COOKIE_NAME)?.value);
  let shouldSetDeviceTokenCookie = false;

  if (!deviceToken) {
    deviceToken = crypto.randomUUID();
    shouldSetDeviceTokenCookie = true;
  }

  try {
    const body = await request.json();
    const payload = coerceSeiboPayload(body);
    const countablePredictions = payload.predictions.filter(isCountablePrediction);

    let response: NextResponse;
    if (countablePredictions.length === 0) {
      response = NextResponse.json(
        {
          stored: true,
          message: "画像は作成できましたが、ランキングに反映される予想はありません。",
        },
        { status: 200 }
      );
    } else {
      const slotClaim = await claimSeiboSubmissionSlot(deviceToken, SEIBO_SUBMISSION_COOLDOWN_HOURS);
      if (!slotClaim.allowed) {
        response = NextResponse.json(
          {
            stored: false,
            message: slotClaim.message,
          },
          { status: 429 }
        );
      } else {
        const result = await insertSeiboSubmission(payload);
        response = NextResponse.json(result, { status: result.stored ? 200 : 202 });
      }
    }

    if (shouldSetDeviceTokenCookie) {
      setDeviceTokenCookie(response, deviceToken);
    }

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "予想の保存に失敗しました";
    const response = NextResponse.json({ stored: false, message }, { status: 400 });
    if (shouldSetDeviceTokenCookie) {
      setDeviceTokenCookie(response, deviceToken);
    }
    return response;
  }
}
