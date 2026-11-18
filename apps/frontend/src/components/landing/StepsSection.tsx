import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { stepsData, type StepItem } from "@/config/landing-page-data";

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
    <Card className={cn("h-full gap-0 py-5", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3.5">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-xs font-semibold text-primary-text">
          {stepNumber}
        </span>
        <Icon className="size-4 shrink-0 text-primary-text" aria-hidden="true" />
      </CardHeader>
      <CardContent>
        <CardTitle className="mb-1.5 text-sm">{title}</CardTitle>
        <CardDescription className="text-xs leading-relaxed">
          {description}
        </CardDescription>
      </CardContent>
    </Card>
  );
}

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
