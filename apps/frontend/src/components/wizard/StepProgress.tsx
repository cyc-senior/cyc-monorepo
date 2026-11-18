import * as React from "react";
import { cn } from "@/lib/utils";

interface StepProgressProps {
  currentStep: 1 | 2 | 3;
  stepLabel: string;
  title: string;
  description: string;
}

export function StepProgress({
  currentStep,
  stepLabel,
  title,
  description,
}: StepProgressProps) {
  return (
    <div className="space-y-4">
      {/* 3-segment progress bar */}
      <div className="flex items-center gap-2 max-w-xs">
        <div
          className={cn(
            "h-1.5 flex-1 rounded-full transition-colors",
            currentStep >= 1 ? "bg-primary" : "bg-muted"
          )}
        />
        <div
          className={cn(
            "h-1.5 flex-1 rounded-full transition-colors",
            currentStep >= 2 ? "bg-primary" : "bg-muted"
          )}
        />
        <div
          className={cn(
            "h-1.5 flex-1 rounded-full transition-colors",
            currentStep >= 3 ? "bg-primary" : "bg-muted"
          )}
        />
      </div>

      {/* Page Header text */}
      <div className="space-y-1">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {stepLabel}
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          {description}
        </p>
      </div>
    </div>
  );
}
