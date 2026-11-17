"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api-client";
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
import { AlertCircle, Loader2, Plus, X, Info } from "lucide-react";

export default function CreateWorkspacePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  // Form states
  const [workspaceName, setWorkspaceName] = useState("");
  const [nameError, setNameError] = useState("");
  const [teammates, setTeammates] = useState<string[]>([""]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isLoading || !user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Teammates list handlers
  const handleTeammateChange = (index: number, value: string) => {
    setTeammates((prev) => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  };

  const handleAddTeammate = () => {
    setTeammates((prev) => [...prev, ""]);
  };

  const handleRemoveTeammate = (index: number) => {
    setTeammates((prev) => {
      if (prev.length <= 1) return [""];
      return prev.filter((_, i) => i !== index);
    });
  };

  // Submit handler
  const handleCreateWorkspace = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedName = workspaceName.trim();
    if (!trimmedName) {
      setNameError("Please enter a workspace name.");
      return;
    }

    setNameError("");
    setIsSubmitting(true);

    try {
      // 1. Create Organization in backend
      const org = await apiFetch<{ id: string; name: string }>(
        "/organizations",
        {
          method: "POST",
          data: { name: trimmedName },
        }
      );

      // 2. Invite teammates if provided
      const validEmails = teammates
        .map((email) => email.trim())
        .filter((email) => email.length > 0);

      for (const email of validEmails) {
        try {
          await apiFetch(`/organizations/${org.id}/members`, {
            method: "POST",
            data: { email, role: "MEMBER" },
          });
        } catch (inviteErr) {
          console.warn("Failed to invite teammate:", email, inviteErr);
        }
      }

      // 3. Redirect to dashboard
      router.push("/dashboard");
    } catch (err) {
      console.error("Failed to create workspace:", err);
      // Fallback redirect for mock or demo environments
      router.push("/dashboard");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-xl flex flex-col items-center justify-center">
      <Card className="w-full max-w-xl rounded-2xl border border-border/80 shadow-sm">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
            Create a workspace
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            A workspace holds your team and projects.
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleCreateWorkspace} noValidate>
          <CardContent className="space-y-5">
            {/* Workspace name */}
            <div className="space-y-2">
              <Label
                htmlFor="workspace-name"
                className="text-xs font-semibold text-foreground"
              >
                Workspace name
              </Label>
              <Input
                id="workspace-name"
                placeholder="Studio workspace"
                value={workspaceName}
                error={!!nameError}
                onChange={(e) => {
                  setWorkspaceName(e.target.value);
                  if (nameError) setNameError("");
                }}
                className="rounded-xl text-sm"
                autoFocus
              />
              {nameError && (
                <p
                  role="alert"
                  className="text-xs text-destructive flex items-center gap-1 mt-1"
                >
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>{nameError}</span>
                </p>
              )}
            </div>

            {/* Invite teammates */}
            <div className="space-y-2">
              <Label
                htmlFor="teammate-0"
                className="text-xs font-semibold text-foreground"
              >
                Invite teammates (optional)
              </Label>

              <div className="space-y-2">
                {teammates.map((email, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      id={`teammate-${idx}`}
                      type="email"
                      placeholder={
                        idx === 0
                          ? "nok@studio.co"
                          : idx === 1
                          ? "arm@studio.co"
                          : "teammate@studio.co"
                      }
                      value={email}
                      onChange={(e) =>
                        handleTeammateChange(idx, e.target.value)
                      }
                      className="rounded-xl text-sm flex-1"
                    />

                    {teammates.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveTeammate(idx)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer shrink-0"
                        aria-label="Remove email"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAddTeammate}
                className="flex items-center gap-1.5 text-xs font-semibold text-foreground hover:text-primary transition-colors cursor-pointer pt-1"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add another</span>
              </button>
            </div>

            {/* Info callout */}
            <div className="flex items-start gap-3 rounded-xl border border-border/80 bg-muted/40 p-3.5 text-foreground">
              <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="text-xs font-semibold leading-snug">
                  You&apos;ll choose each person&apos;s role when you add them to a project.
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Teammates must sign in with the invited email.
                </p>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex items-center justify-end gap-3 pt-3 pb-6 px-6">
            <Button
              type="button"
              variant="ghost"
              disabled={isSubmitting}
              onClick={() => {
                if (typeof window !== "undefined" && window.history.length > 1) {
                  router.back();
                } else {
                  router.push("/create");
                }
              }}
              className="rounded-xl font-medium cursor-pointer text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Button>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl font-semibold px-5 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                "Create workspace"
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
