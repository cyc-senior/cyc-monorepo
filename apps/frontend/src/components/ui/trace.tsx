import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const traceLineVariants = cva(
  "flex items-start gap-2.5 py-2 px-1 text-sm transition-colors rounded-md",
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
        "flex size-5 shrink-0 items-center justify-center text-muted-foreground mt-0.5",
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

interface TraceCollapsibleContextValue {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}
const TraceCollapsibleContext = React.createContext<TraceCollapsibleContextValue | null>(null);

function useTraceCollapsible() {
  const context = React.useContext(TraceCollapsibleContext);
  if (!context) {
    throw new Error("TraceCollapsible subcomponents must be used within a TraceCollapsible");
  }
  return context;
}

interface TraceCollapsibleProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const TraceCollapsible = React.forwardRef<HTMLDivElement, TraceCollapsibleProps>(
  ({ className, defaultOpen = false, open: controlledOpen, onOpenChange, children, ...props }, ref) => {
    const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
    const isOpen = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen;

    const setOpen = React.useCallback(
      (value: React.SetStateAction<boolean>) => {
        const nextValue = typeof value === "function" ? value(isOpen) : value;
        if (controlledOpen === undefined) {
          setUncontrolledOpen(nextValue);
        }
        onOpenChange?.(nextValue);
      },
      [controlledOpen, isOpen, onOpenChange]
    );

    return (
      <TraceCollapsibleContext.Provider value={{ open: isOpen, setOpen }}>
        <div
          ref={ref}
          data-state={isOpen ? "open" : "closed"}
          className={cn("w-full", className)}
          {...props}
        >
          {children}
        </div>
      </TraceCollapsibleContext.Provider>
    );
  }
);
TraceCollapsible.displayName = "TraceCollapsible";

type TraceCollapsibleTriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

const TraceCollapsibleTrigger = React.forwardRef<HTMLButtonElement, TraceCollapsibleTriggerProps>(
  ({ className, children, onClick, ...props }, ref) => {
    const { open, setOpen } = useTraceCollapsible();

    return (
      <button
        ref={ref}
        type="button"
        aria-expanded={open}
        onClick={(e) => {
          setOpen((prev) => !prev);
          onClick?.(e);
        }}
        className={cn(
          "flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer py-1 font-medium select-none group",
          className
        )}
        {...props}
      >
        <ChevronDown
          className={cn(
            "size-3.5 transition-transform duration-200 shrink-0 text-muted-foreground group-hover:text-foreground",
            open ? "rotate-0" : "-rotate-90"
          )}
        />
        {children}
      </button>
    );
  }
);
TraceCollapsibleTrigger.displayName = "TraceCollapsibleTrigger";

type TraceCollapsibleContentProps = React.HTMLAttributes<HTMLDivElement>;

const TraceCollapsibleContent = React.forwardRef<HTMLDivElement, TraceCollapsibleContentProps>(
  ({ className, children, ...props }, ref) => {
    const { open } = useTraceCollapsible();

    if (!open) return null;

    return (
      <div
        ref={ref}
        data-state={open ? "open" : "closed"}
        className={cn("mt-1.5 overflow-hidden transition-all text-xs", className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
TraceCollapsibleContent.displayName = "TraceCollapsibleContent";

export {
  Trace,
  TraceLine,
  TraceIcon,
  TraceTitle,
  TraceDescription,
  TraceCollapsible,
  TraceCollapsibleTrigger,
  TraceCollapsibleContent,
  traceLineVariants,
};
