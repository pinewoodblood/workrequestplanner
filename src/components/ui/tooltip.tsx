"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "../../lib/utils";

/** Provider mit sinnvollen Defaults (kann mehrfach in der Baumstruktur verwendet werden) */
function TooltipProvider({
  delayDuration = 150,
  disableHoverableContent = true,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      disableHoverableContent={disableHoverableContent}
      {...props}
    />
  );
}

/** Root – kapselt Provider, damit man <Tooltip> alleine nutzen kann */
function Tooltip(props: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipProvider>
  );
}

/** Trigger – asChild-Kaskade bleibt Radix-Standard */
function TooltipTrigger(
  props: React.ComponentProps<typeof TooltipPrimitive.Trigger>
) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

/** Content – mit forwardRef, sauberen Tokens, Kollisionsschutz & Arrow */
const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentProps<typeof TooltipPrimitive.Content> & {
    /** Zusätzlicher Innenabstand zur Fensterkante (px) */
    collisionPadding?: number;
  }
>(function TooltipContent(
  {
    className,
    sideOffset = 6,
    collisionPadding = 8,
    side = "top",
    align = "center",
    children,
    ...props
  },
  ref
) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        ref={ref}
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        side={side}
        align={align}
        className={cn(
          // Layering & Box
          "z-50 w-max max-w-xs rounded-md border bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md",
          // Animations (tailwindcss-animate kompatibel, fällt sonst einfach weg)
          "data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          // A11y-Fokus wenn per Tastatur erreicht
          "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
          className
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow
          className="size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45"
          asChild
        >
          {/* Arrow als DOM-Element mit denselben Tokens */}
          <div className="bg-popover border border-border" />
        </TooltipPrimitive.Arrow>
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
});

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
