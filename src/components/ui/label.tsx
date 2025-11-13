import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "../../lib/utils";

type LabelProps = React.ComponentProps<typeof LabelPrimitive.Root> & {
  /** Zeigt einen roten Stern an – semantisch bleibt required am Input. */
  required?: boolean;
  /** Kleiner Hinweistext rechts neben dem Label. */
  hint?: string;
};

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  LabelProps
>(({ className, required, hint, children, ...props }, ref) => {
  return (
    <LabelPrimitive.Root
      ref={ref}
      data-slot="label"
      className={cn(
        "inline-flex items-center gap-1.5 text-sm font-medium leading-none select-none",
        "peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        // leichte Fokus-Optik, falls Label selbst fokussierbar ist (z.B. via accesskey)
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background rounded-sm px-0.5",
        className
      )}
      {...props}
    >
      <span>{children}</span>
      {required && (
        <span aria-hidden="true" className="text-destructive">*</span>
      )}
      {hint && (
        <span className="ml-1 text-xs font-normal text-muted-foreground">
          {hint}
        </span>
      )}
    </LabelPrimitive.Root>
  );
});

Label.displayName = "Label";

export { Label };
