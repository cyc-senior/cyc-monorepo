import { cn } from "@/lib/utils";
import { StepCard } from "@/components/cards/StepCard";
import { stepsData, type StepItem } from "@/config/landing-page-data";

export interface StepsSectionProps {
  title?: string;
  description?: string;
  steps?: StepItem[];
  className?: string;
}

export function StepsSection({
  title,
  description,
  steps = stepsData,
  className,
}: StepsSectionProps) {
  return (
    <section className={cn("bg-background section-padding", className)}>
      <div className="container-page">
        {(title || description) && (
          <div className="mb-10">
            {title && (
              <h2 className="section-heading text-foreground mb-3">{title}</h2>
            )}
            {description && (
              <p className="section-description text-muted-foreground max-w-2xl">
                {description}
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {steps.map((step, index) => (
            <StepCard
              key={step.title}
              stepNumber={index + 1}
              icon={step.icon}
              title={step.title}
              description={step.description}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
