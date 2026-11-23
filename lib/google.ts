// Server-only helpers. Never import this file from a "use client" component.
import { getToken } from "next-auth/jwt";
import { refreshAccessToken } from "@/auth";

/** Returns the signed-in user's Google access token, refreshing it if expired. */
export async function getGoogleAccessToken(req: Request): Promise<string | null> {
    const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    secureCookie: new URL(req.url).protocol === "https:", // Vercel uses https cookies
  });
  if (!token?.accessToken) return null;
  if (token.expiresAt && Date.now() < token.expiresAt * 1000 - 60_000) return token.accessToken;
  const fresh = await refreshAccessToken(token);
  return fresh.error ? null : (fresh.accessToken ?? null);
}

export const DOC_MIME = "application/vnd.google-apps.document";
export const SHEET_MIME = "application/vnd.google-apps.spreadsheet";

/** Calls the Drive API as the signed-in user. */
export async function drive(path: string, accessToken: string, init: RequestInit = {}) {
  return fetch(`https://www.googleapis.com/drive/v3/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
  });
}

/** Turns a Google API error into a short, plain message for the UI. */
export async function explainError(res: Response, what: string) {
  const body = await res.json().catch(() => ({}));
  const reason: string = body?.error?.errors?.[0]?.reason ?? "";
  if (res.status === 401) return { status: 401, error: "Your Google session has expired. Disconnect and connect again." };
  if (res.status === 429 || reason.includes("rateLimit")) return { status: 429, error: "Google is rate-limiting requests. Wait a minute and try again." };
  if (res.status === 404) return { status: 404, error: `This Google account can't see the ${what}. Check it has access to the shared folder.` };
  if (res.status === 403) return { status: 403, error: `This Google account doesn't have permission for the ${what}.` };
  return { status: res.status, error: body?.error?.message ?? `Google returned an error (${res.status}).` };
}
