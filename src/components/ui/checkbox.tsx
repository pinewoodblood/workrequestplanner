import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { CheckIcon, MinusIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type CheckboxProps = React.ComponentProps<typeof CheckboxPrimitive.Root>;

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, ...props }, ref) => {
  return (
    <CheckboxPrimitive.Root
      ref={ref}
      data-slot="checkbox"
      className={cn(
        // Größe + Grundform
        "size-4 shrink-0 rounded-[4px] border",
        // Farben/States
        "border-input bg-background text-primary-foreground",
        "data-[state=checked]:bg-primary data-[state=checked]:border-primary",
        "data-[state=indeterminate]:bg-primary data-[state=indeterminate]:border-primary",
        // Fokus/A11y
        "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
        // Transition
        "transition-colors",
        // Disabled/Invalid
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className={cn(
          "grid place-content-center text-current leading-none",
          "data-[state=indeterminate]:[&_svg.check]:hidden",
          "data-[state=checked]:[&_svg.minus]:hidden"
        )}
      >
        {/* checked */}
        <CheckIcon className="check size-3.5" />
        {/* indeterminate */}
        <MinusIcon className="minus size-3.5" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});

Checkbox.displayName = "Checkbox";

export { Checkbox };
