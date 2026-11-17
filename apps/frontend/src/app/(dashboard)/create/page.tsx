"use client";

import React, { useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Loader2 } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Building03Icon, Ticket01Icon } from "@hugeicons/core-free-icons";

export default function OnboardingChoicePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const sessionHeadingId = useId();
  const sessionCodeId = useId();
  const sessionErrorId = useId();
  const sessionInputRef = useRef<HTMLInputElement>(null);
  const [sessionCode, setSessionCode] = useState("");
  const [sessionError, setSessionError] = useState("");
  const [joinStatus, setJoinStatus] = useState("");

  if (isLoading || !user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleJoinSession = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = sessionCode.trim();
    if (!trimmed) {
      setJoinStatus("");
      setSessionError("Please enter a session code.");
      sessionInputRef.current?.focus();
      return;
    }

    setSessionError("");
    router.push(`/join?code=${encodeURIComponent(trimmed)}`);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground text-center">
          Welcome, {user.name}. How do you want to start?
        </h1>
        <p className="text-muted-foreground mt-1 text-center">
          You can do both later. Your role is set separately in each project.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Card 1: Create a workspace */}
        <Card className="rounded-2xl">
          <CardHeader>
            <div
              aria-hidden="true"
              className="mb-2 flex size-10 items-center justify-center rounded-full bg-primary-subtle text-primary-text"
            >
              <HugeiconsIcon icon={Building03Icon} />
            </div>
            <CardTitle className="text-lg">Create a workspace</CardTitle>
            <CardDescription className="leading-relaxed">
              For designers and teams who run tests and invite clients,
              developers or project managers.
            </CardDescription>
          </CardHeader>
          <CardFooter className="mt-auto">
            <Button
              asChild
              type="button"
              size="lg"
              className="w-full rounded-xl font-semibold hover:bg-primary-hover cursor-pointer"
            >
              <Link href="/create/workspace">Create workspace</Link>
            </Button>
          </CardFooter>
        </Card>

        {/* Card 2: Join testing session with a code */}
        <Card className="rounded-2xl">
          <CardHeader>
            <div
              aria-hidden="true"
              className="mb-2 flex size-10 items-center justify-center rounded-full bg-primary-subtle text-primary-text"
            >
              <HugeiconsIcon icon={Ticket01Icon} />
            </div>
            <CardTitle id={sessionHeadingId} className="text-lg">
              Join testing session with a code
            </CardTitle>
            <CardDescription className="leading-relaxed">
              A designer sent you a session code or link to test a design. No
              workspace needed.
            </CardDescription>
          </CardHeader>
          <CardFooter className="mt-auto">
            <form
              onSubmit={handleJoinSession}
              aria-labelledby={sessionHeadingId}
              noValidate
              className="w-full space-y-2"
            >
              <Label htmlFor={sessionCodeId}>Session code</Label>
              <div className="flex flex-col gap-2">
                <Input
                  ref={sessionInputRef}
                  id={sessionCodeId}
                  name="sessionCode"
                  type="text"
                  required
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  enterKeyHint="go"
                  placeholder="e.g. CYC-4821"
                  value={sessionCode}
                  error={!!sessionError}
                  aria-describedby={sessionError ? sessionErrorId : undefined}
                  onChange={(e) => {
                    setSessionCode(e.target.value);
                    if (sessionError) setSessionError("");
                    if (joinStatus) setJoinStatus("");
                  }}
                />
                <Button
                  type="submit"
                  size="lg"
                  className="w-full rounded-xl border border-primary bg-primary-subtle font-semibold text-primary-text hover:bg-primary-200 hover:text-primary-text dark:hover:bg-primary-900 cursor-pointer"
                >
                  Join Session
                </Button>
              </div>
              {sessionError && (
                <p
                  id={sessionErrorId}
                  role="alert"
                  className="flex items-center gap-1.5 text-xs text-danger"
                >
                  <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
                  <span>{sessionError}</span>
                </p>
              )}
              {joinStatus && (
                <p role="status" className="text-xs text-muted-foreground">
                  {joinStatus}
                </p>
              )}
            </form>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
