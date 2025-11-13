import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Table
 * Zusätzliche Optionen per data-Attribut:
 * - data-density="compact"  → kleinere Padding/Schrift
 * - data-zebra="true"       → alternierende Zeilenfärbung im Body
 */
function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto rounded-2xl"
    >
      <table
        data-slot="table"
        className={cn(
          "w-full caption-bottom text-sm",
          // Dichte-Varianten
          "data-[density=compact]:text-xs",
          // Head/Cell Padding über Dichte steuern
          "[&[data-density=compact] th]:px-2 [&[data-density=compact] th]:h-9 [&[data-density=compact] td]:px-2 [&[data-density=compact] td]:py-1.5",
          "[&:not([data-density=compact]) th]:px-3 [&:not([data-density=compact]) th]:h-10 [&:not([data-density=compact]) td]:px-3 [&:not([data-density=compact]) td]:py-2.5",
          // Zebra optional
          "data-[zebra=true]:[&_tbody_tr:nth-child(even)]:bg-muted/30",
          className
        )}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn(
        "[&_tr]:border-b",
        // Wenn sticky: dezenter Blur + Hintergrund
        "data-[sticky=true]:sticky data-[sticky=true]:top-0 data-[sticky=true]:z-10 data-[sticky=true]:bg-background/90 data-[sticky=true]:backdrop-blur",
        className
      )}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
        // Fokus per Tastatur: leichte Hervorhebung
        "focus-within:bg-muted/60",
        className
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-3 text-left align-middle font-medium text-muted-foreground",
        "whitespace-nowrap",
        // Checkbox-Spalte optimieren
        "[&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "align-middle whitespace-nowrap",
        "[&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  );
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 px-3 text-left text-xs text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};
