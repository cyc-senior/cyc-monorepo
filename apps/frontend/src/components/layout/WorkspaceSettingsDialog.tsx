"use client";

import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { HugeIcon } from "@/components/ui/huge-icon";
import {
  Add01Icon,
  Cancel01Icon,
  InformationCircleIcon,
  AlertCircleIcon,
  CheckmarkCircle02Icon,
  Loading03Icon,
} from "@hugeicons/core-free-icons";
import { Workspace } from "@/types/workspace";
import {
  updateWorkspace,
  uploadWorkspacePicture,
  inviteWorkspaceMember,
} from "@/services/workspace.service";
import { useWorkspace } from "@/contexts/workspace-context";
import axios from "axios";

/** The API's reason an invitation failed, for showing next to its email. */
function inviteErrorMessage(reason: unknown): string {
  if (axios.isAxiosError<{ message?: string | string[] }>(reason)) {
    const message = reason.response?.data?.message;
    const text = Array.isArray(message) ? message[0] : message;
    if (text) return text;
  }
  return reason instanceof Error ? reason.message : "unknown error";
}

export interface WorkspaceSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace: Workspace | null;
}

interface WorkspaceSettingsContentProps {
  workspace: Workspace;
  onOpenChange: (open: boolean) => void;
}

function WorkspaceSettingsContent({
  workspace,
  onOpenChange,
}: WorkspaceSettingsContentProps) {
  const { refreshWorkspaces, setWorkspaceAvatar } = useWorkspace();

  const [name, setName] = useState(workspace.name || "");
  const [nameError, setNameError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Picture upload state
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    workspace.avatarUrl || null
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Teammate invite emails list
  const [inviteEmails, setInviteEmails] = useState<string[]>([""]);

  const initials = name.trim()
    ? name
        .trim()
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
    : "WS";

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    const url = URL.createObjectURL(file);
    setAvatarPreview(url);
  };

  const handleRemovePhoto = () => {
    setAvatarFile(null);
    setAvatarPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleEmailChange = (index: number, val: string) => {
    setInviteEmails((prev) => {
      const copy = [...prev];
      copy[index] = val;
      return copy;
    });
  };

  const handleAddEmail = () => {
    setInviteEmails((prev) => [...prev, ""]);
  };

  const handleRemoveEmail = (index: number) => {
    setInviteEmails((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setNameError("Workspace name is required.");
      return;
    }

    setNameError(null);
    setServerError(null);
    setIsSubmitting(true);

    try {
      // 1. Update name if changed
      if (name.trim() !== workspace.name) {
        await updateWorkspace(workspace.id, name.trim());
      }

      // 2. Upload avatar if new file selected
      if (avatarFile) {
        await uploadWorkspacePicture(workspace.id, avatarFile);
        // Uploaded: a retry after a failed invitation must not upload again.
        setAvatarFile(null);
        if (avatarPreview) {
          setWorkspaceAvatar(workspace.id, avatarPreview);
        }
      }

      // 3. Send invitations for non-empty emails
      const validEmails = inviteEmails
        .map((em) => em.trim())
        .filter((em) => Boolean(em));

      const results = await Promise.allSettled(
        validEmails.map((em) =>
          inviteWorkspaceMember(workspace.id, em, "MEMBER")
        )
      );
      const failed = validEmails
        .map((email, i) => ({ email, result: results[i] }))
        .filter(
          (r): r is { email: string; result: PromiseRejectedResult } =>
            r.result.status === "rejected"
        );

      await refreshWorkspaces();

      if (failed.length > 0) {
        // Keep the dialog open with only the emails that still need inviting.
        setInviteEmails(failed.map((f) => f.email));
        setServerError(
          `Saved, but ${failed.length === 1 ? "this invitation" : "these invitations"} failed: ${failed
            .map((f) => `${f.email} (${inviteErrorMessage(f.result.reason)})`)
            .join(", ")}.`
        );
        return;
      }

      setIsSuccess(true);
      setTimeout(() => {
        onOpenChange(false);
      }, 800);
    } catch (err: unknown) {
      setServerError(
        err instanceof Error
          ? err.message
          : "Failed to update workspace settings. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="workspace-settings-title"
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div
        className="fixed inset-0"
        aria-hidden="true"
        onClick={() => onOpenChange(false)}
      />

      <div className="relative z-10 w-full max-w-[560px] bg-card border border-border rounded-[14px] p-6 sm:p-8 shadow-xl flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between w-full">
          <div className="flex flex-col gap-1">
            <h2
              id="workspace-settings-title"
              className="font-heading text-xl font-medium leading-7 text-foreground tracking-[-0.24px]"
            >
              Workspace settings
            </h2>
            <p className="text-sm text-muted-foreground">
              Update workspace details, icon, and invite teammates.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close dialog"
            className="size-8 rounded-[10px] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
          >
            <HugeIcon icon={Cancel01Icon} size={16} />
          </button>
        </div>

        {serverError && (
          <Alert variant="destructive">
            <HugeIcon icon={AlertCircleIcon} size={16} />
            <AlertDescription className="text-xs">{serverError}</AlertDescription>
          </Alert>
        )}

        {isSuccess ? (
          <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
            <div className="size-12 rounded-full bg-primary-subtle text-primary-text flex items-center justify-center">
              <HugeIcon icon={CheckmarkCircle02Icon} size={28} />
            </div>
            <p className="text-base font-semibold text-foreground">
              Settings saved!
            </p>
            <p className="text-sm text-muted-foreground">
              Your workspace changes have been updated.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSave} className="flex flex-col gap-6" noValidate>
            {/* Field 1: Workspace name */}
            <div className="space-y-2">
              <Label htmlFor="ws-name" className="text-sm font-medium">
                Workspace name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="ws-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (nameError) setNameError(null);
                }}
                placeholder="e.g. Acme Studio"
                className={`h-9 text-sm rounded-[10px] ${
                  nameError ? "border-destructive focus-visible:ring-destructive" : ""
                }`}
              />
              {nameError && (
                <p className="text-xs text-destructive">{nameError}</p>
              )}
            </div>

            {/* Field 2: Workspace picture (icon) */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">
                Workspace picture (optional)
              </Label>

              <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14 rounded-[14px] border border-border shadow-xs">
                  {avatarPreview ? (
                    <AvatarImage
                      src={avatarPreview}
                      alt={name}
                      className="object-cover"
                    />
                  ) : null}
                  <AvatarFallback className="bg-primary-subtle text-primary-text font-bold text-lg rounded-[14px]">
                    {initials}
                  </AvatarFallback>
                </Avatar>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png, image/jpeg"
                      onChange={handlePhotoSelect}
                      className="hidden"
                      id="ws-photo-upload"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-8 text-xs rounded-[8px] cursor-pointer"
                    >
                      Upload photo
                    </Button>
                    {avatarPreview && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleRemovePhoto}
                        className="h-8 text-xs text-muted-foreground hover:text-destructive cursor-pointer"
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    PNG or JPG. Without one, we show the first letter of the name.
                  </p>
                </div>
              </div>
            </div>

            {/* Field 3: Invite teammates (optional) */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">
                Invite teammates (optional)
              </Label>

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
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="h-8 px-3 rounded-[10px] text-sm font-medium cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-8 px-4 rounded-[10px] bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold cursor-pointer gap-2"
              >
                {isSubmitting ? (
                  <>
                    <HugeIcon icon={Loading03Icon} size={14} className="animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save changes</span>
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export function WorkspaceSettingsDialog({
  open,
  onOpenChange,
  workspace,
}: WorkspaceSettingsDialogProps) {
  if (!open || !workspace) return null;

  return (
    <WorkspaceSettingsContent
      key={workspace.id}
      workspace={workspace}
      onOpenChange={onOpenChange}
    />
  );
}
