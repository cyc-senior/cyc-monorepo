import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export interface StepCardProps {
  stepNumber: number;
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
}

export function StepCard({
  stepNumber,
  icon: Icon,
  title,
  description,
  className,
}: StepCardProps) {
  return (
    <Card className={cn("p-5 flex flex-col gap-3.5 h-full", className)}>
      <div className="flex items-center justify-between">
        <span className="w-6 h-6 rounded-full bg-primary-subtle text-primary-text text-[11px] font-semibold flex items-center justify-center shrink-0">
          {stepNumber}
        </span>
        <Icon className="w-4 h-4 text-primary-text shrink-0" aria-hidden="true" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1.5">{title}</h3>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
    </Card>
  );
}
