import { cn } from "@/lib/utils";
import { StepCard } from "@/components/cards/StepCard";
import { stepsData, type StepItem } from "@/config/landing-page-data";

export interface StepsSectionProps {
  title?: string;
  description?: string;
  steps?: StepItem[];
  className?: string;
}

/**
 * Four-step workflow overview section rendered on the landing page.
 */
export function StepsSection({
  title,
  description,
  steps = stepsData,
  className,
}: StepsSectionProps) {
  return (
    <section className={cn("bg-background py-16 md:py-20", className)}>
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {(title || description) && (
          <div className="mb-10">
            {title && (
              <h2 className="mb-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {title}
              </h2>
            )}
            {description && (
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                {description}
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
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
