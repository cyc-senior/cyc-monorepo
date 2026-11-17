import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
