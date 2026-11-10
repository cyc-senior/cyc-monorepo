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
      <div className="flex items-center gap-1.5 mb-2">
        <span
          aria-hidden="true"
          className={cn(
            "w-2 h-2 rounded-full shrink-0",
            variant === "a" ? "bg-design-a" : "bg-design-b"
          )}
        />
        <span className="text-[11px] font-medium text-foreground">{label}</span>
      </div>

      <div className="rounded-lg border border-border bg-card p-2.5 flex-1 flex flex-col justify-between min-h-[144px]">
        {layout === "stacked" ? (
          <>
            <div>
              <div className="h-14 rounded-md bg-muted w-full mb-2.5" />
              <div className="h-2 rounded bg-muted w-full mb-1.5" />
              <div className="h-2 rounded bg-muted w-3/4" />
            </div>
            <div className="h-6 rounded-md bg-muted w-full mt-3" />
          </>
        ) : (
          <>
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <div className="w-5 h-5 rounded-full bg-muted shrink-0" />
                <div className="h-2 rounded bg-muted flex-1" />
              </div>
              <div className="h-2 rounded bg-muted w-full mb-1.5" />
              <div className="h-2 rounded bg-muted w-2/3 mb-2.5" />
              <div className="h-11 rounded-md bg-muted w-full" />
            </div>
            <div className="flex justify-end mt-3">
              <div className="h-6 rounded-md bg-muted w-2/5" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
