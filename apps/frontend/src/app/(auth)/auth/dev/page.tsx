"use client";

import React, { useEffect, useRef, useState } from "react";
import { notFound, useRouter } from "next/navigation";
import axios from "axios";
import { useAuth } from "@/contexts/auth-context";
import { API_URL } from "@/lib/api-client";
import { consumeReturnTo } from "@/lib/return-to";
import { Card, CardContent } from "@/components/ui/card";
import { HugeIcon } from "@/components/ui/huge-icon";
import { Loading03Icon } from "@hugeicons/core-free-icons";
import { AuthTokens } from "@/types/auth";

/** A failure with a message that is safe and useful to show on the page. */
class DevSignInError extends Error {}

/**
 * Development-only sign-in that skips Google.
 *
 * Open the link printed by `pnpm dev:url` (backend script). It carries a real
 * refresh token in the URL fragment (`#refreshToken=...`), which is never sent
 * to a server by the browser. The page hands it to `POST /auth/refresh` with
 * `cookie: true`, so the API stores the session in its httpOnly cookie. Only
 * the server can do that: a page script cannot replace an existing httpOnly
 * cookie, so writing it from here failed whenever an old session cookie was
 * left. Then it returns to the page the visitor was sent away from.
 *
 * Disabled outside `next dev`: the page 404s in production builds.
 */
function DevSignIn() {
  const router = useRouter();
  const { isLoading, setSession } = useAuth();
  const token = useRef<string | null | undefined>(undefined);
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);

  // Take the token out of the address bar and history right away.
  useEffect(() => {
    if (token.current !== undefined) return;
    token.current = new URLSearchParams(window.location.hash.slice(1)).get("refreshToken");
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  useEffect(() => {
    // Wait for the app's own start-up refresh (with any old cookie) to finish,
    // so its cookie can't overwrite the new one. Refresh tokens are
    // single-use: never exchange one twice (StrictMode runs effects twice).
    if (isLoading || started.current) return;
    started.current = true;

    async function signIn() {
      const refreshToken = token.current;
      if (!refreshToken) {
        throw new DevSignInError(
          "No refresh token in the URL. Run `pnpm dev:url` in the repo and open the link it prints."
        );
      }
      let accessToken: string;
      try {
        const res = await axios.post<AuthTokens>(
          `${API_URL}/auth/refresh`,
          { refreshToken, cookie: true },
          { withCredentials: true }
        );
        accessToken = res.data.accessToken;
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 401) {
          throw new DevSignInError(
            "The token was rejected (expired, already used, or the database was reset). Run `pnpm dev:url` for a fresh link."
          );
        }
        throw err;
      }
      const user = await setSession(accessToken);
      if (!user) {
        throw new DevSignInError("Signed in, but your profile couldn't be loaded.");
      }
      router.replace(consumeReturnTo() ?? "/dashboard");
    }

    signIn().catch((err: unknown) =>
      setError(
        err instanceof DevSignInError
          ? err.message
          : "Could not reach the API. Is the backend running?"
      )
    );
  }, [isLoading, setSession, router]);

  return (
    <Card className="w-full shadow-sm">
      <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <>
            <HugeIcon
              icon={Loading03Icon}
              size={32}
              className="animate-spin text-primary"
            />
            <h2 className="text-lg font-medium text-foreground">
              Signing in (dev)...
            </h2>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function DevSignInPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }
  return <DevSignIn />;
}
