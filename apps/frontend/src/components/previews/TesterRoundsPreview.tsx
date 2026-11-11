import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
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
    <Card className={cn("overflow-hidden shadow-md gap-0 py-0", className)}>
      {/* Header */}
      <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border px-5 py-3.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">{title}</span>
          <span className="text-xs text-muted-foreground">{subtitle}</span>
        </div>
        <Badge variant="secondary" className="bg-primary-subtle px-2 text-primary-text rounded-[10px]">{statusLabel}</Badge>
      </CardHeader>

      {/* Flow diagram */}
      <CardContent className="overflow-x-auto px-3 py-5 sm:px-5 sm:py-6">
        <div className="flex items-center">
          {/* Round 1 root box */}
          <div className="shrink-0 rounded-lg border border-brand-muted bg-brand-subtle px-2.5 py-2 text-center sm:px-3.5 sm:py-3">
            <div className="mb-1 flex items-center justify-center gap-1.5 sm:mb-1.5" aria-hidden="true">
              <span className="size-1.5 rounded-full bg-design-a" />
              <span className="size-1.5 rounded-full bg-design-b" />
            </div>
            <div className="whitespace-nowrap text-xs font-semibold leading-tight text-foreground">
              {rootLabel}
            </div>
            <div className="mt-0.5 whitespace-nowrap text-xs text-muted-foreground">
              {rootSubtitle}
            </div>
          </div>

          {/* Curved connector branches */}
          <svg
            viewBox="0 0 36 108"
            preserveAspectRatio="none"
            fill="none"
            aria-hidden="true"
            className="h-24 w-4 shrink-0 text-border sm:h-28 sm:w-8"
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
          <div className="min-w-0 flex-1 space-y-3 sm:space-y-3.5">
            {testers.map((tester) => (
              <div key={tester.testerLabel} className="flex items-center gap-1.5 sm:gap-2.5">
                <span className="w-12 shrink-0 whitespace-nowrap text-xs font-medium text-foreground sm:w-14">
                  {tester.testerLabel}
                </span>

                <div className="flex items-center">
                  {tester.rounds.map((round, idx) => (
                    <div key={idx} className="flex items-center">
                      <span
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold sm:size-6",
                          round.status === "done" &&
                          "border border-primary-300 bg-primary-200 text-primary-950 dark:border-primary-800 dark:bg-success-subtle dark:text-primary-text",
                          round.status === "active" &&
                          "border-2 border-primary bg-card",
                          round.status === "review" &&
                          "border border-warning/60 bg-warning-subtle text-warning-foreground dark:border-warning dark:text-orange-100",
                          round.status === "empty" &&
                          "border border-border bg-card"
                        )}
                      >
                        {round.status === "active" ? (
                          <span className="size-1.5 rounded-full bg-primary sm:size-2" />
                        ) : (
                          round.value ?? null
                        )}
                      </span>
                      {idx < tester.rounds.length - 1 && (
                        <div className="h-px w-1 bg-border sm:w-2.5" />
                      )}
                    </div>
                  ))}
                </div>

                <Badge
                  variant={tester.badge.variant}
                  className="ml-auto px-2 py-0.5 sm:px-2.5"
                >
                  {tester.badge.label}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </CardContent>

      {/* Footer note */}
      <CardFooter className="px-5 pb-4 pt-0">
        <p className="text-xs text-muted-foreground">{footnote}</p>
      </CardFooter>
    </Card>
  );
}
