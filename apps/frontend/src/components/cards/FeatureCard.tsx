import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
}

export function FeatureCard({
  icon: Icon,
  title,
  description,
  className,
}: FeatureCardProps) {
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <div className="shrink-0 mt-0.5 text-brand-text">
        <Icon className="w-4 h-4" aria-hidden="true" />
      </div>
      <div>
        <h3 className="font-sans text-sm font-semibold text-brand-text mb-1">
          {title}
        </h3>
        <p className="text-xs leading-relaxed text-brand-700 dark:text-brand-200">
          {description}
        </p>
      </div>
    </div>
  );
}
