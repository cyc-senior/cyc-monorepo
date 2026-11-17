import { cn } from "@/lib/utils";

export interface DesignPreviewCardProps {
  variant: "a" | "b";
  label: string;
  layout?: "stacked" | "media-header";
  className?: string;
}
export function DesignPreviewCard({
  variant,
  label,
  layout = "stacked",
  className,
}: DesignPreviewCardProps) {
  return (
    <div className={cn("flex flex-col", className)}>
      <div className="mb-2 flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className={cn(
            "size-2 shrink-0 rounded-full",
            variant === "a" ? "bg-design-a" : "bg-design-b"
          )}
        />
        <span className="text-xs font-medium text-foreground">{label}</span>
      </div>

      <div className="flex min-h-36 flex-1 flex-col justify-between rounded-lg border border-border bg-card p-2.5">
        {layout === "stacked" ? (
          <>
            <div>
              <div className="mb-2.5 h-14 w-full rounded-md bg-muted" />
              <div className="mb-1.5 h-2 w-full rounded bg-muted" />
              <div className="h-2 w-3/4 rounded bg-muted" />
            </div>
            <div className="mt-3 h-6 w-full rounded-md bg-muted" />
          </>
        ) : (
          <>
            <div>
              <div className="mb-2.5 flex items-center gap-2">
                <div className="size-5 shrink-0 rounded-full bg-muted" />
                <div className="h-2 flex-1 rounded bg-muted" />
              </div>
              <div className="mb-1.5 h-2 w-full rounded bg-muted" />
              <div className="mb-2.5 h-2 w-2/3 rounded bg-muted" />
              <div className="h-11 w-full rounded-md bg-muted" />
            </div>
            <div className="mt-3 flex justify-end">
              <div className="h-6 w-2/5 rounded-md bg-muted" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
