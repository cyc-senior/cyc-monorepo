"use client";

import React, { useState } from "react";
import axios from "axios";
import { X, Mail, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inviteWorkspaceMember } from "@/services/workspace.service";

export interface InviteWorkspaceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId?: string;
  workspaceName?: string;
}

export function InviteWorkspaceDialog({
  isOpen,
  onClose,
  workspaceId,
  workspaceName = "Workspace",
}: InviteWorkspaceDialogProps) {
  const [email, setEmail] = useState("");
  const [isSent, setIsSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  if (!isOpen) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !workspaceId) return;

    setErrorMessage("");
    setIsLoading(true);

    try {
      await inviteWorkspaceMember(workspaceId, trimmedEmail, "MEMBER");
      setIsSent(true);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const apiMsg = (err.response?.data as { message?: string })?.message;
        setErrorMessage(
          apiMsg ||
            "Could not invite this user. Make sure they have registered or aren't already a member."
        );
      } else {
        setErrorMessage("Failed to send invitation. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setEmail("");
    setIsSent(false);
    setErrorMessage("");
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-workspace-title"
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="fixed inset-0" aria-hidden="true" onClick={handleClose} />

      <div className="relative z-10 w-full max-w-[480px] bg-card border border-border rounded-[14px] p-6 shadow-xl drop-shadow-[0px_1px_1.5px_rgba(0,0,0,0.1)] flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between w-full">
          <div className="flex flex-col gap-1">
            <h2
              id="invite-workspace-title"
              className="font-heading text-xl font-medium leading-7 text-foreground tracking-[-0.24px]"
            >
              Invite to workspace
            </h2>
            <p className="text-sm text-muted-foreground">
              Invite a teammate or client to {workspaceName}.
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Close dialog"
            className="size-8 rounded-[10px] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {isSent ? (
          <div className="flex flex-col items-center justify-center py-6 text-center gap-3">
            <div className="size-10 rounded-full bg-primary-subtle text-primary-text flex items-center justify-center">
              <CheckCircle2 className="size-6" />
            </div>
            <p className="text-base font-semibold text-foreground">
              Member added to workspace!
            </p>
            <p className="text-sm text-muted-foreground max-w-xs">
              <span className="font-medium text-foreground">{email}</span> now has access to {workspaceName}.
            </p>
            <Button
              type="button"
              onClick={handleClose}
              className="mt-2 h-8 px-4 rounded-[10px] bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium cursor-pointer"
            >
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSend} className="flex flex-col gap-4">
            {errorMessage && (
              <div className="flex items-center gap-2 rounded-[10px] border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <AlertCircle className="size-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label
                htmlFor="invite-email"
                className="text-sm font-medium text-foreground"
              >
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <input
                  id="invite-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="h-8 pl-8 pr-2.5 rounded-[10px] border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring w-full transition-all"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                The invited user must sign in using this exact email address to access the workspace.
              </p>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={handleClose}
                className="h-8 px-2.5 rounded-[10px] text-sm font-medium text-foreground hover:bg-accent cursor-pointer"
              >
                Cancel
              </Button>

              <Button
                type="submit"
                disabled={isLoading || !email.trim() || !workspaceId}
                className="bg-primary hover:bg-primary/90 text-primary-foreground h-8 px-3 rounded-[10px] text-sm font-medium transition-colors cursor-pointer"
              >
                {isLoading ? "Sending..." : "Send invite"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
