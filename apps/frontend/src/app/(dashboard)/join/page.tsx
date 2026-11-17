"use client";

import React, { useState, useId, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
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

interface FoundSession {
  code: string;
  workspaceName: string;
  projectName: string;
  taskName: string;
  platform: "Desktop" | "Mobile";
  expiresAt: string;
  isTakenByOther?: boolean;
}

const MOCK_FOUND_SESSIONS: Record<string, FoundSession> = {
  // Screen 7: Valid open session
  "CYC-4821": {
    code: "CYC-4821",
    workspaceName: "Studio workspace",
    projectName: "KMUTT Library",
    taskName: "Book a study room",
    platform: "Desktop",
    expiresAt: "Open until 3 Nov",
    isTakenByOther: false,
  },
  // Screen 7A: Code already linked to someone else
  "CYC-TAKEN": {
    code: "CYC-TAKEN",
    workspaceName: "Studio workspace",
    projectName: "KMUTT Library",
    taskName: "Book a study room",
    platform: "Desktop",
    expiresAt: "Open until 3 Nov",
    isTakenByOther: true,
  },
  "CYC-8888": {
    code: "CYC-8888",
    workspaceName: "Fintech Studio",
    projectName: "Fintech Checkout",
    taskName: "Payment method selection",
    platform: "Mobile",
    expiresAt: "Open until 15 Nov",
    isTakenByOther: true,
  },
};

function JoinSessionContent() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCode = searchParams?.get("code") || "CYC-4821";

  const sessionInputId = useId();
  const [sessionCode, setSessionCode] = useState(initialCode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [manualError, setManualError] = useState("");

  if (isLoading || !user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Lookup session data based on code
  const trimmed = sessionCode.trim().toUpperCase();

  const sessionData: FoundSession | null =
    MOCK_FOUND_SESSIONS[trimmed] ||
    (trimmed === "CYC-4821"
      ? MOCK_FOUND_SESSIONS["CYC-4821"]
      : trimmed.startsWith("CYC-") && trimmed.length >= 6
      ? {
          code: trimmed,
          workspaceName: "Studio workspace",
          projectName: "KMUTT Library",
          taskName: "Book a study room",
          platform: "Desktop",
          expiresAt: "Open until 3 Nov",
          isTakenByOther: false,
        }
      : null);

  const isTaken = sessionData?.isTakenByOther === true;
  const isNotFound = trimmed.length >= 6 && !sessionData && !isTaken;

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trimmed) {
      setManualError("Please enter a session code.");
      return;
    }

    if (isTaken) {
      return; // Cannot continue with someone else's code
    }

    if (!sessionData) {
      setManualError("Session code not found or has expired. Please check the code and try again.");
      return;
    }

    setIsSubmitting(true);
    // Navigate to session consent / test flow (Figma Screen 27 PDPA consent)
    setTimeout(() => {
      router.push(`/sessions/${sessionData.code}/consent`);
    }, 400);
  };

  return (
    <div className="container mx-auto px-4 py-16 sm:py-20 flex flex-col items-center justify-center gap-4">
      {/* Figma Screen Switcher: Screen 7 (Valid) vs Screen 7A (Code already taken) */}
      <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-xl text-xs">
        <span className="text-muted-foreground font-medium px-2">Figma Preview:</span>
        <button
          type="button"
          onClick={() => {
            setSessionCode("CYC-4821");
            setManualError("");
          }}
          className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
            !isTaken && trimmed === "CYC-4821"
              ? "bg-background text-foreground shadow-2xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Valid Code (7)
        </button>
        <button
          type="button"
          onClick={() => {
            setSessionCode("CYC-TAKEN");
            setManualError("");
          }}
          className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
            isTaken
              ? "bg-background text-destructive shadow-2xs font-semibold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Code Taken (7A)
        </button>
      </div>

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
                  setSessionCode(e.target.value);
                  if (manualError) setManualError("");
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

              {/* Not found error */}
              {(manualError || isNotFound) && (
                <p
                  role="alert"
                  className="text-xs text-destructive flex items-center gap-1 mt-1"
                >
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>
                    {manualError || "Session code not found. Please verify the code."}
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
              disabled={!sessionData || isTaken || isSubmitting}
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
