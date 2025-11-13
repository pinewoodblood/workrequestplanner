import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  [
    "inline-flex items-center truncate gap-1",
    "whitespace-nowrap rounded-full border",
    "font-medium select-none",
    // Focus & A11y
    "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
    // Optik
    "transition-colors",
    // Default padding/size (kann via size-Variante überschrieben werden)
    "px-2.5 py-1 text-xs",
    // SVG normalisieren
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/90",
        outline: "border-foreground/20 text-foreground hover:bg-accent hover:text-accent-foreground",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/90",
        success:
          "border-transparent bg-emerald-600 text-white hover:bg-emerald-700",
        warning:
          "border-transparent bg-amber-500 text-white hover:bg-amber-600",
        info:
          "border-transparent bg-sky-600 text-white hover:bg-sky-700",
      },
      size: {
        xs: "px-2 py-0.5 text-[10px]",
        sm: "px-2.5 py-1 text-xs",
        md: "px-3 py-1.5 text-sm",
      },
      dot: {
        none: "",
        // kleiner Status-Punkt links
        left: "pl-2.5 relative before:content-[''] before:absolute before:left-1 before:top-1/2 before:-translate-y-1/2 before:size-1.5 before:rounded-full before:bg-current",
        // kleiner Status-Punkt rechts
        right: "pr-2.5 relative after:content-[''] after:absolute after:right-1 after:top-1/2 after:-translate-y-1/2 after:size-1.5 after:rounded-full after:bg-current",
      },
      // für ausblendbare Badges etwas mehr Innenabstand
      dismissible: {
        false: "",
        true: "pr-1.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "sm",
      dot: "none",
      dismissible: false,
    },
  }
);

type BadgeBaseProps = React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    asChild?: boolean;
    onRemove?: () => void;
    removeLabel?: string; // a11y-Text für den Remove-Button
  };

const Badge = React.forwardRef<HTMLSpanElement, BadgeBaseProps>(
  ({ className, asChild = false, variant, size, dot, dismissible, onRemove, removeLabel = "Entfernen", children, ...props }, ref) => {
    const Comp = asChild ? Slot : "span";
    return (
      <Comp
        ref={ref}
        data-slot="badge"
        className={cn(badgeVariants({ variant, size, dot, dismissible }), className)}
        {...props}
      >
        {children}
        {onRemove && (
          <button
            type="button"
            aria-label={removeLabel}
            onClick={onRemove}
            className={cn(
              "ml-1 inline-flex size-4 items-center justify-center rounded-full",
              "hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </Comp>
    );
  }
);
Badge.displayName = "Badge";

export { Badge, badgeVariants };
