"use client";

import React, { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUser } = useAuth();

  useEffect(() => {
    const error = searchParams.get("error");

    if (error) {
      router.replace(`/signin?error=${encodeURIComponent(error)}`);
      return;
    }

    refreshUser()
      .then((user) => {
        if (user) {
          router.replace("/dashboard");
        } else {
          router.replace("/signin?error=auth_failed");
        }
      })
      .catch(() => {
        router.replace("/signin?error=auth_failed");
      });
  }, [searchParams, router, refreshUser]);

  return (
    <Card className="w-full shadow-sm">
      <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <div>
          <h2 className="text-lg font-medium text-foreground">
            Completing sign-in...
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Please wait while we verify your session.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}
