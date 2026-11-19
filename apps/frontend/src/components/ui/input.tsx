import * as React from "react"
import { cn } from "cn"

export interface InputProps extends React.ComponentProps<"input"> {
  error?: boolean
}

function Input({ className, type, error, ...props }: InputProps) {
  return (
    <input
      type={type}
      data-slot="input"
      aria-invalid={error ? true : props["aria-invalid"]}
      className={cn(
        "h-8 w-full min-w-0 rounded-[10px] border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
        "focus-visible:border-ring focus-visible:ring-[2px] focus-visible:ring-ring/50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        error && "border-destructive focus-visible:ring-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
