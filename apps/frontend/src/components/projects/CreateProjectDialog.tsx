"use client";

import React, { useState } from "react";
import { X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface CreateProjectFormData {
  name: string;
  clientOrProduct: string;
  description: string;
  platforms: {
    desktop: boolean;
    mobile: boolean;
    tablet: boolean;
  };
}

export interface CreateProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (data: CreateProjectFormData) => void;
}

export function CreateProjectDialog({
  isOpen,
  onClose,
  onSubmit,
}: CreateProjectDialogProps) {
  // Form fields initialized with Figma Hi-Fi values
  const [formData, setFormData] = useState<CreateProjectFormData>({
    name: "KMUTT Library room booking",
    clientOrProduct: "KMUTT Library",
    description:
      "Help students book a group study room on the library website without checking every room.",
    platforms: {
      desktop: true,
      mobile: true,
      tablet: false,
    },
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSubmit) {
      onSubmit(formData);
    }
    // Proceed to Step 2 (Design intent)
    console.info("Proceeding to Design intent with:", formData);
  };

  const togglePlatform = (key: keyof CreateProjectFormData["platforms"]) => {
    setFormData((prev) => ({
      ...prev,
      platforms: {
        ...prev.platforms,
        [key]: !prev.platforms[key],
      },
    }));
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-project-title"
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      {/* Click outside backdrop to close */}
      <div
        className="fixed inset-0"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Modal Dialog Card */}
      <div className="relative z-10 w-full max-w-[640px] bg-card border border-border rounded-[14px] p-6 shadow-xl drop-shadow-[0px_1px_1.5px_rgba(0,0,0,0.1)] flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-150">
        {/* Header: Title + Close Button */}
        <div className="flex items-center justify-between w-full">
          <h2
            id="create-project-title"
            className="font-heading text-2xl font-medium leading-8 text-foreground tracking-[-0.24px]"
          >
            New project
          </h2>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="size-8 rounded-[10px] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* 3-Step Stepper Header */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1" aria-label="Creation Steps">
          {/* Step 1 · Project (Current) */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="size-6 rounded-full bg-primary-subtle border border-primary flex items-center justify-center text-xs text-primary-text font-normal">
              1
            </div>
            <span className="text-sm font-medium text-foreground">Project</span>
            <div className="h-px w-8 bg-border shrink-0 ml-1" />
          </div>

          {/* Step 2 · Design intent */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="size-6 rounded-full border border-border flex items-center justify-center text-xs text-muted-foreground font-normal">
              2
            </div>
            <span className="text-sm font-normal text-muted-foreground">
              Design intent
            </span>
            <div className="h-px w-8 bg-border shrink-0 ml-1" />
          </div>

          {/* Step 3 · Team & roles */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="size-6 rounded-full border border-border flex items-center justify-center text-xs text-muted-foreground font-normal">
              3
            </div>
            <span className="text-sm font-normal text-muted-foreground">
              Team & roles
            </span>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Field 1: Project name */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="project-name"
              className="text-sm font-medium text-foreground"
            >
              Project name
            </label>
            <input
              id="project-name"
              type="text"
              required
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="e.g. KMUTT Library room booking"
              className="h-8 px-2.5 rounded-[10px] border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring w-full transition-all"
            />
          </div>

          {/* Field 2: Client or product */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="client-product"
              className="text-sm font-medium text-foreground"
            >
              Client or product
            </label>
            <input
              id="client-product"
              type="text"
              required
              value={formData.clientOrProduct}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  clientOrProduct: e.target.value,
                }))
              }
              placeholder="e.g. KMUTT Library"
              className="h-8 px-2.5 rounded-[10px] border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring w-full transition-all"
            />
          </div>

          {/* Field 3: Description */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="project-description"
              className="text-sm font-medium text-foreground"
            >
              Description
            </label>
            <textarea
              id="project-description"
              rows={3}
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              placeholder="Help students book a group study room..."
              className="min-h-[64px] h-16 px-2.5 py-2 rounded-[10px] border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring w-full leading-5 transition-all"
            />
          </div>

          {/* Field 4: Platforms to test */}
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-foreground">
              Platforms to test
            </span>
            <div className="flex items-center gap-4 pt-0.5">
              {/* Desktop */}
              <label
                onClick={() => togglePlatform("desktop")}
                className="flex items-center gap-2 cursor-pointer select-none"
              >
                <div
                  className={`size-4 rounded-[4px] border flex items-center justify-center transition-colors ${
                    formData.platforms.desktop
                      ? "bg-primary-subtle border-primary text-primary-text"
                      : "bg-background border-border"
                  }`}
                >
                  {formData.platforms.desktop && <Check className="size-3 stroke-[2.5]" />}
                </div>
                <span className="text-sm font-medium text-foreground">Desktop</span>
              </label>

              {/* Mobile */}
              <label
                onClick={() => togglePlatform("mobile")}
                className="flex items-center gap-2 cursor-pointer select-none"
              >
                <div
                  className={`size-4 rounded-[4px] border flex items-center justify-center transition-colors ${
                    formData.platforms.mobile
                      ? "bg-primary-subtle border-primary text-primary-text"
                      : "bg-background border-border"
                  }`}
                >
                  {formData.platforms.mobile && <Check className="size-3 stroke-[2.5]" />}
                </div>
                <span className="text-sm font-medium text-foreground">Mobile</span>
              </label>

              {/* Tablet */}
              <label
                onClick={() => togglePlatform("tablet")}
                className="flex items-center gap-2 cursor-pointer select-none"
              >
                <div
                  className={`size-4 rounded-[4px] border flex items-center justify-center transition-colors ${
                    formData.platforms.tablet
                      ? "bg-primary-subtle border-primary text-primary-text"
                      : "bg-background border-border"
                  }`}
                >
                  {formData.platforms.tablet && <Check className="size-3 stroke-[2.5]" />}
                </div>
                <span className="text-sm font-medium text-foreground">Tablet</span>
              </label>
            </div>
          </div>

          {/* Dialog Action Buttons */}
          <div className="flex items-center justify-between pt-3 w-full">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="h-8 px-2.5 rounded-[10px] text-sm font-medium text-foreground hover:bg-accent cursor-pointer"
            >
              Cancel
            </Button>

            <Button
              type="submit"
              className="bg-primary hover:bg-primary/90 text-primary-foreground h-8 px-2.5 rounded-[10px] text-sm font-medium transition-colors cursor-pointer"
            >
              Next: design intent
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
