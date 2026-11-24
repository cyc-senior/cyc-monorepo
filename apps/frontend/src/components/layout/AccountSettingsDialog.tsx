"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import axios from "axios";
import { useAuth } from "@/contexts/auth-context";
import {
  PROFILE_PHOTO_MAX_BYTES,
  PROFILE_PHOTO_TYPES,
  updateMe,
  uploadMyPicture,
} from "@/services/user.service";

interface AccountSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function AccountSettingsContent({
  onOpenChange,
}: {
  onOpenChange: (open: boolean) => void;
}) {
  const { user, refreshUser } = useAuth();
  const [name, setName] = React.useState(user?.name || "");
  const [avatarPreview, setAvatarPreview] = React.useState<string | null>(
    user?.image || null
  );
  /** A newly chosen photo, uploaded on save. */
  const [photoFile, setPhotoFile] = React.useState<File | null>(null);
  /** The current photo was removed (applied on save). */
  const [photoRemoved, setPhotoRemoved] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Release the preview's object URL when it is replaced or the dialog closes.
  React.useEffect(() => {
    if (!avatarPreview?.startsWith("blob:")) return;
    return () => URL.revokeObjectURL(avatarPreview);
  }, [avatarPreview]);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!PROFILE_PHOTO_TYPES.includes(file.type)) {
      setError("Choose a PNG or JPG image.");
      return;
    }
    if (file.size > PROFILE_PHOTO_MAX_BYTES) {
      setError("The photo must be 1 MB or smaller.");
      return;
    }
    setError(null);
    setPhotoFile(file);
    setPhotoRemoved(false);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleRemovePhoto = () => {
    setAvatarPreview(null);
    setPhotoFile(null);
    setPhotoRemoved(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const trimmedName = name.trim();
  const nameChanged = trimmedName !== (user?.name ?? "");

  const handleSave = async () => {
    if (nameChanged && !trimmedName) {
      setError("Enter your name.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      if (nameChanged) {
        await updateMe({ name: trimmedName });
      }
      if (photoFile) {
        await uploadMyPicture(photoFile);
      } else if (photoRemoved && user?.image) {
        await updateMe({ image: null });
      }
      await refreshUser();
      onOpenChange(false);
    } catch (err: unknown) {
      const message = axios.isAxiosError<{ message?: string | string[] }>(err)
        ? err.response?.data?.message
        : undefined;
      setError(
        (Array.isArray(message) ? message[0] : message) ||
          "Couldn't save your profile. Try again."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const initials = (name || user?.email || "U")
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <DialogContent className="max-w-[520px]">
      <DialogHeader>
        <DialogTitle className="text-xl font-semibold">Account settings</DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">
          Manage your profile and how you sign in.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-6 py-2">
        {/* Profile photo */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Profile photo</Label>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 rounded-full border">
              {avatarPreview ? (
                <AvatarImage src={avatarPreview} alt={name || "User"} />
              ) : null}
              <AvatarFallback className="bg-muted text-lg font-semibold text-foreground">
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
                >
                  Change photo
                </Button>
                {avatarPreview ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={handleRemovePhoto}
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                JPG or PNG, up to 1 MB
              </p>
            </div>
          </div>
        </div>

        {/* Full name */}
        <div className="space-y-2">
          <Label htmlFor="account-full-name" className="text-sm font-medium">
            Full name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="account-full-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Pannawit Wantae"
          />
        </div>

        {/* Sign-in methods */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Sign-in methods</Label>
          <div className="rounded-lg border p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.17 0 9.97 0 12s.45 3.83 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <div>
                <p className="text-sm font-medium">Google</p>
                <p className="text-xs text-muted-foreground">
                  {user?.email || "No email connected"}
                </p>
              </div>
            </div>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              Connected
            </span>
          </div>
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <DialogFooter className="gap-2 sm:gap-0">
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
        <Button type="button" onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save changes"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export function AccountSettingsDialog({
  open,
  onOpenChange,
}: AccountSettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && <AccountSettingsContent onOpenChange={onOpenChange} />}
    </Dialog>
  );
}
