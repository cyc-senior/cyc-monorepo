"use client";

import React, { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Loader2 } from "lucide-react";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setSession } = useAuth();

  useEffect(() => {
    const token = searchParams.get("token");
    const error = searchParams.get("error");

    if (error) {
      router.replace(`/signin?error=${encodeURIComponent(error)}`);
      return;
    }

    if (token) {
      setSession(token)
        .then((user) => {
          if (user) {
            router.replace("/dashboard");
          } else {
            router.replace("/signin?error=profile_fetch_failed");
          }
        })
        .catch(() => {
          router.replace("/signin?error=auth_failed");
        });
    } else {
      router.replace("/signin");
    }
  }, [searchParams, router, setSession]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--cyc-bg-brand)] px-4">
      <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-8 shadow-sm">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <div className="text-center">
          <h2 className="text-lg font-medium text-foreground">
            Completing sign-in...
          </h2>
          <p className="text-sm text-muted-foreground">
            Please wait while we verify your session.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--cyc-bg-brand)]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}

