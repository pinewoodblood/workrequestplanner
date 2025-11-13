import * as React from "react";
import { cn } from "../../lib/utils";

/**
 * Card – neutrale Container-Komponente mit soften Ecken.
 * Varianten:
 *  - elevated: leichte Erhöhung (shadow), sonst flach.
 */
type BaseProps = React.ComponentProps<"div"> & { elevated?: boolean };

function Card({ className, elevated = true, ...props }: BaseProps) {
  return (
    <div
      data-slot="card"
      className={cn(
        "bg-card text-card-foreground flex flex-col rounded-2xl border shadow-sm",
        elevated ? "shadow-sm" : "",
        className
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "px-4 sm:px-5 lg:px-6 pt-4 pb-2",
        "grid auto-rows-min items-start gap-1.5",
        className
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      data-slot="card-title"
      className={cn("text-base font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

/** Optionaler Aktionsbereich (rechts oben im Header) */
function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn("ml-auto", className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-4 sm:px-5 lg:px-6 py-4", className)}
      {...props}
    />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "px-4 sm:px-5 lg:px-6 py-3 border-t bg-background/30",
        className
      )}
      {...props}
    />
  );
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
};
