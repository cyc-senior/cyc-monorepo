import * as React from "react";
import { cn } from "@/lib/utils";
import { FeatureCard } from "@/components/cards/FeatureCard";
import type { FeatureItem } from "@/config/landing-page-data";

export interface FeatureSectionProps {
  title: string;
  description: string;
  features?: FeatureItem[];
  visual?: React.ReactNode;
  backgroundColor?: string;
  reverseLayout?: boolean;
  className?: string;
}

export function FeatureSection({
  title,
  description,
  features = [],
  visual,
  backgroundColor,
  reverseLayout = false,
  className,
}: FeatureSectionProps) {
  const textContent = (
    <div className="min-w-0">
      <h2 className="section-heading text-brand-text mb-4">{title}</h2>
      <p className="text-[15px] leading-relaxed text-brand-text-muted mb-7">
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
    <section
      className={cn("bg-brand-muted section-padding", className)}
      style={backgroundColor ? { backgroundColor } : undefined}
    >
      <div className="container-page">
        <div className="grid grid-cols-1 lg:grid-cols-[0.95fr_1.05fr] gap-10 lg:gap-12 items-center">
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
