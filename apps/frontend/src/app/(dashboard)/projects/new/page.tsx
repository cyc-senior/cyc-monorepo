"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/contexts/workspace-context";
import { createProject } from "@/services/project.service";
import { AlertCircle, Check, Loader2 } from "lucide-react";

export default function CreateProjectPage() {
  const router = useRouter();
  const { currentWorkspace, workspaces, setCurrentWorkspace, isLoading } =
    useWorkspace();

  const [name, setName] = useState("");
  const [clientOrProduct, setClientOrProduct] = useState("");
  const [description, setDescription] = useState("");

  const [errors, setErrors] = useState<{
    name?: string;
    clientOrProduct?: string;
  }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Refs for calculating max-height of description textarea to align with "What AI will use" card
  const leftCardRef = useRef<HTMLDivElement>(null);
  const rightCardRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [maxTextareaHeight, setMaxTextareaHeight] = useState<number>(108);

  useEffect(() => {
    function updateMaxHeight() {
      if (!rightCardRef.current || !leftCardRef.current || !textareaRef.current) return;
      if (window.innerWidth >= 1024) {
        const rightHeight = rightCardRef.current.offsetHeight;
        const leftCardHeight = leftCardRef.current.offsetHeight;
        const currentTextareaHeight = textareaRef.current.offsetHeight;
        const otherContentHeight = leftCardHeight - currentTextareaHeight;
        const calculatedMax = rightHeight - otherContentHeight;
        if (calculatedMax > 64) {
          setMaxTextareaHeight(calculatedMax);
        }
      } else {
        setMaxTextareaHeight(320);
      }
    }

    updateMaxHeight();
    const rafId = requestAnimationFrame(updateMaxHeight);
    window.addEventListener("resize", updateMaxHeight);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", updateMaxHeight);
    };
  }, [errors]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    const trimmedClient = clientOrProduct.trim();

    const newErrors: { name?: string; clientOrProduct?: string } = {};
    if (!trimmedName) {
      newErrors.name = "Please enter a project name.";
    }
    if (!trimmedClient) {
      newErrors.clientOrProduct = "Please enter a client or product name.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setSubmitError("");
    setIsSubmitting(true);

    try {
      if (!currentWorkspace?.id) {
        throw new Error("No active workspace selected.");
      }

      const created = await createProject(currentWorkspace.id, {
        name: trimmedName,
        clientOrProduct: trimmedClient,
        description: description.trim() || undefined,
        platforms: ["DESKTOP", "MOBILE"],
      });

      // Proceed to Step 2: Design intent
      router.push(`/projects/${created.id}/setup/intent`);
    } catch (err: unknown) {
      console.error("Failed to create project:", err);
      setSubmitError(
        err instanceof Error ? err.message : "Failed to create project. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 w-full bg-background min-h-[calc(100vh-4rem)]">

      {/* Main Content Area (Figma Node 491:5322 - 11 · Create project (Hi-fi)) */}
      <main className="flex-1 w-full">
        <div className="w-full max-w-[1360px] mx-auto px-6 sm:px-10 lg:px-20 py-8 sm:py-10 flex flex-col gap-8">
          {/* 1. Step Progress Bar (3 segments of 96px, 4px height) */}
          <div className="flex gap-1 items-start" aria-label="Step 1 of 3">
            <div className="bg-primary h-1 w-24 rounded-xs shrink-0" />
            <div className="bg-border h-1 w-24 rounded-xs shrink-0" />
            <div className="bg-border h-1 w-24 rounded-xs shrink-0" />
          </div>

          {/* 2. Page Head */}
          <div className="flex flex-col gap-2 items-start w-full">
            <p className="font-semibold text-xs tracking-[0.96px] uppercase text-muted-foreground">
              STEP 1 OF 3 · PROJECT
            </p>
            <h1 className="font-heading font-medium text-[36px] leading-[40px] tracking-[-0.72px] text-foreground">
              New project
            </h1>
            <p className="font-sans text-base leading-6 text-muted-foreground font-normal">
              Start with the basics. You can change them later.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-8 w-full">
            {submitError && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive flex items-center gap-2">
                <AlertCircle className="size-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {/* 3. Columns: Left Column (Form) + Right Column (AI input checklist) */}
            <div className="flex flex-col lg:flex-row gap-8 items-start w-full">
              {/* Left Column: Form Fields (w-[848px] / flex-1) */}
              <div className="flex-1 w-full max-w-[848px]">
                <div
                  ref={leftCardRef}
                  className="bg-card border border-border rounded-[14px] p-6 shadow-sm flex flex-col gap-4 w-full"
                >
                  <h2 className="font-heading font-medium text-[20px] leading-7 text-foreground">
                    Project details
                  </h2>

                  {/* Field 1: Project name */}
                  <div className="flex flex-col gap-2 w-full">
                    <label
                      htmlFor="project-name"
                      className="text-sm font-medium leading-5 text-foreground cursor-pointer"
                    >
                      Project name
                    </label>
                    <input
                      id="project-name"
                      type="text"
                      placeholder="KMUTT Library room booking"
                      value={name}
                      autoFocus
                      onChange={(e) => {
                        setName(e.target.value);
                        if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                      }}
                      className={`h-8 w-full rounded-[10px] border ${
                        errors.name ? "border-destructive ring-1 ring-destructive" : "border-border"
                      } bg-background px-2.5 py-1 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors`}
                    />
                    {errors.name && (
                      <p role="alert" className="text-xs text-destructive flex items-center gap-1 mt-0.5">
                        <AlertCircle className="size-3.5 shrink-0" />
                        <span>{errors.name}</span>
                      </p>
                    )}
                  </div>

                  {/* Field 2: Client or product */}
                  <div className="flex flex-col gap-2 w-full">
                    <label
                      htmlFor="client-or-product"
                      className="text-sm font-medium leading-5 text-foreground cursor-pointer"
                    >
                      Client or product
                    </label>
                    <input
                      id="client-or-product"
                      type="text"
                      placeholder="KMUTT Library"
                      value={clientOrProduct}
                      onChange={(e) => {
                        setClientOrProduct(e.target.value);
                        if (errors.clientOrProduct) {
                          setErrors((prev) => ({ ...prev, clientOrProduct: undefined }));
                        }
                      }}
                      className={`h-8 w-full rounded-[10px] border ${
                        errors.clientOrProduct
                          ? "border-destructive ring-1 ring-destructive"
                          : "border-border"
                      } bg-background px-2.5 py-1 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors`}
                    />
                    {errors.clientOrProduct && (
                      <p role="alert" className="text-xs text-destructive flex items-center gap-1 mt-0.5">
                        <AlertCircle className="size-3.5 shrink-0" />
                        <span>{errors.clientOrProduct}</span>
                      </p>
                    )}
                  </div>

                  {/* Field 3: Description */}
                  <div className="flex flex-col gap-2 w-full">
                    <label
                      htmlFor="project-description"
                      className="text-sm font-medium leading-5 text-foreground cursor-pointer"
                    >
                      Description
                    </label>
                    <textarea
                      ref={textareaRef}
                      id="project-description"
                      placeholder="Help students book a group study room on the library website without checking every room."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      style={{ maxHeight: `${maxTextareaHeight}px` }}
                      className="h-16 min-h-[64px] w-full rounded-[10px] border border-border bg-background px-2.5 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors resize-y"
                    />
                  </div>
                </div>
              </div>

              {/* Right Column: AI Checklist Card (w-[400px]) */}
              <div className="w-full lg:w-[400px] shrink-0">
                <div
                  ref={rightCardRef}
                  className="bg-card border border-border rounded-[14px] p-6 shadow-sm flex flex-col gap-4 w-full"
                >
                  <h2 className="font-heading font-medium text-[20px] leading-7 text-foreground">
                    What AI will use
                  </h2>

                  <div className="flex flex-col w-full">
                    {/* Item 1: Project description (Ticked) */}
                    <div className="flex items-center gap-2.5 py-2 w-full">
                      <div className="size-5 shrink-0 flex items-center justify-center text-primary">
                        <Check className="size-4 text-primary" strokeWidth={2.5} />
                      </div>
                      <span className="text-sm font-medium text-foreground">
                        Project description
                      </span>
                    </div>

                    {/* Item 2: Personas */}
                    <div className="flex items-center gap-2.5 py-2 w-full">
                      <div className="size-5 shrink-0 flex items-center justify-center">
                        <div className="size-3.5 rounded-full border border-muted-foreground/60" />
                      </div>
                      <span className="text-sm font-medium text-muted-foreground">
                        Personas
                      </span>
                    </div>

                    {/* Item 3: Design system */}
                    <div className="flex items-center gap-2.5 py-2 w-full">
                      <div className="size-5 shrink-0 flex items-center justify-center">
                        <div className="size-3.5 rounded-full border border-muted-foreground/60" />
                      </div>
                      <span className="text-sm font-medium text-muted-foreground">
                        Design system
                      </span>
                    </div>

                    {/* Item 4: Accessibility standard */}
                    <div className="flex items-center gap-2.5 py-2 w-full">
                      <div className="size-5 shrink-0 flex items-center justify-center">
                        <div className="size-3.5 rounded-full border border-muted-foreground/60" />
                      </div>
                      <span className="text-sm font-medium text-muted-foreground">
                        Accessibility standard
                      </span>
                    </div>

                    {/* Item 5: Brand colours */}
                    <div className="flex items-center gap-2.5 py-2 w-full">
                      <div className="size-5 shrink-0 flex items-center justify-center">
                        <div className="size-3.5 rounded-full border border-muted-foreground/60" />
                      </div>
                      <span className="text-sm font-medium text-muted-foreground">
                        Brand colours
                      </span>
                    </div>

                    {/* Item 6: CI guideline */}
                    <div className="flex items-center gap-2.5 py-2 w-full">
                      <div className="size-5 shrink-0 flex items-center justify-center">
                        <div className="size-3.5 rounded-full border border-muted-foreground/60" />
                      </div>
                      <span className="text-sm font-medium text-muted-foreground">
                        CI guideline
                      </span>
                    </div>

                    {/* Item 7: Tone of voice */}
                    <div className="flex items-center gap-2.5 py-2 w-full">
                      <div className="size-5 shrink-0 flex items-center justify-center">
                        <div className="size-3.5 rounded-full border border-muted-foreground/60" />
                      </div>
                      <span className="text-sm font-medium text-muted-foreground">
                        Tone of voice
                      </span>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground leading-5">
                    You add the rest in the next step.
                  </p>
                </div>
              </div>
            </div>

            {/* 4. Footer Actions */}
            <div className="flex items-center justify-between w-full pt-2">
              <button
                type="button"
                onClick={() => router.back()}
                className="h-8 px-2.5 rounded-[10px] text-sm font-medium text-foreground hover:bg-muted bg-transparent transition-colors cursor-pointer"
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
                    <span>Saving...</span>
                  </>
                ) : (
                  "Next: design intent"
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
