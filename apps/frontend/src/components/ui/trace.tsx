import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const traceLineVariants = cva(
  "flex items-center gap-2.5 py-2 px-1 text-sm transition-colors rounded-md",
  {
    variants: {
      status: {
        default: "text-card-foreground",
        finished: "text-card-foreground font-medium",
        running: "text-card-foreground font-medium",
        pending: "text-muted-foreground opacity-60",
        error: "text-destructive font-medium",
      },
    },
    defaultVariants: {
      status: "default",
    },
  }
);

type TraceProps = React.HTMLAttributes<HTMLDivElement>;

const Trace = React.forwardRef<HTMLDivElement, TraceProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      role="list"
      className={cn("flex flex-col gap-0.5 w-full", className)}
      {...props}
    />
  )
);
Trace.displayName = "Trace";

type TraceLineProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof traceLineVariants>;

const TraceLine = React.forwardRef<HTMLDivElement, TraceLineProps>(
  ({ className, status = "default", ...props }, ref) => (
    <div
      ref={ref}
      role="listitem"
      data-status={status}
      className={cn(traceLineVariants({ status }), className)}
      {...props}
    />
  )
);
TraceLine.displayName = "TraceLine";

type TraceIconProps = React.HTMLAttributes<HTMLSpanElement>;

const TraceIcon = React.forwardRef<HTMLSpanElement, TraceIconProps>(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "flex size-5 shrink-0 items-center justify-center text-muted-foreground",
        className
      )}
      {...props}
    />
  )
);
TraceIcon.displayName = "TraceIcon";

type TraceTitleProps = React.HTMLAttributes<HTMLSpanElement>;

const TraceTitle = React.forwardRef<HTMLSpanElement, TraceTitleProps>(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      className={cn("text-sm leading-5 flex-1 min-w-0 truncate", className)}
      {...props}
    />
  )
);
TraceTitle.displayName = "TraceTitle";

type TraceDescriptionProps = React.HTMLAttributes<HTMLParagraphElement>;

const TraceDescription = React.forwardRef<
  HTMLParagraphElement,
  TraceDescriptionProps
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-xs text-muted-foreground leading-normal mt-0.5", className)}
    {...props}
  />
));
TraceDescription.displayName = "TraceDescription";

export { Trace, TraceLine, TraceIcon, TraceTitle, TraceDescription, traceLineVariants };
