import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "../../lib/utils";

/** Root */
/** Root – triggert beim Tab-Wechsel ein Resize für Recharts */
function Tabs(props: React.ComponentProps<typeof TabsPrimitive.Root>) {
  const { className, onValueChange, ...rest } = props;

  const handleValueChange = React.useCallback(
    (value: string) => {
      // erst deinen evtl. eigenen Handler aufrufen
      onValueChange?.(value);
      // dann im nächsten Tick Resize feuern
      setTimeout(() => {
        window.dispatchEvent(new Event("resize"));
      }, 0);
    },
    [onValueChange]
  );

  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-2 w-full h-full", className)}
      onValueChange={handleValueChange}
      {...rest}
    />
  );
}

/** Tab-Leiste – vollbreit, scrollbar, weich, mit leichtem Blur */
function TabsList(props: React.ComponentProps<typeof TabsPrimitive.List>) {
  const { className, ...rest } = props;
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "w-full overflow-x-auto flex items-center gap-2 rounded-2xl border bg-secondary/80 backdrop-blur p-2",
        "supports-[backdrop-filter]:bg-secondary/60",
        className
      )}
      {...rest}
    />
  );
}

/** Trigger – klare Active/Focus-States, icon-freundlich */
function TabsTrigger(props: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const { className, ...rest } = props;
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-medium",
        "transition data-[state=active]:bg-background data-[state=active]:text-foreground hover:bg-background/70",
        "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
        "disabled:pointer-events-none disabled:opacity-50",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...rest}
    />
  );
}

/** Inhalt – sorgt dafür, dass Recharts Containergröße korrekt misst */
function TabsContent(props: React.ComponentProps<typeof TabsPrimitive.Content>) {
  const { className, ...rest } = props;
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("mt-2 outline-none min-w-0 min-h-0 flex-1", className)}
      {...rest}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
