"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useWorkspace } from "@/contexts/workspace-context";
import {
  createWorkspace,
  inviteWorkspaceMember,
  uploadWorkspacePicture,
} from "@/services/workspace.service";
import { AlertCircle, Info, Loader2, Plus, X } from "lucide-react";

export default function CreateWorkspacePage() {
  const { user, isLoading } = useAuth();
  const { refreshWorkspaces, setCurrentWorkspace, setWorkspaceAvatar } = useWorkspace();
  const router = useRouter();

  // Form states
  const [workspaceName, setWorkspaceName] = useState("");
  const [nameError, setNameError] = useState("");
  const [teammates, setTeammates] = useState<string[]>([""]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Workspace picture state (Figma node 491:5260)
  const [pictureFile, setPictureFile] = useState<File | null>(null);
  const [picturePreview, setPicturePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clean up object URL when unmounting or changing picture
  useEffect(() => {
    return () => {
      if (picturePreview) {
        URL.revokeObjectURL(picturePreview);
      }
    };
  }, [picturePreview]);

  if (isLoading || !user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Picture handlers
  const handlePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (picturePreview) {
      URL.revokeObjectURL(picturePreview);
    }

    setPictureFile(file);
    setPicturePreview(URL.createObjectURL(file));
  };

  const handleRemovePicture = () => {
    if (picturePreview) {
      URL.revokeObjectURL(picturePreview);
    }
    setPictureFile(null);
    setPicturePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

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
      // 1. Create workspace in backend (caller automatically becomes ADMIN)
      const org = await createWorkspace(trimmedName);

      // 2. Upload and save workspace picture if selected
      let savedAvatarUrl: string | null = null;
      if (pictureFile) {
        try {
          // Convert file to base64 Data URL so it is immediately rendered in UI (Breadcrumb, Switcher)
          const toBase64 = (file: File): Promise<string> =>
            new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.readAsDataURL(file);
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = (error) => reject(error);
            });
          savedAvatarUrl = await toBase64(pictureFile);
          setWorkspaceAvatar(org.id, savedAvatarUrl);
        } catch (readErr) {
          console.warn("Failed to read picture locally:", readErr);
        }

        try {
          await uploadWorkspacePicture(org.id, pictureFile);
        } catch (pictureErr) {
          console.warn(
            "Workspace picture upload not yet supported by backend API:",
            pictureErr
          );
        }
      }

      // 3. Invite teammates if provided
      const validEmails = teammates
        .map((email) => email.trim())
        .filter((email) => email.length > 0);

      for (const email of validEmails) {
        try {
          await inviteWorkspaceMember(org.id, email, "MEMBER");
        } catch (inviteErr) {
          console.warn("Failed to invite teammate:", email, inviteErr);
        }
      }

      // 4. Refresh workspace context and select the newly created workspace
      await refreshWorkspaces();
      setCurrentWorkspace({
        ...org,
        avatarUrl: savedAvatarUrl || org.avatarUrl || null,
      });

      // 5. Redirect to dashboard
      router.push("/dashboard");
    } catch (err) {
      console.error("Failed to create workspace:", err);
      setNameError("Could not create workspace. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const initialLetter = workspaceName.trim().charAt(0).toUpperCase() || "K";

  return (
    <div className="w-full flex flex-col items-center justify-center py-12 sm:py-20 px-4">
      {/* 8 · Create workspace (Hi-fi) Card — Node 491:5260 */}
      <div className="w-full max-w-[560px] bg-card border border-border rounded-[14px] p-6 shadow-sm flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col gap-2 w-full">
          <h1 className="font-heading font-medium text-[24px] leading-8 text-foreground tracking-[-0.24px]">
            Create a workspace
          </h1>
          <p className="text-sm text-muted-foreground leading-5 font-normal">
            A workspace holds your team and projects.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleCreateWorkspace} noValidate className="flex flex-col gap-6 w-full">
          {/* Fields */}
          <div className="flex flex-col gap-4 w-full">
            {/* 1. Workspace name */}
            <div className="flex flex-col gap-2 w-full">
              <label
                htmlFor="workspace-name"
                className="text-sm font-medium leading-5 text-foreground cursor-pointer"
              >
                Workspace name
              </label>
              <input
                id="workspace-name"
                type="text"
                placeholder="KMUTT Library"
                value={workspaceName}
                autoFocus
                onChange={(e) => {
                  setWorkspaceName(e.target.value);
                  if (nameError) setNameError("");
                }}
                className={`h-8 w-full rounded-[10px] border ${
                  nameError ? "border-destructive ring-1 ring-destructive" : "border-border"
                } bg-background px-2.5 py-1 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors`}
              />
              {nameError && (
                <p
                  role="alert"
                  className="text-xs text-destructive flex items-center gap-1 mt-1"
                >
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{nameError}</span>
                </p>
              )}
            </div>

            {/* 2. Workspace picture (optional) */}
            <div className="flex flex-col gap-2 w-full">
              <span className="text-sm font-medium leading-5 text-foreground">
                Workspace picture (optional)
              </span>

              <div className="flex items-center gap-4 w-full">
                {/* Hidden File Input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={handlePictureChange}
                />

                {/* Picture preview (40x40 rounded 8px) */}
                <div className="size-10 rounded-[8px] shrink-0 border border-border bg-muted overflow-hidden flex items-center justify-center font-heading font-semibold text-base text-foreground select-none">
                  {picturePreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={picturePreview}
                      alt="Workspace picture preview"
                      className="size-full object-cover rounded-[8px]"
                    />
                  ) : (
                    <span>{initialLetter}</span>
                  )}
                </div>

                {/* Picture actions */}
                <div className="flex flex-1 flex-col gap-1.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-7 px-2.5 rounded-[10px] border border-border bg-background text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
                    >
                      Change picture
                    </button>
                    <button
                      type="button"
                      onClick={handleRemovePicture}
                      disabled={!picturePreview && !pictureFile}
                      className="h-7 px-2.5 rounded-[10px] bg-transparent text-xs font-medium text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                  <p className="text-sm text-muted-foreground leading-5">
                    PNG or JPG. Without one, we show the first letter of the name.
                  </p>
                </div>
              </div>
            </div>

            {/* 3. Invite teammates (optional) */}
            <div className="flex flex-col gap-2 w-full">
              <span className="text-sm font-medium leading-5 text-foreground">
                Invite teammates (optional)
              </span>

              <div className="flex flex-col gap-2 w-full">
                {teammates.map((email, idx) => (
                  <div key={idx} className="flex items-center gap-2 w-full">
                    <input
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
                      onChange={(e) => handleTeammateChange(idx, e.target.value)}
                      className="h-8 flex-1 rounded-[10px] border border-border bg-background px-2.5 py-1 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                    />

                    {teammates.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveTeammate(idx)}
                        className="size-8 rounded-[10px] flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0 cursor-pointer"
                        aria-label="Remove email"
                      >
                        <X className="size-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAddTeammate}
                className="h-7 px-2.5 rounded-[10px] flex items-center gap-1 text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer w-fit mt-0.5"
              >
                <Plus className="size-4" />
                <span>Add another</span>
              </button>
            </div>

            {/* Roles and invite note */}
            <div className="rounded-[10px] border border-border bg-card px-2.5 py-2 flex flex-col gap-0.5 w-full">
              <div className="flex items-center gap-2 text-foreground">
                <Info className="size-4 shrink-0 text-foreground" />
                <p className="text-sm font-medium leading-5 text-foreground">
                  You&apos;ll choose each person&apos;s role when you add them to a project.
                </p>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="size-4 shrink-0" aria-hidden="true" />
                <p className="text-sm font-normal leading-5 text-muted-foreground">
                  Teammates must sign in with the invited email.
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 w-full">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                if (typeof window !== "undefined" && window.history.length > 1) {
                  router.back();
                } else {
                  router.push("/dashboard");
                }
              }}
              className="h-8 px-2.5 rounded-[10px] text-sm font-medium text-foreground hover:bg-muted bg-transparent transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="h-8 px-3 rounded-[10px] text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-none cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                "Create workspace"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
