"use client";

import React from "react";
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
import { AlertCircle, LogOut, User as UserIcon } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Building03Icon, Ticket01Icon } from "@hugeicons/core-free-icons";

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const sessionHeadingId = React.useId();
  const sessionCodeId = React.useId();
  const sessionErrorId = React.useId();
  const sessionInputRef = React.useRef<HTMLInputElement>(null);
  const [sessionCode, setSessionCode] = React.useState("");
  const [sessionError, setSessionError] = React.useState("");
  const [joinStatus, setJoinStatus] = React.useState("");

  if (!user) return null;

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
    setJoinStatus("Joining by session code is not available yet.");
  };

  const initials = (user.name || user.email)
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground text-center">
          Welcome, {user.name}. How do you want to start?
        </h1>
        <p className="text-muted-foreground mt-1 text-center">
          You can do both later. Your role is set separately in each project.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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
              type="button"
              size="lg"
              className="w-full rounded-xl font-semibold hover:bg-primary-hover"
            >
              Create workspace
            </Button>
          </CardFooter>
        </Card>
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
                  className="w-full rounded-xl border border-primary bg-primary-subtle font-semibold text-primary-text hover:bg-primary-200 hover:text-primary-text dark:hover:bg-primary-900"
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
