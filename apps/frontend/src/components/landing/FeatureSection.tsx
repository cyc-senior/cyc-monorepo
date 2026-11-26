import * as React from "react";
import type { IconSvgElement } from "@hugeicons/react";
import { HugeIcon } from "@/components/ui/huge-icon";
import { cn } from "@/lib/utils";
import type { FeatureItem } from "@/config/landing-page-data";

export interface FeatureCardProps {
  icon: IconSvgElement;
  title: string;
  description: string;
  className?: string;
}

export function FeatureCard({
  icon,
  title,
  description,
  className,
}: FeatureCardProps) {
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <div className="mt-0.5 shrink-0 text-brand-text">
        <HugeIcon icon={icon} size={16} />
      </div>
      <div>
        <h3 className="mb-1 font-sans text-sm font-semibold text-brand-text">
          {title}
        </h3>
        <p className="text-xs leading-relaxed text-brand-700 dark:text-brand-200">
          {description}
        </p>
      </div>
    </div>
  );
}

export interface FeatureSectionProps {
  title: string;
  description: string;
  features?: FeatureItem[];
  visual?: React.ReactNode;
  reverseLayout?: boolean;
  className?: string;
}

export function FeatureSection({
  title,
  description,
  features = [],
  visual,
  reverseLayout = false,
  className,
}: FeatureSectionProps) {
  const textContent = (
    <div className="min-w-0">
      <h2 className="mb-4 text-2xl font-bold tracking-tight text-brand-text sm:text-3xl">
        {title}
      </h2>
      <p className="mb-7 text-sm leading-relaxed text-brand-700 sm:text-base dark:text-brand-200">
        {description}
      </p>
      {features.length > 0 && (
        <div className="space-y-5">
          {features.map((feature) => (
            <FeatureCard
              key={feature.title}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
            />
          ))}
        </div>
      )}
    </div>
  );

  const visualContent = visual ? (
    <div className="min-w-0 w-full">{visual}</div>
  ) : null;

  return (
    <section className={cn("bg-brand-muted py-16 md:py-20", className)}>
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-12">
          {reverseLayout ? (
            <>
              {visualContent}
              {textContent}
            </>
          ) : (
            <>
              {textContent}
              {visualContent}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
