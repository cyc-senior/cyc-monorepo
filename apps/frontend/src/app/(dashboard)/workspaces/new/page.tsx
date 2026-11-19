"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useWorkspace } from "@/contexts/workspace-context";
import {
  createWorkspace,
  uploadWorkspacePicture,
  inviteWorkspaceMember,
} from "@/services/workspace.service";
import { HugeIcon } from "@/components/ui/huge-icon";
import {
  Add01Icon,
  Cancel01Icon,
  InformationCircleIcon,
  AlertCircleIcon,
} from "@hugeicons/core-free-icons";
import { Loader2 } from "lucide-react";

export const instant = false;

export default function CreateWorkspaceScreen8Page() {
  const router = useRouter();
  const { refreshWorkspaces, setCurrentWorkspace } = useWorkspace();

  const [name, setName] = React.useState("");
  const [nameError, setNameError] = React.useState<string | null>(null);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Picture upload state
  const [avatarFile, setAvatarFile] = React.useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Teammate invite emails list
  const [inviteEmails, setInviteEmails] = React.useState<string[]>([""]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setNameError("Workspace name is required.");
      return;
    }

    setNameError(null);
    setServerError(null);
    setIsSubmitting(true);

    try {
      // 1. Create the workspace
      const created = await createWorkspace(name.trim());

      // 2. Upload avatar if selected
      if (avatarFile) {
        try {
          await uploadWorkspacePicture(created.id, avatarFile);
        } catch (uploadErr) {
          console.warn("Avatar upload failed, continuing:", uploadErr);
        }
      }

      // 3. Send optional teammate invites
      const validEmails = inviteEmails
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.length > 0 && e.includes("@"));

      for (const email of validEmails) {
        try {
          await inviteWorkspaceMember(created.id, email, "MEMBER");
        } catch (inviteErr) {
          console.warn(`Failed to invite ${email}:`, inviteErr);
        }
      }

      // 4. Refresh workspace list and navigate to Screen 10 Projects
      const updatedList = await refreshWorkspaces();
      const current = updatedList.find((w) => w.id === created.id) || created;
      setCurrentWorkspace(current);

      router.push("/projects");
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to create workspace. Please try again.";
      setServerError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-6 py-12 flex flex-col justify-center min-h-[calc(100vh-4rem)]">
      <div className="rounded-[14px] border border-border bg-card text-card-foreground p-6 shadow-xs">
        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          {/* Header (Node 814:9817) */}
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground font-heading">
              Create a workspace
            </h1>
            <p className="text-sm text-muted-foreground">
              A workspace holds your team and projects.
            </p>
          </div>

          {serverError && (
            <Alert variant="destructive">
              <HugeIcon icon={AlertCircleIcon} size={16} />
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}

          {/* Field 1: Workspace name */}
          <div className="space-y-1.5">
            <Label htmlFor="workspace-name" className="text-sm font-medium">
              Workspace name
            </Label>
            <Input
              id="workspace-name"
              placeholder="e.g. KMUTT Library"
              value={name}
              error={!!nameError}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError(null);
              }}
              className="h-10 text-sm"
            />
            {nameError && (
              <p className="text-xs text-destructive">{nameError}</p>
            )}
          </div>

          {/* Field 2: Workspace picture (optional) */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Workspace picture (optional)
            </Label>
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 rounded-xl border bg-muted text-base font-bold text-foreground">
                {avatarPreview ? (
                  <AvatarImage src={avatarPreview} alt={name || "Workspace"} className="rounded-xl object-cover" />
                ) : null}
                <AvatarFallback className="rounded-xl bg-primary/10 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png, image/jpeg"
                    className="hidden"
                    onChange={handlePhotoSelect}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-8 text-xs"
                  >
                    Change picture
                  </Button>
                  {avatarPreview ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemovePhoto}
                      className="h-8 text-xs text-muted-foreground hover:text-destructive"
                    >
                      Remove
                    </Button>
                  ) : null}
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
                    className="h-9 text-sm"
                  />
                  {inviteEmails.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveEmail(idx)}
                      className="h-9 w-9 text-muted-foreground hover:text-destructive shrink-0"
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
              className="gap-1.5 text-xs h-8"
            >
              <HugeIcon icon={Add01Icon} size={14} />
              <span>Add another</span>
            </Button>

            {/* Note banner */}
            <div className="rounded-xl border bg-muted/40 p-3.5 flex items-start gap-2.5 text-xs text-muted-foreground">
              <HugeIcon
                icon={InformationCircleIcon}
                size={18}
                className="shrink-0 text-muted-foreground mt-0.5"
              />
              <div className="space-y-0.5 leading-relaxed">
                <p className="font-medium text-foreground">
                  You&apos;ll choose each person&apos;s role when you add them to a project.
                </p>
                <p>Teammates must sign in with the invited email.</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <span>Create workspace</span>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
