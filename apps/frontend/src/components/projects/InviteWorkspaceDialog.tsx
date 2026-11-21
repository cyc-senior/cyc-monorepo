"use client";

import React, { useState } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HugeIcon } from "@/components/ui/huge-icon";
import {
  UserAdd01Icon,
  Cancel01Icon,
  Add01Icon,
  InformationCircleIcon,
  AlertCircleIcon,
  CheckmarkCircle02Icon,
  Loading03Icon,
} from "@hugeicons/core-free-icons";
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
  const [inviteEmails, setInviteEmails] = useState<string[]>([""]);
  const [isSent, setIsSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [sentCount, setSentCount] = useState(0);

  if (!isOpen) return null;

  const handleEmailChange = (index: number, val: string) => {
    setInviteEmails((prev) => {
      const copy = [...prev];
      copy[index] = val;
      return copy;
    });
    if (errorMessage) setErrorMessage("");
  };

  const handleAddEmail = () => {
    setInviteEmails((prev) => [...prev, ""]);
  };

  const handleRemoveEmail = (index: number) => {
    setInviteEmails((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const validEmails = inviteEmails
      .map((e) => e.trim())
      .filter((e) => Boolean(e));

    if (validEmails.length === 0) {
      setErrorMessage("Please enter at least one email address.");
      return;
    }

    if (!workspaceId) {
      setErrorMessage("No active workspace selected.");
      return;
    }

    setErrorMessage("");
    setIsLoading(true);

    try {
      const results = await Promise.allSettled(
        validEmails.map((email) =>
          inviteWorkspaceMember(workspaceId, email, "MEMBER")
        )
      );

      const successful = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected");

      if (successful > 0) {
        setSentCount(successful);
        setIsSent(true);
      } else if (failed.length > 0) {
        const firstErr = (failed[0] as PromiseRejectedResult).reason;
        if (axios.isAxiosError(firstErr)) {
          const apiMsg = (firstErr.response?.data as { message?: string })
            ?.message;
          setErrorMessage(
            apiMsg ||
              "Could not invite these users. Make sure they have registered or aren't already members."
          );
        } else {
          setErrorMessage("Failed to send invitations. Please try again.");
        }
      }
    } catch {
      setErrorMessage("Failed to send invitations. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setInviteEmails([""]);
    setIsSent(false);
    setErrorMessage("");
    setSentCount(0);
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

      <div className="relative z-10 w-full max-w-[500px] bg-card border border-border rounded-[14px] p-6 shadow-xl flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-150">
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
              Invite teammates to {workspaceName}.
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Close dialog"
            className="size-8 rounded-[10px] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
          >
            <HugeIcon icon={Cancel01Icon} size={16} />
          </button>
        </div>

        {isSent ? (
          <div className="flex flex-col items-center justify-center py-6 text-center gap-3">
            <div className="size-12 rounded-full bg-primary-subtle text-primary-text flex items-center justify-center">
              <HugeIcon icon={CheckmarkCircle02Icon} size={28} />
            </div>
            <p className="text-base font-semibold text-foreground">
              {sentCount === 1
                ? "Invitation sent!"
                : `Invitations sent to ${sentCount} teammates!`}
            </p>
            <p className="text-sm text-muted-foreground max-w-xs">
              They can now view and collaborate in {workspaceName}.
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
          <form onSubmit={handleSend} className="flex flex-col gap-5">
            {errorMessage && (
              <div className="flex items-center gap-2 rounded-[10px] border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <HugeIcon icon={AlertCircleIcon} size={16} className="shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Email input rows */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Teammate email addresses</Label>
              <div className="space-y-2">
                {inviteEmails.map((email, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      type="email"
                      placeholder="e.g. teammate@company.com"
                      value={email}
                      onChange={(e) => handleEmailChange(idx, e.target.value)}
                      className="h-8 text-sm rounded-[10px]"
                    />
                    {inviteEmails.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveEmail(idx)}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0 cursor-pointer"
                      >
                        <HugeIcon icon={Cancel01Icon} size={16} />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddEmail}
                className="gap-1.5 text-xs h-7 rounded-[8px] cursor-pointer"
              >
                <HugeIcon icon={Add01Icon} size={14} />
                <span>Add another</span>
              </Button>
            </div>

            {/* Note banner */}
            <div className="rounded-[10px] border border-border bg-muted/40 p-3 flex items-start gap-2.5 text-xs text-muted-foreground">
              <HugeIcon
                icon={InformationCircleIcon}
                size={16}
                className="shrink-0 text-muted-foreground mt-0.5"
              />
              <p className="leading-relaxed">
                Invited teammates can view and edit projects in this workspace.
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="h-8 px-3 rounded-[10px] text-sm font-medium cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="h-8 px-3 rounded-[10px] bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium cursor-pointer gap-2"
              >
                {isLoading ? (
                  <>
                    <HugeIcon icon={Loading03Icon} size={14} className="animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <HugeIcon icon={UserAdd01Icon} size={16} />
                    <span>Send invites</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
