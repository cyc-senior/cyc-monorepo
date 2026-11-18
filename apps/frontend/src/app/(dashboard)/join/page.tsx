"use client";

import React, { useState, useId, useEffect, Suspense } from "react";
import axios from "axios";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import {
  joinSessionWithCode,
  lookupSessionByCode,
} from "@/services/testing.service";
import type { FoundSession } from "@/types/session";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Loader2 } from "lucide-react";

function JoinSessionContent() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCode = searchParams?.get("code") || "";

  const sessionInputId = useId();
  const [sessionCode, setSessionCode] = useState(initialCode);
  const [sessionData, setSessionData] = useState<FoundSession | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isTaken, setIsTaken] = useState(false);
  const [isNotFound, setIsNotFound] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [manualError, setManualError] = useState("");

  const trimmed = sessionCode.trim().toUpperCase();

  // Lookup session preview when user enters a session code
  useEffect(() => {
    if (!trimmed || trimmed.length < 4) {
      return;
    }

    let isMounted = true;
    const timer = setTimeout(async () => {
      try {
        setIsLookingUp(true);
        setIsNotFound(false);
        setIsTaken(false);

        const data = await lookupSessionByCode(trimmed);
        if (!isMounted) return;
        setSessionData(data);
        setIsTaken(Boolean(data?.isTakenByOther));
      } catch (err: unknown) {
        if (!isMounted) return;
        setSessionData(null);
        if (axios.isAxiosError(err)) {
          if (err.response?.status === 409 || err.response?.status === 403) {
            // Code already linked to someone else (Screen 7A)
            setIsTaken(true);
          } else if (err.response?.status === 404) {
            setIsNotFound(true);
          }
        }
      } finally {
        if (isMounted) {
          setIsLookingUp(false);
        }
      }
    }, 300);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [trimmed]);

  if (isLoading || !user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trimmed) {
      setManualError("Please enter a session code.");
      return;
    }

    if (isTaken) {
      return;
    }

    setManualError("");
    setIsSubmitting(true);

    try {
      const data = await joinSessionWithCode(trimmed);

      if (typeof window !== "undefined" && data?.accessToken) {
        sessionStorage.setItem("cyc_tester_token", data.accessToken);
      }

      router.push(`/sessions/${encodeURIComponent(trimmed)}/consent`);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 403 || err.response?.status === 409) {
          setIsTaken(true);
        } else {
          const msg = (err.response?.data as { message?: string })?.message;
          setManualError(
            msg ||
              "Session code not found or has expired. Please check the code and try again."
          );
        }
      } else {
        setManualError("Unable to join session. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-16 sm:py-20 flex flex-col items-center justify-center gap-4">
      {/* Join a test session Card (Figma node 220:4020 & 324:7387) */}
      <Card className="w-full max-w-[560px] rounded-[14px] border border-border/80 bg-card shadow-xs">
        <form onSubmit={handleContinue} noValidate>
          <CardHeader className="space-y-2 p-6 pb-4">
            <CardTitle className="font-heading text-2xl font-medium tracking-tight text-foreground">
              Join a test session
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground leading-relaxed">
              Enter the code from the designer. Codes look like CYC-4821.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 p-6 pt-0">
            {/* Session code Field */}
            <div className="space-y-2">
              <Label
                htmlFor={sessionInputId}
                className={`text-sm font-medium transition-colors ${
                  isTaken ? "text-destructive" : "text-foreground"
                }`}
              >
                Session code
              </Label>

              <Input
                id={sessionInputId}
                value={sessionCode}
                placeholder="CYC-4821"
                onChange={(e) => {
                  const val = e.target.value;
                  setSessionCode(val);
                  if (manualError) setManualError("");
                  if (val.trim().length < 4) {
                    setSessionData(null);
                    setIsTaken(false);
                    setIsNotFound(false);
                  }
                }}
                className={`rounded-[10px] h-9 text-sm transition-all ${
                  isTaken
                    ? "border-destructive text-foreground focus-visible:border-destructive ring-3 ring-destructive/20"
                    : ""
                }`}
                autoFocus
              />

              {/* Screen 7: Status Badge "Session found" */}
              {sessionData && !isTaken && !manualError && (
                <div className="pt-0.5">
                  <span className="inline-flex items-center justify-center h-[22px] px-2 rounded-[10px] bg-primary-subtle text-primary-text text-xs font-medium">
                    Session found
                  </span>
                </div>
              )}

              {/* Screen 7A: Error "This code is linked to someone else. Ask the designer for your own code." */}
              {isTaken && (
                <p className="text-sm text-destructive leading-tight pt-0.5">
                  This code is linked to someone else. Ask the designer for your own code.
                </p>
              )}

              {/* Not found / manual error */}
              {(manualError || isNotFound) && !isTaken && (
                <p
                  role="alert"
                  className="text-xs text-destructive flex items-center gap-1 mt-1"
                >
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    {manualError ||
                      "Session code not found. Please verify the code."}
                  </span>
                </p>
              )}
            </div>

            {/* Screen 7 only: Session summary box & tags (Hidden in Screen 7A) */}
            {sessionData && !isTaken && (
              <>
                <div className="rounded-[10px] border border-border p-3 flex flex-col gap-0.5 bg-background">
                  <p className="text-sm font-medium text-foreground leading-snug">
                    {sessionData.workspaceName}
                  </p>
                  <p className="text-sm text-muted-foreground leading-snug">
                    {sessionData.projectName} · {sessionData.taskName}
                  </p>
                </div>

                {/* Session tags (Figma node 220:4218) */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center justify-center h-[22px] px-2 rounded-[10px] border border-border bg-background text-xs font-medium text-foreground">
                    {sessionData.platform}
                  </span>
                  <span className="inline-flex items-center justify-center h-[22px] px-2 rounded-[10px] border border-border bg-background text-xs font-medium text-foreground">
                    {sessionData.expiresAt}
                  </span>
                </div>

                {/* PDPA consent notice */}
                <p className="text-sm text-muted-foreground leading-relaxed pt-1">
                  Next: you&apos;ll review how your test data is used (PDPA consent).
                </p>
              </>
            )}
          </CardContent>

          <CardFooter className="flex items-center justify-end gap-2.5 p-6 pt-2">
            <Button
              type="button"
              variant="ghost"
              disabled={isSubmitting}
              onClick={() => {
                if (typeof window !== "undefined" && window.history.length > 1) {
                  router.back();
                } else {
                  router.push("/dashboard");
                }
              }}
              className="rounded-[10px] h-8 px-3 text-sm font-medium text-foreground hover:bg-accent cursor-pointer"
            >
              Cancel
            </Button>

            <Button
              type="submit"
              disabled={!trimmed || isTaken || isSubmitting || isLookingUp}
              className={`rounded-[10px] h-8 px-3.5 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer ${
                isTaken ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  <span>Entering...</span>
                </>
              ) : (
                "Continue to session"
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

export default function JoinSessionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <JoinSessionContent />
    </Suspense>
  );
}
