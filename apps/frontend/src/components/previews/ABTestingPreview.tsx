import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { DesignPreviewCard } from "./DesignPreviewCard";
import { abTestingPreviewData } from "@/config/landing-page-data";

export interface ABTestingPreviewProps {
  title?: string;
  subtitle?: string;
  statusLabel?: string;
  quote?: string;
  progressLabel?: string;
  extraTestersCount?: string;
  className?: string;
}

export function ABTestingPreview({
  title = abTestingPreviewData.title,
  subtitle = abTestingPreviewData.subtitle,
  statusLabel = abTestingPreviewData.statusLabel,
  quote = abTestingPreviewData.quote,
  progressLabel = abTestingPreviewData.progressLabel,
  extraTestersCount = abTestingPreviewData.extraTestersCount,
  className,
}: ABTestingPreviewProps) {
  return (
    <Card className={cn("overflow-hidden border-border/80 shadow-xl", className)}>
      {/* Header */}
      <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">{title}</span>
          <span className="text-xs text-muted-foreground">{subtitle}</span>
        </div>
        <Badge variant="lime">{statusLabel}</Badge>
      </CardHeader>

      {/* Design A and B wireframe panels */}
      <CardContent className="grid grid-cols-2 gap-3 p-4">
        {abTestingPreviewData.variants.map((variant) => (
          <DesignPreviewCard
            key={variant.id}
            variant={variant.id}
            label={variant.label}
            layout={variant.layout}
          />
        ))}
      </CardContent>

      {/* Feedback footer */}
      <CardFooter className="flex-wrap gap-2 border-t border-border px-4 py-3">
        <div className="flex items-center gap-1" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className="size-6 rounded-full border border-border/70 bg-muted"
            />
          ))}
          <span className="flex size-6 items-center justify-center rounded-full border border-border/70 bg-muted text-xs font-medium text-muted-foreground">
            {extraTestersCount}
          </span>
        </div>

        <p className="truncate text-xs text-foreground">{quote}</p>

        <span className="ml-auto whitespace-nowrap text-xs text-muted-foreground">
          {progressLabel}
        </span>
      </CardFooter>
    </Card>
  );
}
