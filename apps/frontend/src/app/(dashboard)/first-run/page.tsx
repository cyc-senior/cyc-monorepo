"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { lookupSessionByCode } from "@/services/testing.service";
import { HugeIcon } from "@/components/ui/huge-icon";
import {
  Building01Icon,
  Key01Icon,
  AlertCircleIcon,
} from "@hugeicons/core-free-icons";
import { Loader2 } from "lucide-react";

export default function FirstRunScreen6Page() {
  const router = useRouter();
  const { user } = useAuth();
  const [sessionCode, setSessionCode] = React.useState("");
  const [joinError, setJoinError] = React.useState<string | null>(null);
  const [isJoining, setIsJoining] = React.useState(false);

  const firstName = user?.name ? user.name.split(" ")[0] : "there";

  const handleJoinSession = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = sessionCode.trim();
    if (!code) {
      setJoinError("Please enter a session code.");
      return;
    }

    setJoinError(null);
    setIsJoining(true);

    try {
      await lookupSessionByCode(code);
      router.push(`/sessions/${encodeURIComponent(code)}`);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Session not found or expired. Check the code and try again.";
      setJoinError(msg);
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-16 flex flex-col items-center justify-center min-h-[calc(100vh-4rem)]">
      {/* Heading (Node 814:9805) */}
      <div className="text-center max-w-xl mx-auto space-y-2 mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground font-heading">
          Welcome, {firstName}. How do you want to start?
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          You can do both later. Your role is set separately in each project.
        </p>
      </div>

      {/* Options Cards (Node 814:9809) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
        {/* Option 1: Create a workspace (Node 814:9810) */}
        <div className="rounded-2xl border bg-card text-card-foreground p-8 flex flex-col justify-between shadow-xs hover:border-primary/50 transition-colors">
          <div className="space-y-4">
            <div className="h-12 w-12 rounded-full bg-lime-100 dark:bg-lime-950/40 text-lime-700 dark:text-lime-400 flex items-center justify-center">
              <HugeIcon icon={Building01Icon} size={24} />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-foreground font-heading">
                Create a workspace
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                For designers and teams who run tests and invite clients, developers or project managers.
              </p>
            </div>
          </div>

          <div className="pt-8 mt-auto">
            <Button asChild className="w-full h-11 text-sm font-semibold rounded-xl">
              <Link href="/workspaces/new">Create workspace</Link>
            </Button>
          </div>
        </div>

        {/* Option 2: Join testing session with a code (Node 814:9823) */}
        <div className="rounded-2xl border bg-card text-card-foreground p-8 flex flex-col justify-between shadow-xs hover:border-primary/50 transition-colors">
          <div className="space-y-4">
            <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 flex items-center justify-center">
              <HugeIcon icon={Key01Icon} size={24} />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-foreground font-heading">
                Join testing session with a code
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                A designer sent you a session code or link to test a design. No workspace needed.
              </p>
            </div>
          </div>

          <form onSubmit={handleJoinSession} className="space-y-3 pt-6 mt-auto" noValidate>
            {joinError && (
              <Alert variant="destructive" className="py-2">
                <HugeIcon icon={AlertCircleIcon} size={16} />
                <AlertDescription className="text-xs">{joinError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="session-code" className="text-xs font-medium text-foreground">
                Session code
              </Label>
              <Input
                id="session-code"
                placeholder="e.g. CYC-4821"
                value={sessionCode}
                onChange={(e) => {
                  setSessionCode(e.target.value.toUpperCase());
                  if (joinError) setJoinError(null);
                }}
                className="h-10 text-sm font-mono uppercase"
              />
            </div>

            <Button
              type="submit"
              variant="outline"
              disabled={isJoining}
              className="w-full h-11 text-sm font-semibold rounded-xl cursor-pointer"
            >
              {isJoining ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  <span>Joining...</span>
                </>
              ) : (
                <span>Join session</span>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
