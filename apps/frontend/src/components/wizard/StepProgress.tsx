import * as React from "react";
import { cn } from "@/lib/utils";

interface StepProgressProps {
  currentStep: 1 | 2 | 3;
  stepLabel?: string;
  stepName?: string;
  title: string;
  description: string;
}

export function StepProgress({
  currentStep,
  stepLabel,
  stepName,
  title,
  description,
}: StepProgressProps) {
  return (
    <div className="space-y-4">
      {/* 3-segment progress bar */}
      <div className="flex items-center gap-1">
        <div
          className={cn(
            "h-1 w-24 rounded-[2px] transition-colors",
            currentStep >= 1 ? "bg-primary" : "bg-border"
          )}
        />
        <div
          className={cn(
            "h-1 w-24 rounded-[2px] transition-colors",
            currentStep >= 2 ? "bg-primary" : "bg-border"
          )}
        />
        <div
          className={cn(
            "h-1 w-24 rounded-[2px] transition-colors",
            currentStep >= 3 ? "bg-primary" : "bg-border"
          )}
        />
      </div>

      {/* Page Header text */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            {stepLabel || `STEP ${currentStep} OF 3`}
          </span>
          {stepName && (
            <span className="text-xs font-semibold tracking-[0.08em] text-foreground uppercase">
              {stepName}
            </span>
          )}
        </div>
        <h1 className="font-heading text-3xl sm:text-4xl font-medium tracking-tight text-foreground leading-10">
          {title}
        </h1>
        <p className="text-base text-muted-foreground max-w-2xl leading-6">
          {description}
        </p>
      </div>
    </div>
  );
}
