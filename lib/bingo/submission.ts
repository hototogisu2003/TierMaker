import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { coerceBingoPayload, insertBingoSubmission, type BingoEvent } from "@/lib/bingo/server";

function normalizeDeviceToken(rawValue: string | undefined): string {
  const value = (rawValue ?? "").trim();
  if (!value) return "";
  if (value.length > 128) return "";
  if (!/^[A-Za-z0-9-]+$/.test(value)) return "";
  return value;
}

function setDeviceTokenCookie(response: NextResponse, deviceToken: string, cookieName: string) {
  response.cookies.set(cookieName, deviceToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function submitBingoPrediction(request: Request, event: BingoEvent) {
  const cookieName = event === "13th" ? "bingo_13th_device_token" : "bingo_device_token";
  const cookieStore = cookies();
  let deviceToken = normalizeDeviceToken(cookieStore.get(cookieName)?.value);
  let shouldSetDeviceTokenCookie = false;

  if (!deviceToken) {
    deviceToken = crypto.randomUUID();
    shouldSetDeviceTokenCookie = true;
  }

  try {
    const body = await request.json();
    const payload = coerceBingoPayload(body);
    const result = await insertBingoSubmission(payload, deviceToken, event);
    const response = NextResponse.json(result, { status: result.stored ? 200 : 202 });

    if (shouldSetDeviceTokenCookie) {
      setDeviceTokenCookie(response, deviceToken, cookieName);
    }

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "ビンゴ予想の保存に失敗しました";
    const response = NextResponse.json({ stored: false, message }, { status: 400 });
    if (shouldSetDeviceTokenCookie) {
      setDeviceTokenCookie(response, deviceToken, cookieName);
    }
    return response;
  }
}
