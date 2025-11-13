import * as React from "react";
import { cn } from "../../lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        data-slot="input"
        className={cn(
          // Base
          "h-9 w-full min-w-0 rounded-xl border bg-background px-3 py-1 text-sm md:text-sm",
          "text-foreground placeholder:text-muted-foreground",
          // File input (Tailwind-kompatibel)
          "file:inline-flex file:h-7 file:items-center file:justify-center file:rounded-md",
          "file:border-0 file:bg-muted/60 file:px-2 file:text-xs file:font-medium file:text-foreground",
          // Focus/A11y
          "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
          // Disabled/Invalid
          "disabled:cursor-not-allowed disabled:opacity-50",
          "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
          // Dark/Input Tokens (falls gesetzt)
          "border-input",
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";

export { Input };
