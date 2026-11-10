import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  testerRoundsPreviewData,
  type TesterRoundRow,
} from "@/config/landing-page-data";

export interface TesterRoundsPreviewProps {
  title?: string;
  subtitle?: string;
  statusLabel?: string;
  rootLabel?: string;
  rootSubtitle?: string;
  footnote?: string;
  testers?: TesterRoundRow[];
  className?: string;
}

export function TesterRoundsPreview({
  title = testerRoundsPreviewData.title,
  subtitle = testerRoundsPreviewData.subtitle,
  statusLabel = testerRoundsPreviewData.statusLabel,
  rootLabel = testerRoundsPreviewData.rootLabel,
  rootSubtitle = testerRoundsPreviewData.rootSubtitle,
  footnote = testerRoundsPreviewData.footnote,
  testers = testerRoundsPreviewData.testers,
  className,
}: TesterRoundsPreviewProps) {
  return (
    <div
      className={cn(
        "rounded-xl bg-card text-card-foreground overflow-hidden shadow-md border border-border",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">{title}</span>
          <span className="text-[11px] text-muted-foreground">{subtitle}</span>
        </div>
        <Badge variant="lime" className="px-2.5 py-0.5 text-[11px]">
          {statusLabel}
        </Badge>
      </div>

      {/* Flow diagram */}
      <div className="px-3 sm:px-5 py-5 sm:py-6 overflow-x-auto">
        <div className="flex items-center">
          {/* Round 1 root box */}
          <div className="shrink-0 rounded-lg bg-brand-subtle border border-brand-muted px-2 sm:px-3.5 py-2 sm:py-3 text-center">
            <div className="flex items-center justify-center gap-1 sm:gap-1.5 mb-1 sm:mb-1.5" aria-hidden="true">
              <span className="w-1.5 h-1.5 rounded-full bg-design-a" />
              <span className="w-1.5 h-1.5 rounded-full bg-design-b" />
            </div>
            <div className="text-[10px] sm:text-xs font-semibold text-foreground leading-tight whitespace-nowrap">
              {rootLabel}
            </div>
            <div className="text-[9px] sm:text-[10px] text-muted-foreground mt-0.5 whitespace-nowrap">
              {rootSubtitle}
            </div>
          </div>

          {/* Curved connector branches */}
          <svg
            viewBox="0 0 36 108"
            fill="none"
            aria-hidden="true"
            className="w-4 sm:w-8 h-[92px] sm:h-[108px] shrink-0 text-border"
          >
            <path
              d="M0 54 C14 54, 14 14, 36 14"
              stroke="currentColor"
              strokeWidth="1.25"
            />
            <path
              d="M0 54 H36"
              stroke="currentColor"
              strokeWidth="1.25"
            />
            <path
              d="M0 54 C14 54, 14 94, 36 94"
              stroke="currentColor"
              strokeWidth="1.25"
            />
          </svg>

          {/* Tester rows */}
          <div className="flex-1 min-w-0 space-y-3 sm:space-y-3.5">
            {testers.map((tester) => (
              <div key={tester.testerLabel} className="flex items-center gap-1.5 sm:gap-2.5">
                <span className="text-[10px] sm:text-[11px] font-medium text-foreground w-10 sm:w-14 shrink-0 whitespace-nowrap">
                  {tester.testerLabel}
                </span>

                <div className="flex items-center">
                  {tester.rounds.map((round, idx) => (
                    <div key={idx} className="flex items-center">
                      <span
                        className={cn(
                          "w-[18px] h-[18px] sm:w-6 sm:h-6 rounded-full text-[9px] sm:text-[11px] font-semibold flex items-center justify-center shrink-0",
                          round.status === "done" &&
                            "bg-primary-200 border border-primary-300 text-primary-950 dark:bg-success-subtle dark:border-primary-800 dark:text-primary-text",
                          round.status === "active" &&
                            "bg-card border-2 border-primary",
                          round.status === "review" &&
                            "bg-warning-subtle border border-warning/60 text-warning-foreground dark:border-warning dark:text-orange-100",
                          round.status === "empty" &&
                            "bg-card border border-border"
                        )}
                      >
                        {round.status === "active" ? (
                          <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-primary" />
                        ) : (
                          round.value ?? null
                        )}
                      </span>
                      {idx < tester.rounds.length - 1 && (
                        <div className="w-1 sm:w-2.5 h-px bg-border" />
                      )}
                    </div>
                  ))}
                </div>

                <Badge
                  variant={tester.badge.variant}
                  className="ml-auto text-[9px] sm:text-[10px] px-1.5 sm:px-2.5 py-0.5"
                >
                  {tester.badge.label}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer note */}
      <div className="px-5 pb-4">
        <p className="text-[11px] text-muted-foreground">{footnote}</p>
      </div>
    </div>
  );
}
