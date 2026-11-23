import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import type { JWT } from "next-auth/jwt";

// Only what we need: who you are + access to Drive files you can see.
// The full "drive" scope is required so Account 2 can see files Account 1 created.
const SCOPES = "openid email profile https://www.googleapis.com/auth/drive";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      authorization: {
        params: {
          scope: SCOPES,
          access_type: "offline", // gives a refresh token
          prompt: "consent select_account", // always lets you pick which Google account
        },
      },
    }),
  ],
  callbacks: {
    // Runs on the server. Tokens live only inside the encrypted session cookie.
    async jwt({ token, account }) {
      if (account) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at,
          error: undefined,
        };
      }
      // Still valid for more than a minute → keep it
      if (token.expiresAt && Date.now() < token.expiresAt * 1000 - 60_000) return token;
      return refreshAccessToken(token);
    },
    // What the browser can see: name/email/picture only. No tokens.
    async session({ session, token }) {
      session.error = token.error;
      return session;
    },
  },
});

export async function refreshAccessToken(token: JWT): Promise<JWT> {
  if (!token.refreshToken) return { ...token, error: "RefreshTokenError" };
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: process.env.AUTH_GOOGLE_ID!,
      client_secret: process.env.AUTH_GOOGLE_SECRET!,
      grant_type: "refresh_token",
      refresh_token: token.refreshToken,
    }),
  });
  const data = await res.json();
  if (!res.ok) return { ...token, error: "RefreshTokenError" };
  return {
    ...token,
    accessToken: data.access_token,
    expiresAt: Math.floor(Date.now() / 1000) + data.expires_in,
    refreshToken: data.refresh_token ?? token.refreshToken,
    error: undefined,
  };
}
