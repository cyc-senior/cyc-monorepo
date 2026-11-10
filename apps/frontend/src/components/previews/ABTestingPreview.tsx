import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
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
    <div
      className={cn(
        "rounded-xl bg-card text-card-foreground border border-border/80 overflow-hidden shadow-xl",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">{title}</span>
          <span className="text-[11px] text-muted-foreground">{subtitle}</span>
        </div>
        <Badge variant="lime" className="px-2 py-0.5 text-[11px]">
          {statusLabel}
        </Badge>
      </div>

      {/* Design A and B wireframe panels */}
      <div className="grid grid-cols-2 gap-3 p-4">
        {abTestingPreviewData.variants.map((variant) => (
          <DesignPreviewCard
            key={variant.id}
            variant={variant.id}
            label={variant.label}
            layout={variant.layout}
          />
        ))}
      </div>

      {/* Feedback footer */}
      <div className="px-4 py-3 border-t border-border flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className="w-5 h-5 rounded-full bg-muted border border-border/70"
            />
          ))}
          <span className="w-5 h-5 rounded-full bg-muted border border-border/70 text-[9px] font-medium text-muted-foreground flex items-center justify-center">
            {extraTestersCount}
          </span>
        </div>

        <p className="text-[11px] text-foreground truncate">{quote}</p>

        <span className="text-[11px] text-muted-foreground ml-auto whitespace-nowrap">
          {progressLabel}
        </span>
      </div>
    </div>
  );
}
