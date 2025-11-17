"use client";

//import * as React from "react";
import React, { useState, useReducer, useEffect, useMemo, useCallback, useRef } from "react";
import {
  CalendarClock,
  CalendarDays,
  Clock,
  Plus,
  Filter,
  HelpCircle,
  Download,
  ChevronDown,
  Table2,
  FileJson,
  Import,
  RefreshCw,
  Trash2,
  X,
  Info,
  Settings2,
} from "lucide-react";
import { Toaster, toast } from "sonner";

import { Button } from "./components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "./components/ui/card";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "./components/ui/tabs";
import { Badge } from "./components/ui/badge";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "./components/ui/select";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "./components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./components/ui/dialog";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  TableCaption,
} from "./components/ui/table";
import { Checkbox } from "./components/ui/checkbox";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "./components/ui/collapsible";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "./components/ui/sheet";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  BarChart,
  Bar,
} from "recharts";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "./components/ui/dropdown-menu";

import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabaseClient"; // Pfad ggf. anpassen
import { dataStore } from "./lib/dataStore";

/* ===========================================================
   Types / Data Model
   =========================================================== */

type Cadence = "one-off" | "weekly" | "monthly" | "quarterly" | "yearly";
type DueStrategy = "fixed-date" | "relative";
type Priority = "low" | "medium" | "high";
type Status = "planned" | "active" | "blocked" | "done";

export interface Team {
  id: string;
  name: string;
  owner: string;
}

export interface Area {
  id: string;
  name: string;
  contact?: string;
}

export interface Topic {
  id: string;
  teamId: string;
  title: string;
  description?: string;
  areaIds: string; // comma-separated, kann leer sein
  cadence?: Cadence;
  startDate?: string; // YYYY-MM-DD
  dueStrategy?: DueStrategy;
  dueOffsetDays?: number;
  expectedDeliverable: string;
  priority: Priority;
  status: Status;
  tags: string;
  lastRequestDate?: string;
  nextRequestDate?: string;
}

export interface RequestLog {
  id: string;
  topicId: string;
  date: string; // YYYY-MM-DD
  sentBy: string;
  toAreaId: string;
  notes?: string;
  outcome: "sent" | "ack" | "delivered" | "overdue";
}

/* ===========================================================
   i18n Strings
   =========================================================== */

const STR = {
  appTitle: "Work Request Planner",
  subtitle:
    "Transparenz für andere Bereiche: Wer fordert wann welche Zuarbeit wofür an?",
  tabs: {
    overview: "Übersicht",
    matrix: "Matrix",
    calendar: "Kalender",
    topics: "Themen",
    logs: "Protokoll",
    reports: "Reports",
    areas: "Bereiche",
    teams: "Teams",
  },
  actions: {
    newTopic: "Neues Thema",
    newTeam: "Neues Team",
    newArea: "Neuer Bereich",
    newLog: "Neue Anfrage protokollieren",
    clearFilters: "Filter zurücksetzen",

    // 🔽 neu:
    data: "Daten",
    csvExport: "CSV exportieren",
    jsonExport: "JSON exportieren",
    jsonImport: "JSON importieren",
    demoLoad: "Demo-Daten laden",
    demoClear: "Demo-Daten löschen",

  },
  filters: {
    team: "Team",
    area: "Bereich",
    status: "Status",
    cadence: "Frequenz",
    priority: "Priorität",
    dateFrom: "von",
    dateTo: "bis",
    tag: "Tag",
    more: "Erweiterte Filter",
  },
  dialogs: {
    topicTitle: "Thema anlegen / bearbeiten",
    teamTitle: "Team anlegen / bearbeiten",
    areaTitle: "Bereich anlegen / bearbeiten",
    logTitle: "Anfrage protokollieren",
    dayTitle: "Einträge am Tag",
  },
  kpis: {
    next7: "Fälligkeiten (7 Tage)",
    next30: "Fälligkeiten (30 Tage)",
    overdue: "Überfällig",
    perArea: "Themen pro Bereich",
    perTeam: "Themen pro Team",
  },
  reports: {
    r1: "Requests / Monat (12M)",
    r2: "Top-Bereiche nach Volumen",
  },
  calendar: {
    today: "Heute",
    overdue: "Überfällig",
    none: "Keine Einträge",
  },
  searchPlaceholder: "Suche nach Titel, Beschreibung, Tags…",
  details: {
    missingContact: "Mindestens ein Bereich hat keinen hinterlegten Kontakt.",
  },
};

/* ===========================================================
   Helpers: IDs, Dates, Cadence
   =========================================================== */

const uid = () => Math.random().toString(36).slice(2, 10);

function addDaysISO(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function cadenceNextDate(
  startISO: string,
  cadence?: Cadence,
  lastISO?: string
): string | undefined {
  if (!startISO || !cadence) return undefined;
  if (cadence === "one-off") return startISO;
  const baseISO = lastISO || startISO;
  const d = new Date(baseISO + "T00:00:00");
  switch (cadence) {
    case "weekly":
      d.setDate(d.getDate() + 7);
      break;
    case "monthly":
      d.setMonth(d.getMonth() + 1);
      break;
    case "quarterly":
      d.setMonth(d.getMonth() + 3);
      break;
    case "yearly":
      d.setFullYear(d.getFullYear() + 1);
      break;
    default:
      break;
  }
  return d.toISOString().slice(0, 10);
}

function isOverdue(iso?: string) {
  if (!iso) return false;
  const today = new Date().toISOString().slice(0, 10);
  return iso < today;
}

function isDueToday(iso?: string) {
  if (!iso) return false;
  const today = new Date().toISOString().slice(0, 10);
  return iso === today;
}

function getDue(t: Topic): string | undefined {
  return t.nextRequestDate ?? t.startDate ?? undefined;
}

// Hilfsfunktion: führt Arrays nach ID zusammen
function mergeById<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const map = new Map<string, T>();

  for (const e of existing) map.set(e.id, e);
  for (const i of incoming) map.set(i.id, i);

  return Array.from(map.values());
}


/* ===========================================================
   State / Reducer / Persist
   =========================================================== */

type State = {
  teams: Team[];
  areas: Area[];
  topics: Topic[];
  logs: RequestLog[];
};

interface AppState {
  teams: Team[];
  areas: Area[];
  topics: Topic[];
  logs: RequestLog[];
}

type Action =
  | { type: "LOAD_ALL_FROM_BACKEND"; payload: AppState }
  | { type: "RESET_FROM_REMOTE"; payload: AppState }
  | { type: "ADD_TEAM"; team: Team }
  | { type: "UPDATE_TEAM"; team: Team }
  | { type: "DELETE_TEAM"; id: string }
  | { type: "ADD_AREA"; area: Area }
  | { type: "UPDATE_AREA"; area: Area }
  | { type: "DELETE_AREA"; id: string }
  | { type: "ADD_TOPIC"; topic: Topic }
  | { type: "UPDATE_TOPIC"; topic: Topic }
  | { type: "DELETE_TOPIC"; id: string }
  | { type: "ADD_LOG"; log: RequestLog }
  | { type: "DELETE_LOG"; id: string }
  | { type: "RECALC_DATES" }
  | { type: "IMPORT_STATE"; payload: AppState };
  


  const emptyState: State = { teams: [], areas: [], topics: [], logs: [] };

  /**
   * LocalStorage-Schlüssel:
   * - PRIMARY_KEY: neuer, „offizieller“ Key
   * - LEGACY_KEYS: hier trägst du die alten Keys ein, unter denen früher gespeichert wurde.
   *   -> Falls du andere alte Keys hattest, hier ergänzen!
   */
  
  const LEGACY_KEYS = [
    "work-request-planner:v2",      // frühere Version
    "work-request-planner",         // ggf. ganz alte Variante
    "wrpState",                     // falls du diesen mal verwendet hast
  ];
  
  function normalizeState(raw: any): State {
    const s: State = {
      teams: Array.isArray(raw?.teams) ? raw.teams : [],
      areas: Array.isArray(raw?.areas) ? raw.areas : [],
      topics: Array.isArray(raw?.topics) ? raw.topics : [],
      logs: Array.isArray(raw?.logs) ? raw.logs : [],
    };
    return s;
  }  

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "RESET_FROM_REMOTE":
      return {
        ...state,
        ...action.payload, // { teams, areas, topics, logs }
      };    
    case "ADD_TEAM":
      return { ...state, teams: [...state.teams, action.team] };
    case "UPDATE_TEAM":
      return {
        ...state,
        teams: state.teams.map((t) =>
          t.id === action.team.id ? action.team : t
        ),
      };
    case "DELETE_TEAM":
      return {
        ...state,
        teams: state.teams.filter((t) => t.id !== action.id),
        topics: state.topics.filter((tp) => tp.teamId !== action.id),
        logs: state.logs.filter((l) =>
          state.topics.find(
            (tp) => tp.id === l.topicId && tp.teamId === action.id
          )
            ? false
            : true
        ),
      };
    case "ADD_AREA":
      return { ...state, areas: [...state.areas, action.area] };
    case "UPDATE_AREA":
      return {
        ...state,
        areas: state.areas.map((a) =>
          a.id === action.area.id ? action.area : a
        ),
      };
    case "DELETE_AREA":
      return {
        ...state,
        areas: state.areas.filter((a) => a.id !== action.id),
        topics: state.topics.map((tp) => ({
          ...tp,
          areaIds: tp.areaIds
            .split(",")
            .map((s) => s.trim())
            .filter((id) => id && id !== action.id)
            .join(","),
        })),
        logs: state.logs.filter((l) => l.toAreaId !== action.id),
      };
    case "ADD_TOPIC":
      return { ...state, topics: [...state.topics, action.topic] };
    case "UPDATE_TOPIC":
      return {
        ...state,
        topics: state.topics.map((t) =>
          t.id === action.topic.id ? action.topic : t
        ),
      };
    case "DELETE_TOPIC":
      return {
        ...state,
        topics: state.topics.filter((t) => t.id !== action.id),
        logs: state.logs.filter((l) => l.topicId !== action.id),
      };
    case "ADD_LOG":
      return { ...state, logs: [...state.logs, action.log] };
    case "DELETE_LOG":
      return { ...state, logs: state.logs.filter((l) => l.id !== action.id) };
    case "RECALC_DATES":
      return {
        ...state,
        topics: state.topics.map((t) => ({
          ...t,
          nextRequestDate: t.startDate
            ? cadenceNextDate(t.startDate, t.cadence, t.lastRequestDate)
            : t.nextRequestDate,
        })),
      };
    case "IMPORT_STATE": {
        // komplette State-Übernahme; wenn du willst, kannst du hier auch merge-Logik einbauen
        const next = {
          ...state,
          ...action.payload,
        };
      return next;
    }
    default:
      return state;
  }
}

/* ===========================================================
   Generic DataTable mit Sort / Filter / Resize / Multiline
   =========================================================== */

interface ColumnDef<T> {
  key: string;
  label: string;
  width?: number;
  sortable?: boolean;
  filterable?: boolean;
  render: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  getRowId: (row: T) => string;
  getCellValue?: (row: T, key: string) => string | number | undefined;
  emptyMessage?: string;
}

/* ===========================================================
   Generic DataTable mit Sort / Resize / Multiline
   =========================================================== */

   type SortDir = "asc" | "desc";

   interface ColumnDef<T> {
     key: string;
     label: string;
     width?: number;
     sortable?: boolean;
     // filterable bleibt im Typ, wird aber aktuell nicht genutzt
     filterable?: boolean;
     render: (row: T) => React.ReactNode;
   }
   
   interface DataTableProps<T> {
     data: T[];
     columns: ColumnDef<T>[];
     getRowId: (row: T) => string;
     getCellValue?: (row: T, key: string) => string | number | undefined;
     emptyMessage?: string;
   }
   
   function DataTable<T>({
     data,
     columns,
     getRowId,
     getCellValue,
     emptyMessage = "Keine Einträge",
   }: DataTableProps<T>) {
     const [sortKey, setSortKey] = React.useState<string | null>(
       columns[0]?.key ?? null
     );
     const [sortDir, setSortDir] = React.useState<SortDir>("asc");
     const [colWidths, setColWidths] = React.useState<Record<string, number>>({});
   
     const sortedRows = React.useMemo(() => {
       let rows = [...data];
   
       if (getCellValue && sortKey) {
         rows.sort((a, b) => {
           const va = getCellValue(a, sortKey);
           const vb = getCellValue(b, sortKey);
   
           if (va == null && vb == null) return 0;
           if (va == null) return sortDir === "asc" ? -1 : 1;
           if (vb == null) return sortDir === "asc" ? 1 : -1;
   
           if (va < vb) return sortDir === "asc" ? -1 : 1;
           if (va > vb) return sortDir === "asc" ? 1 : -1;
           return 0;
         });
       }
   
       return rows;
     }, [data, getCellValue, sortKey, sortDir]);
   
     function handleHeaderClick(col: ColumnDef<T>) {
       if (!col.sortable || !getCellValue) return;
       if (sortKey === col.key) {
         setSortDir((d) => (d === "asc" ? "desc" : "asc"));
       } else {
         setSortKey(col.key);
         setSortDir("asc");
       }
     }
   
     function handleResizeMouseDown(
       e: React.MouseEvent<HTMLDivElement>,
       key: string
     ) {
       e.preventDefault();
       e.stopPropagation();
       const startX = e.clientX;
       const th = (e.currentTarget.parentElement ||
         e.currentTarget) as HTMLElement;
       const startWidth = th.getBoundingClientRect().width;
   
       function onMove(ev: MouseEvent) {
         const delta = ev.clientX - startX;
         setColWidths((prev) => ({
           ...prev,
           [key]: Math.max(80, startWidth + delta),
         }));
       }
   
       function onUp() {
         window.removeEventListener("mousemove", onMove);
         window.removeEventListener("mouseup", onUp);
       }
   
       window.addEventListener("mousemove", onMove);
       window.addEventListener("mouseup", onUp);
     }
   
     return (
       <Table>
         <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur">
           <TableRow>
             {columns.map((col) => (
               <TableHead
                 key={col.key}
                 style={
                   colWidths[col.key] || col.width
                     ? { width: colWidths[col.key] ?? col.width }
                     : undefined
                 }
                 className="relative select-none"
                 onClick={() => handleHeaderClick(col)}
               >
                 <div className="flex items-center gap-1">
                   <span className="text-xs font-semibold tracking-wide uppercase">
                     {col.label}
                   </span>
                   {sortKey === col.key && getCellValue && (
                     <span className="text-[10px] text-muted-foreground">
                       {sortDir === "asc" ? "▲" : "▼"}
                     </span>
                   )}
                 </div>
                 <div
                   className="absolute right-0 top-0 h-full w-1 cursor-col-resize"
                   onMouseDown={(e) => handleResizeMouseDown(e, col.key)}
                 />
               </TableHead>
             ))}
           </TableRow>
         </TableHeader>
         <TableBody>
           {sortedRows.length === 0 && (
             <TableRow>
               <TableCell
                 colSpan={columns.length}
                 className="py-4 text-sm text-muted-foreground"
               >
                 {emptyMessage}
               </TableCell>
             </TableRow>
           )}
           {sortedRows.map((row) => (
             <TableRow
               key={getRowId(row)}
               className="hover:bg-muted/40 align-top"
             >
               {columns.map((col) => (
                 <TableCell
                   key={col.key}
                   className="align-top whitespace-normal break-words text-sm"
                 >
                   {col.render(row)}
                 </TableCell>
               ))}
             </TableRow>
           ))}
         </TableBody>
       </Table>
     );
   }   

/* ===========================================================
   Forms
   =========================================================== */

// ---------------- TopicForm ----------------

type TopicFormProps = {
  draft: Partial<Topic>;
  setDraft: (draft: Partial<Topic>) => void;
  teams: Team[];
  areas: Area[];
};

function TopicForm({ draft, setDraft, teams, areas }: TopicFormProps) {
  // Hilfsfunktion: Liste von Area-IDs <-> CSV-String
  const selectedAreaIds: string[] = (draft.areaIds ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const toggleArea = (areaId: string) => {
    const set = new Set(selectedAreaIds);
    if (set.has(areaId)) {
      set.delete(areaId);
    } else {
      set.add(areaId);
    }
    const csv = Array.from(set).join(",");
    setDraft({ ...draft, areaIds: csv });
  };

  return (
    <div className="grid gap-4">
      {/* Titel */}
      <div className="grid gap-2">
        <Label htmlFor="topic-title">Titel*</Label>
        <Input
          id="topic-title"
          value={draft.title ?? ""}
          onChange={(e) =>
            setDraft({
              ...draft,
              title: e.target.value,
            })
          }
          placeholder="z. B. Quartalsreporting Risiko"
        />
      </div>

      {/* Team */}
      <div className="grid gap-2">
        <Label>Team*</Label>
        <Select
          value={draft.teamId ?? ""}
          onValueChange={(value) =>
            setDraft({
              ...draft,
              teamId: value,
            })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Team wählen" />
          </SelectTrigger>
          <SelectContent>
            {teams.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Bereiche (Mehrfachauswahl) */}
      <div className="grid gap-2">
        <Label>Bereiche (optional, mehrere möglich)</Label>
        {areas.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Noch keine Bereiche angelegt.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {areas.map((a) => {
              const checked = selectedAreaIds.includes(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggleArea(a.id)}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${
                    checked
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground hover:bg-muted"
                  }`}
                >
                  <span>{a.name}</span>
                  {checked && (
                    <span className="text-[10px] uppercase tracking-wide">
                      aktiv
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Fälligkeit / Cadence */}
      <div className="grid md:grid-cols-3 gap-3">
        <div className="grid gap-2">
          <Label>Startdatum</Label>
          <Input
            type="date"
            value={draft.startDate ?? ""}
            onChange={(e) =>
              setDraft({
                ...draft,
                startDate: e.target.value || undefined,
              })
            }
          />
        </div>

        <div className="grid gap-2">
          <Label>Frequenz</Label>
          <Select
            value={draft.cadence ?? ""}
            onValueChange={(value) =>
              setDraft({
                ...draft,
                cadence: value as Cadence,
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="optional" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="one-off">one-off</SelectItem>
              <SelectItem value="weekly">weekly</SelectItem>
              <SelectItem value="monthly">monthly</SelectItem>
              <SelectItem value="quarterly">quarterly</SelectItem>
              <SelectItem value="yearly">yearly</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label>Fälligkeitsstrategie</Label>
          <Select
            value={draft.dueStrategy ?? ""}
            onValueChange={(value) =>
              setDraft({
                ...draft,
                dueStrategy: value as Topic["dueStrategy"],
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Standard" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fixed-date">fixes Datum</SelectItem>
              <SelectItem value="offset-from-start">
                Offset ab Start
              </SelectItem>
              <SelectItem value="offset-from-last">
                Offset ab letzter Anfrage
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Optional: Offset-Tage */}
      <div className="grid gap-2">
        <Label>Offset (Tage, optional)</Label>
        <Input
          type="number"
          value={
            typeof draft.dueOffsetDays === "number"
              ? String(draft.dueOffsetDays)
              : ""
          }
          onChange={(e) =>
            setDraft({
              ...draft,
              dueOffsetDays:
                e.target.value === ""
                  ? undefined
                  : Number(e.target.value),
            })
          }
          placeholder="z. B. 7"
        />
      </div>

      {/* Ergebnis / Beschreibung */}
      <div className="grid gap-2">
        <Label>Erwartetes Ergebnis / Deliverable</Label>
        <Input
          value={draft.expectedDeliverable ?? ""}
          onChange={(e) =>
            setDraft({
              ...draft,
              expectedDeliverable: e.target.value,
            })
          }
          placeholder="z. B. abgestimmte Liste, Dashboard-Link, Freigabe …"
        />
      </div>

      {/* Status & Prio */}
      <div className="grid md:grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label>Status</Label>
          <Select
            value={draft.status ?? ""}
            onValueChange={(value) =>
              setDraft({
                ...draft,
                status: value as Status,
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="planned">planned</SelectItem>
              <SelectItem value="active">active</SelectItem>
              <SelectItem value="blocked">blocked</SelectItem>
              <SelectItem value="done">done</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label>Priorität</Label>
          <Select
            value={draft.priority ?? ""}
            onValueChange={(value) =>
              setDraft({
                ...draft,
                priority: value as Priority,
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">low</SelectItem>
              <SelectItem value="medium">medium</SelectItem>
              <SelectItem value="high">high</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tags */}
      <div className="grid gap-2">
        <Label>Tags (optional)</Label>
        <Input
          value={draft.tags ?? ""}
          onChange={(e) =>
            setDraft({
              ...draft,
              tags: e.target.value,
            })
          }
          placeholder="z. B. audit, regulatorisch, reporting"
        />
      </div>
    </div>
  );
}


function LogForm({
  topics,
  areas,
  onSubmit,
}: {
  topics: Topic[];
  areas: Area[];
  onSubmit: (log: Partial<RequestLog>) => void;
}) {
  const [topicId, setTopicId] = React.useState("");
  const [toAreaId, setToAreaId] = React.useState("");
  const [date, setDate] = React.useState("");
  const [sentBy, setSentBy] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [outcome, setOutcome] =
    React.useState<RequestLog["outcome"]>("sent");
  
  
    return (
    <form
      className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ topicId, toAreaId, date, sentBy, notes, outcome });
      }}
    >
      <div className="grid gap-2">
        <Label>Topic*</Label>
        <Select value={topicId} onValueChange={setTopicId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="wählen" />
          </SelectTrigger>
          <SelectContent>
            {topics.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label>Bereich*</Label>
        <Select value={toAreaId} onValueChange={setToAreaId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="wählen" />
          </SelectTrigger>
          <SelectContent>
            {areas.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label>Datum</Label>
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label>Von</Label>
        <Input
          value={sentBy}
          onChange={(e) => setSentBy(e.target.value)}
          placeholder="Name / System"
        />
      </div>
      <div className="grid gap-2">
        <Label>Outcome</Label>
        <Select
          value={outcome}
          onValueChange={(v) => setOutcome(v as any)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sent">sent</SelectItem>
            <SelectItem value="ack">ack</SelectItem>
            <SelectItem value="delivered">delivered</SelectItem>
            <SelectItem value="overdue">overdue</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="sm:col-span-2 grid gap-2">
        <Label>Notizen</Label>
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="optional"
        />
      </div>
      <div className="sm:col-span-2 flex justify-end gap-2 mt-2">
        <Button type="submit">
          <Download className="h-4 w-4 mr-1 rotate-180" />
          Speichern
        </Button>
      </div>
    </form>
  );
}

/* ===========================================================
   Small bits
   =========================================================== */

function StatusBadge({ s }: { s: Status }) {
  const map: Record<
    Status,
    { label: string; v: "secondary" | "outline" | "destructive" | "default" }
  > = {
    planned: { label: "planned", v: "outline" },
    active: { label: "active", v: "default" },
    blocked: { label: "blocked", v: "destructive" },
    done: { label: "done", v: "secondary" },
  };
  return <Badge variant={map[s].v}>{map[s].label}</Badge>;
}

function PriorityBadge({ p }: { p: Priority }) {
  return (
    <Badge
      variant={
        p === "high" ? "destructive" : p === "medium" ? "default" : "secondary"
      }
    >
      {p}
    </Badge>
  );
}

/* ===========================================================
   Main App
   =========================================================== */
     
   const EMPTY_STATE: AppState = {
     teams: [],
     areas: [],
     topics: [],
     logs: [],
   };

     
   export default function WorkRequestPlannerAppUX() {
    const [state, dispatch] = React.useReducer(reducer, EMPTY_STATE);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [session, setSession] = React.useState<Session | null>(null);

    React.useEffect(() => {
      // aktuelle Session holen
      supabase.auth.getSession().then(({ data }) => {
        setSession(data.session ?? null);
      });
  
      // Änderungen an der Session abonnieren
      const { data: subscription } = supabase.auth.onAuthStateChange(
        (_event, newSession) => {
          setSession(newSession);
        }
      );
  
      return () => {
        subscription.subscription.unsubscribe();
      };
    }, []);

    async function handleLogout() {
      try {
        await supabase.auth.signOut();
        // Session wird über onAuthStateChange → setSession(null) gesetzt
      } catch (e) {
        console.error("Logout fehlgeschlagen:", e);
      }
    }  

    // 4.1: Initial-Laden aus Supabase statt localStorage
    React.useEffect(() => {
      let cancelled = false;
  
      (async () => {
        try {
          const remote = await dataStore.loadState();
          if (!cancelled) {
            dispatch({ type: "RESET_FROM_REMOTE", payload: remote });
          }
        } catch (e) {
          console.error("Fehler beim Laden aus Supabase:", e);
          if (!cancelled) {
            setError("Daten konnten nicht geladen werden.");
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
          }          
        }
      })();
  
      return () => {
        cancelled = true;
      };
    }, []);
  
    // Optional: weiterhin eine Kopie in localStorage halten (nur Spiegel, kein Source of Truth)
    React.useEffect(() => {
      try {
        localStorage.setItem("work-request-planner:snapshot", JSON.stringify(state));
      } catch (e) {
        console.warn("Konnte State nicht in localStorage spiegeln:", e);
      }
    }, [state]);


  /* ---- global UI ---- */
  const [query, setQuery] = React.useState("");
  const [fltTeam, setFltTeam] = React.useState<string>("all");
  const [fltArea, setFltArea] = React.useState<string>("all");
  const [fltStatus, setFltStatus] = React.useState<string>("all");
  const [fltCadence, setFltCadence] = React.useState<string>("all");
  const [fltPriority, setFltPriority] = React.useState<string>("all");
  const [fltFrom, setFltFrom] = React.useState<string>("");
  const [fltTo, setFltTo] = React.useState<string>("");
  const [fltTag, setFltTag] = React.useState<string>("");
  const [advancedOpen, setAdvancedOpen] = React.useState(false);
  const [openImportDialog, setOpenImportDialog] = React.useState(false);
  const [openTopicDialog, setOpenTopicDialog] = React.useState(false);
  const [openTeamDialog, setOpenTeamDialog] = React.useState(false);
  const [openAreaDialog, setOpenAreaDialog] = React.useState(false);
  const [openLogDialog, setOpenLogDialog] = React.useState(false);

  const [topicDraft, setTopicDraft] = React.useState<Partial<Topic>>();
  const [editTopic, setEditTopic] = React.useState<Topic | undefined>();

  const [teamDraft, setTeamDraft] = React.useState<Partial<Team>>();
  const [editTeam, setEditTeam] = React.useState<Team | undefined>();

  const [areaDraft, setAreaDraft] = React.useState<Partial<Area>>();
  const [editArea, setEditArea] = React.useState<Area | undefined>();

  const [calendarCursor, setCalendarCursor] = React.useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const [detailTopic, setDetailTopic] = React.useState<Topic | null>(null);
  const [openDayDialog, setOpenDayDialog] = React.useState(false);
  const [dayDialog, setDayDialog] = React.useState<{
    date: string;
    items: Topic[];
  } | null>(null);

  const teamName = React.useCallback(
    (id: string) => state.teams.find((t) => t.id === id)?.name || id,
    [state.teams]
  );
  const areaName = React.useCallback(
    (id: string) => state.areas.find((a) => a.id === id)?.name || id,
    [state.areas]
  );
  const areaMissingContact = (areaIds: string) =>
    areaIds
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .some((id) => !state.areas.find((a) => a.id === id)?.contact);

  const [importMode, setImportMode] = React.useState<"append" | "truncateAll">("append");
  
      function clearFilters() {
    setQuery("");
    setFltTeam("all");
    setFltArea("all");
    setFltStatus("all");
    setFltCadence("all");
    setFltPriority("all");
    setFltFrom("");
    setFltTo("");
    setFltTag("");
  }

  /* ---- Teams ---- */

  function beginNewTeam() {
    setEditTeam(undefined);
    setTeamDraft({ name: "", owner: "" });
    setOpenTeamDialog(true);
  }

  function beginEditTeam(t: Team) {
    setEditTeam(t);
    setTeamDraft({ ...t });
    setOpenTeamDialog(true);
  }

  async function saveTeam(name: string, owner: string) {
    const norm = name.trim();
    if (!norm) {
      toast.error("Teamname fehlt");
      return;
    }
  
    const duplicate = state.teams.some(
      (t) =>
        t.name.toLowerCase() === norm.toLowerCase() &&
        t.id !== (editTeam?.id || "")
    );
    if (duplicate) {
      toast.error("Team existiert bereits");
      return;
    }
  
    if (editTeam) {
      // UPDATE
      const updatedLocal: Team = { ...editTeam, name: norm, owner: owner.trim() };
      dispatch({ type: "UPDATE_TEAM", team: updatedLocal });
  
      try {
        const updatedFromDb = await dataStore.updateTeam(updatedLocal);
        // falls DB etwas ändert (z. B. Trigger), kannst du optional noch mal dispatchen
        dispatch({ type: "UPDATE_TEAM", team: updatedFromDb });
        toast.success("Team aktualisiert");
      } catch (e) {
        console.error("Fehler beim Update in Supabase:", e);
        toast.error("Team lokal aktualisiert, aber nicht im Backend.");
      } finally {
        setOpenTeamDialog(false);
      }
    } else {
      // CREATE
      const temp: Team = { id: uid(), name: norm, owner: owner.trim() };
      dispatch({ type: "ADD_TEAM", team: temp });
  
      try {
        const created = await dataStore.addTeam({ name: norm, owner: owner.trim() });
        // endgültige DB-Version in den State spiegeln
        dispatch({ type: "UPDATE_TEAM", team: created });
        toast.success("Team angelegt");
      } catch (e) {
        console.error("Fehler beim Anlegen in Supabase:", e);
        toast.error("Team lokal gespeichert, aber nicht im Backend.");
      } finally {
        setOpenTeamDialog(false);
      }
    }
  }
  
  
  async function deleteTeam(id: string) {
    if (!confirm("Team löschen? Verknüpfte Themen werden entfernt.")) return;
  
    dispatch({ type: "DELETE_TEAM", id });
    toast.success("Team gelöscht");
  
    try {
      await dataStore.deleteTeam(id);
    } catch (e) {
      console.error("Fehler beim Löschen des Teams in Supabase:", e);
      toast.error("Team lokal gelöscht, aber Backend-Löschung fehlgeschlagen.");
    }
  }
  
  /* ---- Areas ---- */

  function beginNewArea() {
    setEditArea(undefined);
    setAreaDraft({ name: "", contact: "" });
    setOpenAreaDialog(true);
  }

  function beginEditArea(a: Area) {
    setEditArea(a);
    setAreaDraft({ ...a });
    setOpenAreaDialog(true);
  }

  async function saveArea(name: string, contact?: string) {
    // ... Validierung & Duplicate-Check wie bisher ...
  
    const norm = name.trim();

    if (editArea) {
      const updatedLocal: Area = {
        ...editArea,
        name: norm,
        contact: contact?.trim() || "",
      };
      dispatch({ type: "UPDATE_AREA", area: updatedLocal });
  
      try {
        const updatedFromDb = await dataStore.updateArea(updatedLocal);
        dispatch({ type: "UPDATE_AREA", area: updatedFromDb });
        toast.success("Bereich aktualisiert");
      } catch (e) {
        console.error("Fehler beim Update Bereich:", e);
        toast.error("Bereich lokal aktualisiert, aber nicht im Backend.");
      } finally {
        setOpenAreaDialog(false);
      }
    } else {
      const temp: Area = {
        id: uid(),
        name: norm,
        contact: contact?.trim() || "",
      };
      dispatch({ type: "ADD_AREA", area: temp });
  
      try {
        const created = await dataStore.addArea({
          name: norm,
          contact: contact?.trim() || "",
        });
        dispatch({ type: "UPDATE_AREA", area: created });
        toast.success("Bereich angelegt");
      } catch (e) {
        console.error("Fehler beim Anlegen Bereich:", e);
        toast.error("Bereich lokal gespeichert, aber nicht im Backend.");
      } finally {
        setOpenAreaDialog(false);
      }
    }
  }
  
  
  async function deleteArea(id: string) {
    if (
      !confirm(
        "Bereich löschen? Er wird aus Themen entfernt; Logs zum Bereich werden gelöscht."
      )
    )
      return;
  
    dispatch({ type: "DELETE_AREA", id });
    toast.success("Bereich gelöscht");
  
    try {
      await dataStore.deleteArea(id);
    } catch (e) {
      console.error("Fehler beim Löschen des Bereichs in Supabase:", e);
      toast.error("Bereich lokal gelöscht, aber Backend-Löschung fehlgeschlagen.");
    }
  }

  /* ---- Topics ---- */

  function openNewTopic() {
    if (state.teams.length === 0) {
      toast("Bitte zuerst mindestens ein Team anlegen.");
    }
    setEditTopic(undefined);
    setTopicDraft({
      title: "",
      teamId: state.teams[0]?.id,
      areaIds: "",
      cadence: undefined,
      startDate: undefined,
      dueStrategy: undefined,
      expectedDeliverable: "",
      priority: "medium",
      status: "planned",
      tags: "",
    });
    setOpenTopicDialog(true);
  }

  function openEditTopic(t: Topic) {
    setEditTopic(t);
    setTopicDraft({ ...t });
    setOpenTopicDialog(true);
  }

  function validateTopic(t: Partial<Topic>): string | null {
    if (!t.title || t.title.trim().length < 3)
      return "Titel zu kurz (min. 3 Zeichen)";
    if (!t.teamId) return "Bitte Team wählen";
    const dup = state.topics.some(
      (x) =>
        x.title.trim().toLowerCase() === t.title!.trim().toLowerCase() &&
        x.id !== (editTopic?.id || "")
    );
    if (dup) return "Ein Thema mit diesem Titel existiert bereits";
    return null;
  }

  async function saveTopic(draft: Partial<Topic> | undefined, existing?: Topic) {
    if (!draft) return;
    const msg = validateTopic(draft);
    if (msg) {
      toast.error(msg);
      return;
    }
  
    const areaIds =
      (draft.areaIds ??
        existing?.areaIds ??
        "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .join(",");
  
    if (existing) {
      // UPDATE
      const localTopic: Topic = {
        ...existing,
        title: draft.title!.trim(),
        teamId: draft.teamId!,
        areaIds,
        expectedDeliverable:
          draft.expectedDeliverable ?? existing.expectedDeliverable,
        priority: (draft.priority as Priority) ?? existing.priority,
        status: (draft.status as Status) ?? existing.status,
        cadence: (draft.cadence as Cadence) ?? existing.cadence,
        dueStrategy:
          (draft.dueStrategy as Topic["dueStrategy"]) ?? existing.dueStrategy,
        dueOffsetDays: draft.dueOffsetDays ?? existing.dueOffsetDays,
        startDate: draft.startDate ?? existing.startDate,
        tags: draft.tags ?? existing.tags,
        lastRequestDate: draft.lastRequestDate ?? existing.lastRequestDate,
        nextRequestDate:
          draft.nextRequestDate ??
          existing.nextRequestDate ??
          cadenceNextDate(
            draft.startDate ?? existing.startDate!,
            (draft.cadence as Cadence) ?? existing.cadence!,
            draft.lastRequestDate ?? existing.lastRequestDate
          ),
      };
  
      dispatch({ type: "UPDATE_TOPIC", topic: localTopic });
  
      try {
        const updated = await dataStore.updateTopic(localTopic);
        dispatch({ type: "UPDATE_TOPIC", topic: updated });
        toast.success("Thema aktualisiert");
      } catch (e) {
        console.error("Fehler beim Speichern des Themas in Supabase:", e);
        toast.error("Thema lokal gespeichert, aber nicht im Backend.");
      } finally {
        setOpenTopicDialog(false);
      }
    } else {
      // CREATE
      const commons: Omit<Topic, "id"> = {
        teamId: draft.teamId!,
        title: draft.title!.trim(),
        areaIds,
        expectedDeliverable: draft.expectedDeliverable ?? "",
        priority: (draft.priority as Priority) ?? "medium",
        status: (draft.status as Status) ?? "planned",
        cadence: (draft.cadence as Cadence) ?? "one-off",
        dueStrategy:
          (draft.dueStrategy as Topic["dueStrategy"]) ?? "fixed-date",
        dueOffsetDays: draft.dueOffsetDays,
        startDate:
          draft.startDate || new Date().toISOString().slice(0, 10),
        tags: draft.tags ?? "",
        lastRequestDate: draft.lastRequestDate,
        nextRequestDate:
          draft.nextRequestDate ??
          cadenceNextDate(
            draft.startDate || new Date().toISOString().slice(0, 10),
            (draft.cadence as Cadence) ?? "one-off",
            draft.lastRequestDate
          ),
      };
  
      // optimistic local add (temporäre ID)
      const temp: Topic = { id: uid(), ...commons };
      dispatch({ type: "ADD_TOPIC", topic: temp });
  
      try {
        const created = await dataStore.addTopic(commons);
        dispatch({ type: "UPDATE_TOPIC", topic: created });
        toast.success("Thema angelegt");
      } catch (e) {
        console.error("Fehler beim Speichern des Themas in Supabase:", e);
        toast.error("Thema lokal gespeichert, aber nicht im Backend.");
      } finally {
        setOpenTopicDialog(false);
      }
    }
  }  
  
  
  async function deleteTopic(id: string) {
    if (!confirm("Thema löschen? Alle zugehörigen Logs werden entfernt.")) return;
  
    // erst lokal
    dispatch({ type: "DELETE_TOPIC", id });
    toast.success("Thema gelöscht");
  
    try {
      await dataStore.deleteTopic(id);
    } catch (e) {
      console.error("Fehler beim Löschen in Supabase:", e);
      toast.error("Thema lokal gelöscht, aber Backend-Löschung fehlgeschlagen.");
    }
  }
  
  /* ---- Logs ---- */

  async function addLog(l: Partial<RequestLog>) {
    if (!l.topicId || !l.toAreaId) {
      toast.error("Bitte Topic und Bereich wählen");
      return;
    }
  
    const logInput: Omit<RequestLog, "id"> = {
      topicId: l.topicId!,
      toAreaId: l.toAreaId!,
      date: l.date || new Date().toISOString().slice(0, 10),
      sentBy: l.sentBy || "Unbekannt",
      notes: l.notes || "",
      outcome: (l.outcome as any) || "sent",
    };
  
    try {
      // 1) in Supabase anlegen → echte ID zurück
      const created = await dataStore.addLog(logInput);
  
      // 2) in den lokalen State stecken
      dispatch({ type: "ADD_LOG", log: created });
  
      // 3) Topic-Next-Date aktualisieren
      const topic = state.topics.find((t) => t.id === created.topicId);
      if (topic) {
        const updated: Topic = {
          ...topic,
          lastRequestDate: created.date,
          nextRequestDate:
            topic.startDate && topic.cadence
              ? cadenceNextDate(topic.startDate, topic.cadence, created.date)
              : topic.nextRequestDate,
        };
        dispatch({ type: "UPDATE_TOPIC", topic: updated });
      }
  
      toast.success("Protokoll gespeichert");
    } catch (e) {
      console.error("Fehler beim Speichern des Logs in Supabase:", e);
      toast.error("Protokoll konnte nicht gespeichert werden.");
    } finally {
      setOpenLogDialog(false);
    }
  }  
    

  function deleteLog(id: string) {
    dispatch({ type: "DELETE_LOG", id });
    toast("Protokoll gelöscht");
  }

  /* ---- Suche / Filter ---- */

  const filteredTopics = React.useMemo(() => {
    const Q = query.trim().toLowerCase();
    return state.topics.filter((t) => {
      if (fltTeam !== "all" && t.teamId !== fltTeam) return false;
      if (fltArea !== "all") {
        const ids = t.areaIds
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (!ids.includes(fltArea)) return false;
      }
      if (fltStatus !== "all" && t.status !== (fltStatus as Status))
        return false;
      if (fltCadence !== "all" && (t.cadence || "") !== fltCadence)
        return false;
      if (fltPriority !== "all" && t.priority !== (fltPriority as Priority))
        return false;
      const due = getDue(t);
      if (fltFrom && (!due || due < fltFrom)) return false;
      if (fltTo && (!due || due > fltTo)) return false;
      if (fltTag && !(t.tags || "").toLowerCase().includes(fltTag.toLowerCase()))
        return false;
      if (!Q) return true;
      return (
        (t.title + " " + (t.description || "") + " " + (t.tags || ""))
          .toLowerCase()
          .includes(Q)
      );
    });
  }, [
    state.topics,
    query,
    fltTeam,
    fltArea,
    fltStatus,
    fltCadence,
    fltPriority,
    fltFrom,
    fltTo,
    fltTag,
  ]);

  /* ---- KPIs ---- */

  const kpi = React.useMemo(() => {
    const todayISO = new Date().toISOString().slice(0, 10);
    const inDays = (n: number) => addDaysISO(todayISO, n);

    let next7 = 0;
    let next30 = 0;
    let overdue = 0;
    const perArea: Record<string, number> = {};
    const perTeam: Record<string, number> = {};
    const months: { label: string; count: number }[] = [];

    for (let i = 0; i < 12; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() + i);
      const label = `${String(d.getMonth() + 1).padStart(2, "0")}.${String(
        d.getFullYear()
      ).slice(-2)}`;
      months.push({ label, count: 0 });
    }

    filteredTopics.forEach((t) => {
      const due = getDue(t);
      if (!due) return;
      if (due >= todayISO && due <= inDays(7)) next7++;
      if (due >= todayISO && due <= inDays(30)) next30++;
      if (isOverdue(due)) overdue++;

      t.areaIds
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((id) => {
          perArea[id] = (perArea[id] || 0) + 1;
        });
      perTeam[t.teamId] = (perTeam[t.teamId] || 0) + 1;

      const d = new Date(due + "T00:00:00");
      const key = `${String(d.getMonth() + 1).padStart(2, "0")}.${String(
        d.getFullYear()
      ).slice(-2)}`;
      const m = months.find((x) => x.label === key);
      if (m) m.count++;
    });

    return { next7, next30, overdue, perArea, perTeam, months };
  }, [filteredTopics]);

  /* ---- Calendar Data ---- */

  const calendarDays = React.useMemo(() => {
    const cursor = calendarCursor;
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const firstWeekday = (first.getDay() + 6) % 7; // Mo=0
    const days: { date: Date; iso: string; items: Topic[] }[] = [];
    for (let i = 0; i < firstWeekday; i++) {
      const d = new Date(first);
      d.setDate(first.getDate() - (firstWeekday - i));
      const iso = d.toISOString().slice(0, 10);
      days.push({ date: d, iso, items: [] });
    }
    const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    for (let day = 1; day <= last.getDate(); day++) {
      const d = new Date(cursor.getFullYear(), cursor.getMonth(), day);
      const iso = d.toISOString().slice(0, 10);
      days.push({
        date: d,
        iso,
        items: filteredTopics.filter((t) => getDue(t) === iso),
      });
    }
    while (days.length % 7 !== 0) {
      const d = new Date(days[days.length - 1].date);
      d.setDate(d.getDate() + 1);
      const iso = d.toISOString().slice(0, 10);
      days.push({ date: d, iso, items: [] });
    }
    return days;
  }, [calendarCursor, filteredTopics]);

  /* ===========================================================
     Render
     =========================================================== */

  const hasAnyData =
    state.teams.length || state.areas.length || state.topics.length;

      const exportJSON = () => {
        try {
          const payload = JSON.stringify(state, null, 2);
          const blob = new Blob([payload], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "work-request-planner-state.json";
          a.click();
          URL.revokeObjectURL(url);
        } catch (e) {
          console.error("JSON-Export fehlgeschlagen", e);
        }
      };
    
      const exportCSV = () => {
        try {
          const header = [
            "id",
            "teamId",
            "title",
            "description",
            "areaIds",
            "cadence",
            "startDate",
            "dueStrategy",
            "dueOffsetDays",
            "expectedDeliverable",
            "priority",
            "status",
            "tags",
            "lastRequestDate",
            "nextRequestDate",
          ];
    
          const rows = state.topics.map((t) =>
            header
              .map((key) => {
                const value = (t as any)[key];
                if (value === null || value === undefined) return "";
                const s = String(value).replace(/"/g, '""');
                return `"${s}"`;
              })
              .join(";")
          );
    
          const csv = [header.join(";"), ...rows].join("\n");
          const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "work-request-planner-topics.csv";
          a.click();
          URL.revokeObjectURL(url);
        } catch (e) {
          console.error("CSV-Export fehlgeschlagen", e);
        }
      };

        // --- JSON-Import: verstecktes File-Input + Handler -----------------
  const jsonFileInputRef = useRef<HTMLInputElement | null>(null);

  const handleJsonFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
  
    const reader = new FileReader();
  
    reader.onload = async () => {
      try {
        const text = String(reader.result || "");
        const parsed = JSON.parse(text);
  
        // Grundvalidierung
        if (
          !parsed ||
          typeof parsed !== "object" ||
          !Array.isArray(parsed.teams) ||
          !Array.isArray(parsed.areas) ||
          !Array.isArray(parsed.topics) ||
          !Array.isArray(parsed.logs)
        ) {
          toast.error("Ungültiges JSON-Format.");
          return;
        }
  
        // --- Modusabhängige Bestätigung ---
        if (importMode === "truncateAll") {
          const ok = window.confirm(
            "⚠️ ALLE vorhandenen Daten (Teams, Bereiche, Themen, Logs) in Supabase werden GELÖSCHT.\n" +
            "Dann wird die JSON komplett importiert.\n\nFortfahren?"
          );
          if (!ok) return;
  
          await dataStore.replaceAllWithSnapshot(parsed);
          dispatch({ type: "RESET_FROM_REMOTE", payload: parsed });
  
          toast.success("Alle Daten ersetzt.");
        } else {
            
          const merged: AppState = {
            teams: mergeById(state.teams, parsed.teams),
            areas: mergeById(state.areas, parsed.areas),
            topics: mergeById(state.topics, parsed.topics),
            logs: mergeById(state.logs, parsed.logs),
          };
  
          await dataStore.replaceAllWithSnapshot(merged);
          dispatch({ type: "RESET_FROM_REMOTE", payload: merged });
  
          toast.success("Daten hinzugefügt.");
        }
      } catch (err) {
        console.error("JSON-Import-Fehler:", err);
        toast.error("Import fehlgeschlagen.");
      } finally {
        if (jsonFileInputRef.current) {
          jsonFileInputRef.current.value = "";
        }
      }
    };
  
    reader.readAsText(file, "utf-8");
  };
  

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">Lade Daten …</div>;
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 text-slate-900 flex flex-col">
      <Toaster richColors closeButton />
      {/* Hidden File Input für JSON-Import */}
      <input
        ref={jsonFileInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={handleJsonFileChange}
      />
      {/* Header */}
        <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex flex-col gap-3">
              {/* Erste Zeile: Titel + Supabase-Badge + Haupt-Toolbar */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-semibold tracking-tight">
                    {STR.appTitle}
                  </h1>
                  <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs bg-accent text-accent-foreground border">
                    Supabase
                  </span>
                </div>

                {/* Aktionen rechts im Header */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Neues Thema */}
                  <Button onClick={openNewTopic}>
                    <Plus className="h-4 w-4 mr-1" />
                    {STR.actions.newTopic}
                  </Button>

                  {/* Neues Team */}
                  <Button variant="outline" onClick={beginNewTeam}>
                    <Plus className="h-4 w-4 mr-1" />
                    {STR.actions.newTeam}
                  </Button>

                  {/* Neuer Bereich */}
                  <Button variant="outline" onClick={beginNewArea}>
                    <Plus className="h-4 w-4 mr-1" />
                    {STR.actions.newArea}
                  </Button>

                  {/* 🔽 Daten-Menü: Export / Import / Demo */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline">
                        <Download className="h-4 w-4 mr-1" />
                        {STR.actions.data}
                        <ChevronDown className="h-4 w-4 ml-1" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Export</DropdownMenuLabel>
                      <DropdownMenuItem onClick={exportCSV}>
                        <Table2 className="h-4 w-4 mr-2" />
                        {STR.actions.csvExport}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={exportJSON}>
                        <FileJson className="h-4 w-4 mr-2" />
                        {STR.actions.jsonExport}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel>Import</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => setOpenImportDialog(true)}>
                        JSON importieren
                      </DropdownMenuItem>
                      </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Shortcuts-Hilfe */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Shortcuts"
                      >
                        <HelpCircle className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      / Suche · n Neues Thema · t Team · b Bereich
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>

               {/* NEUE ZEILE: User + Logout, rechtsbündig unter der Toolbar */}
              {session && (
                <div className="flex justify-end items-center gap-3 text-xs text-muted-foreground">
                  <span>{session.user?.email}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={handleLogout}
                  >
                    Logout
                  </Button>
                </div>
              )}

              <p className="text-sm text-muted-foreground">
                {STR.subtitle}
              </p>

              {/* Toolbar / Filter */}
              <Card>
                <CardContent className="py-4 space-y-3">
                  <div className="flex flex-col md:flex-row md:items-center gap-2">
                    <div className="flex items-center gap-2 md:w-96 w-full">
                      <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={STR.searchPlaceholder}
                        aria-label="Suche"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs">{STR.filters.team}</Label>
                        <Select value={fltTeam} onValueChange={setFltTeam}>
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Alle</SelectItem>
                            {state.teams.map((t) => (
                              <SelectItem key={t.id} value={t.id}>
                                {t.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs">{STR.filters.area}</Label>
                        <Select value={fltArea} onValueChange={setFltArea}>
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Alle</SelectItem>
                            {state.areas.map((a) => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs">{STR.filters.status}</Label>
                        <Select value={fltStatus} onValueChange={setFltStatus}>
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Alle</SelectItem>
                            <SelectItem value="planned">planned</SelectItem>
                            <SelectItem value="active">active</SelectItem>
                            <SelectItem value="blocked">blocked</SelectItem>
                            <SelectItem value="done">done</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      <Button variant="outline" onClick={clearFilters}>
                        <Filter className="h-4 w-4 mr-1" />
                        {STR.actions.clearFilters}
                      </Button>
                    </div>
                  </div>

                  <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">
                        {STR.filters.more}
                      </span>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm">
                          {advancedOpen ? "Weniger" : "Mehr"} Filter
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                    <CollapsibleContent className="mt-3">
                      <div className="grid md:grid-cols-6 grid-cols-2 gap-2">
                        <div className="flex items-center gap-2">
                          <Label className="text-xs">{STR.filters.cadence}</Label>
                          <Select value={fltCadence} onValueChange={setFltCadence}>
                            <SelectTrigger className="w-36">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Alle</SelectItem>
                              <SelectItem value="one-off">one-off</SelectItem>
                              <SelectItem value="weekly">weekly</SelectItem>
                              <SelectItem value="monthly">monthly</SelectItem>
                              <SelectItem value="quarterly">quarterly</SelectItem>
                              <SelectItem value="yearly">yearly</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center gap-2">
                          <Label className="text-xs">{STR.filters.priority}</Label>
                          <Select value={fltPriority} onValueChange={setFltPriority}>
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Alle</SelectItem>
                              <SelectItem value="low">low</SelectItem>
                              <SelectItem value="medium">medium</SelectItem>
                              <SelectItem value="high">high</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center gap-2">
                          <Label className="text-xs">{STR.filters.dateFrom}</Label>
                          <Input
                            type="date"
                            className="w-40"
                            value={fltFrom}
                            onChange={(e) => setFltFrom(e.target.value)}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Label className="text-xs">{STR.filters.dateTo}</Label>
                          <Input
                            type="date"
                            className="w-40"
                            value={fltTo}
                            onChange={(e) => setFltTo(e.target.value)}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Label className="text-xs">{STR.filters.tag}</Label>
                          <Input
                            className="w-40"
                            value={fltTag}
                            onChange={(e) => setFltTag(e.target.value)}
                            placeholder="z. B. audit"
                          />
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </CardContent>
              </Card>
            </div>
          </div>
        </header>

      {/* Main */}
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {!hasAnyData ? (
          <Card>
            <CardContent className="py-10 flex flex-col items-center gap-4">
              <p className="text-sm text-muted-foreground">
                Noch keine Teams, Bereiche oder Themen angelegt.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={beginNewTeam}>
                  <Plus className="h-4 w-4 mr-1" />
                  {STR.actions.newTeam}
                </Button>
                <Button variant="outline" onClick={beginNewArea}>
                  <Plus className="h-4 w-4 mr-1" />
                  {STR.actions.newArea}
                </Button>
                <Button variant="outline" onClick={openNewTopic}>
                  <Plus className="h-4 w-4 mr-1" />
                  {STR.actions.newTopic}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="overview" className="space-y-4 w-full h-full">
            <TabsList className="sticky top-0 z-30 w-full overflow-x-auto flex items-center gap-2 rounded-2xl bg-secondary/80 backdrop-blur p-2 supports-[backdrop-filter]:bg-secondary/60">
              <TabsTrigger value="overview">
                {STR.tabs.overview}
              </TabsTrigger>
              <TabsTrigger value="matrix">{STR.tabs.matrix}</TabsTrigger>
              <TabsTrigger value="calendar">
                {STR.tabs.calendar}
              </TabsTrigger>
              <TabsTrigger value="topics">
                {STR.tabs.topics}
              </TabsTrigger>
              <TabsTrigger value="logs">{STR.tabs.logs}</TabsTrigger>
              <TabsTrigger value="reports">
                {STR.tabs.reports}
              </TabsTrigger>
              <TabsTrigger value="areas">{STR.tabs.areas}</TabsTrigger>
              <TabsTrigger value="teams">{STR.tabs.teams}</TabsTrigger>
            </TabsList>

            {/* Overview */}
            <TabsContent value="overview">
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      {STR.kpis.next7}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex items-center gap-3">
                    <CalendarClock className="h-5 w-5" />
                    <div className="text-3xl font-semibold">
                      {kpi.next7}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      {STR.kpis.next30}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex items-center gap-3">
                    <CalendarDays className="h-5 w-5" />
                    <div className="text-3xl font-semibold">
                      {kpi.next30}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      {STR.kpis.overdue}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-destructive" />
                    <div className="text-3xl font-semibold text-destructive">
                      {kpi.overdue}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      Minimap Timeline
                    </CardTitle>
                    <CardDescription>
                      Nächste Fälligkeiten (12M)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-28 min-h-[112px] min-w-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={kpi.months}>
                          <XAxis dataKey="label" hide />
                          <YAxis hide />
                          <RTooltip />
                          <Line
                            type="monotone"
                            dataKey="count"
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-2 mt-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      {STR.kpis.perArea}
                    </CardTitle>
                    <CardDescription>Nach Filtern</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {Object.entries(kpi.perArea).map(([a, c]) => (
                      <Badge key={a} variant="secondary">
                        {areaName(a)}: {c}
                      </Badge>
                    ))}
                    {Object.keys(kpi.perArea).length === 0 && (
                      <span className="text-xs text-muted-foreground">
                        Keine Bereiche mit Themen
                      </span>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      {STR.kpis.perTeam}
                    </CardTitle>
                    <CardDescription>Nach Filtern</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {Object.entries(kpi.perTeam).map(([t, c]) => (
                      <Badge key={t} variant="outline">
                        {teamName(t)}: {c}
                      </Badge>
                    ))}
                    {Object.keys(kpi.perTeam).length === 0 && (
                      <span className="text-xs text-muted-foreground">
                        Keine Teams mit Themen
                      </span>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Matrix */}
            <TabsContent value="matrix">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle>Teams × Bereiche</CardTitle>
                  <CardDescription>
                    Zahl = Themen · Badge = nächste Anfrage
                  </CardDescription>
                </CardHeader>
                <CardContent className="overflow-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead>Team \\ Bereich</TableHead>
                        {state.areas.map((a) => (
                          <TableHead
                            key={a.id}
                            className="min-w-[160px]"
                          >
                            {a.name}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {state.teams.map((t) => (
                        <TableRow
                          key={t.id}
                          className="hover:bg-muted/40"
                        >
                          <TableCell className="font-medium">
                            {t.name}
                          </TableCell>
                          {state.areas.map((a) => {
                            const cell = filteredTopics.filter(
                              (tp) =>
                                tp.teamId === t.id &&
                                tp.areaIds
                                  .split(",")
                                  .map((s) => s.trim())
                                  .filter(Boolean)
                                  .includes(a.id)
                            );
                            const dues = cell
                              .map((x) => getDue(x))
                              .filter(Boolean) as string[];
                            dues.sort();
                            const next = dues[0];
                            const badge = next
                              ? isOverdue(next)
                                ? STR.calendar.overdue
                                : isDueToday(next)
                                ? STR.calendar.today
                                : next
                              : "—";
                            return (
                              <TableCell key={a.id}>
                                <div className="p-2 border rounded-lg flex items-center justify-between">
                                  <div className="text-2xl font-semibold">
                                    {cell.length}
                                  </div>
                                  <Badge
                                    variant={
                                      next && isOverdue(next)
                                        ? "destructive"
                                        : "secondary"
                                    }
                                    className="cursor-default"
                                  >
                                    {badge}
                                  </Badge>
                                </div>
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Calendar */}
            <TabsContent value="calendar">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base">
                      {STR.tabs.calendar}
                    </CardTitle>
                    <CardDescription>
                      Monatsübersicht der nächsten Fälligkeiten
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() =>
                        setCalendarCursor(
                          (p) => new Date(p.getFullYear(), p.getMonth() - 1, 1)
                        )
                      }
                    >
                      ‹
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setCalendarCursor(new Date())}
                    >
                      {STR.calendar.today}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        setCalendarCursor(
                          (p) => new Date(p.getFullYear(), p.getMonth() + 1, 1)
                        )
                      }
                    >
                      ›
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="grid grid-cols-7 gap-2">
                  {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((w) => (
                    <div
                      key={w}
                      className="text-xs font-semibold text-muted-foreground"
                    >
                      {w}
                    </div>
                  ))}

                  {calendarDays.map((d, i) => {
                    const inMonth =
                      d.date.getMonth() === calendarCursor.getMonth();
                    const items = d.items.slice(0, 3);
                    const extra = d.items.length - items.length;

                    // JSON-Export des kompletten States
                    const exportJSON = () => {
                      try {
                        const payload = JSON.stringify(state, null, 2);
                        const blob = new Blob([payload], { type: "application/json" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = "work-request-planner-state.json";
                        a.click();
                        URL.revokeObjectURL(url);
                      } catch (e) {
                        console.error("JSON-Export fehlgeschlagen", e);
                      }
                    };

                    // CSV-Export nur für Topics
                    const exportCSV = () => {
                      try {
                        const header = [
                          "id",
                          "teamId",
                          "title",
                          "description",
                          "areaIds",
                          "cadence",
                          "startDate",
                          "dueStrategy",
                          "dueOffsetDays",
                          "expectedDeliverable",
                          "priority",
                          "status",
                          "tags",
                          "lastRequestDate",
                          "nextRequestDate",
                        ];

                        const rows = state.topics.map((t) =>
                          header
                            .map((key) => {
                              const value = (t as any)[key];
                              if (value === null || value === undefined) return "";
                              // einfache CSV-Escapes
                              const s = String(value).replace(/"/g, '""');
                              return `"${s}"`;
                            })
                            .join(";")
                        );

                        const csv = [header.join(";"), ...rows].join("\n");
                        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = "work-request-planner-topics.csv";
                        a.click();
                        URL.revokeObjectURL(url);
                      } catch (e) {
                        console.error("CSV-Export fehlgeschlagen", e);
                      }
                    };

                    return (
                      <div
                        key={i}
                        className={`border rounded p-1 min-h-[92px] flex flex-col ${
                          inMonth ? "" : "opacity-50"
                        }`}
                        aria-label={`Tag ${d.iso}`}
                      >
                        <div className="text-xs flex items-center justify-between">
                          <span>{d.date.getDate()}</span>
                        </div>

                        <div className="mt-1 flex flex-col gap-1">
                          {items.map((it) => {
                            const due = it.nextRequestDate || it.startDate;
                            return (
                              <Badge
                                key={it.id}
                                variant={
                                  due && isOverdue(due)
                                    ? "destructive"
                                    : "secondary"
                                }
                                className="truncate cursor-pointer"
                                // ⬇️ HIER: statt setDetailTopic jetzt der Bearbeiten-Dialog
                                onClick={() => openEditTopic(it)}
                              >
                                {it.title}
                              </Badge>
                            );
                          })}

                          {extra > 0 && (
                            <Badge
                              variant="outline"
                              className="cursor-pointer"
                              onClick={() => {
                                setDayDialog({
                                  date: d.iso,
                                  items: d.items,
                                });
                                setOpenDayDialog(true);
                              }}
                            >
                              +{extra}
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Topics */}
            <TabsContent value="topics">
              <Card>
                <CardHeader className="flex items-center justify-between pb-2">
                  <div>
                    <CardTitle className="text-base">
                      {STR.tabs.topics}
                    </CardTitle>
                    <CardDescription>
                      Verwalte Themen, Status und Fälligkeiten
                    </CardDescription>
                  </div>
                  <Button variant="outline" onClick={openNewTopic}>
                    <Plus className="h-4 w-4 mr-1" />
                    {STR.actions.newTopic}
                  </Button>
                </CardHeader>
                <CardContent className="overflow-auto">
                  <TableCaption className="text-left mb-2">
                    {filteredTopics.length} Thema/Themen
                  </TableCaption>
                  <DataTable<Topic>
                    data={filteredTopics}
                    getRowId={(t) => t.id}
                    getCellValue={(t, key) => {
                      switch (key) {
                        case "title":
                          return t.title;
                        case "team":
                          return teamName(t.teamId);
                        case "areas":
                          return t.areaIds;
                        case "cadence":
                          return t.cadence || "";
                        case "due":
                          return getDue(t) || "";
                        case "status":
                          return t.status;
                        case "priority":
                          return t.priority;
                        default:
                          return "";
                      }
                    }}
                    columns={[
                      {
                        key: "title",
                        label: "Titel / Deliverable",
                        sortable: true,
                        filterable: true,
                        width: 220,
                        render: (t) => (
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium">
                              {t.title}
                            </span>
                            {t.expectedDeliverable && (
                              <span className="text-xs text-muted-foreground">
                                {t.expectedDeliverable}
                              </span>
                            )}
                          </div>
                        ),
                      },
                      {
                        key: "team",
                        label: "Team",
                        sortable: true,
                        filterable: true,
                        width: 120,
                        render: (t) => teamName(t.teamId),
                      },
                      {
                        key: "areas",
                        label: "Bereiche",
                        sortable: false,
                        filterable: true,
                        width: 200,
                        render: (t) =>
                          t.areaIds
                            .split(",")
                            .map((a) => a.trim())
                            .filter(Boolean)
                            .map((id) => areaName(id))
                            .join(", "),
                      },
                      {
                        key: "cadence",
                        label: "Frequenz",
                        sortable: true,
                        filterable: true,
                        width: 100,
                        render: (t) => t.cadence || "—",
                      },
                      {
                        key: "due",
                        label: "Nächste Fälligkeit",
                        sortable: true,
                        filterable: true,
                        width: 140,
                        render: (t) => {
                          const due = getDue(t);
                          return (
                            <span
                              className={`text-sm ${
                                due && isOverdue(due)
                                  ? "text-destructive font-medium"
                                  : due && isDueToday(due)
                                  ? "font-medium"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {due || "—"}
                            </span>
                          );
                        },
                      },
                      {
                        key: "status",
                        label: "Status",
                        sortable: true,
                        filterable: true,
                        width: 90,
                        render: (t) => <StatusBadge s={t.status} />,
                      },
                      {
                        key: "priority",
                        label: "Prio",
                        sortable: true,
                        filterable: true,
                        width: 80,
                        render: (t) => <PriorityBadge p={t.priority} />,
                      },
                      {
                        key: "actions",
                        label: "Aktionen",
                        sortable: false,
                        filterable: false,
                        width: 120,
                        render: (t) => (
                          <div className="flex flex-wrap gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="Details"
                              onClick={() => setDetailTopic(t)}
                            >
                              <Info className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="Bearbeiten"
                              onClick={() => openEditTopic(t)}
                            >
                              <Settings2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="Löschen"
                              onClick={() => deleteTopic(t.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ),
                      },
                    ]}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Logs */}
            <TabsContent value="logs">
              <Card>
                <CardHeader className="flex items-center justify-between pb-2">
                  <div>
                    <CardTitle className="text-base">
                      {STR.tabs.logs}
                    </CardTitle>
                    <CardDescription>
                      Chronik der versendeten Anfragen
                    </CardDescription>
                  </div>
                  <Button onClick={() => setOpenLogDialog(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    {STR.actions.newLog}
                  </Button>
                </CardHeader>
                <CardContent className="overflow-auto">
                  <TableCaption className="text-left mb-2">
                    {state.logs.length} Eintrag/Einträge
                  </TableCaption>
                  <DataTable<RequestLog>
                    data={state.logs}
                    getRowId={(l) => l.id}
                    getCellValue={(l, key) => {
                      switch (key) {
                        case "date":
                          return l.date;
                        case "topic":
                          return (
                            state.topics.find((t) => t.id === l.topicId)
                              ?.title || l.topicId
                          );
                        case "area":
                          return areaName(l.toAreaId);
                        case "sentBy":
                          return l.sentBy;
                        case "outcome":
                          return l.outcome;
                        case "notes":
                          return l.notes || "";
                        default:
                          return "";
                      }
                    }}
                    columns={[
                      {
                        key: "date",
                        label: "Datum",
                        sortable: true,
                        filterable: true,
                        width: 110,
                        render: (l) => l.date,
                      },
                      {
                        key: "topic",
                        label: "Topic",
                        sortable: true,
                        filterable: true,
                        width: 220,
                        render: (l) =>
                          state.topics.find((t) => t.id === l.topicId)
                            ?.title || l.topicId,
                      },
                      {
                        key: "area",
                        label: "Bereich",
                        sortable: true,
                        filterable: true,
                        width: 160,
                        render: (l) => areaName(l.toAreaId),
                      },
                      {
                        key: "sentBy",
                        label: "Von",
                        sortable: true,
                        filterable: true,
                        width: 140,
                        render: (l) => l.sentBy,
                      },
                      {
                        key: "outcome",
                        label: "Outcome",
                        sortable: true,
                        filterable: true,
                        width: 110,
                        render: (l) => (
                          <Badge variant="outline">{l.outcome}</Badge>
                        ),
                      },
                      {
                        key: "notes",
                        label: "Notizen",
                        sortable: false,
                        filterable: true,
                        width: 220,
                        render: (l) => l.notes || "",
                      },
                      {
                        key: "actions",
                        label: "Aktionen",
                        sortable: false,
                        filterable: false,
                        width: 80,
                        render: (l) => (
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Löschen"
                            onClick={() => deleteLog(l.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ),
                      },
                    ]}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Reports (kompakt) */}
            <TabsContent value="reports">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">
                      {STR.reports.r1}
                    </CardTitle>
                    <CardDescription>Nach Filtern</CardDescription>
                  </CardHeader>
                  <CardContent className="h-64 min-h-[256px] min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={kpi.months}>
                        <XAxis dataKey="label" />
                        <YAxis allowDecimals={false} />
                        <RTooltip />
                        <Bar dataKey="count" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">
                      {STR.reports.r2}
                    </CardTitle>
                    <CardDescription>Top-Bereiche</CardDescription>
                  </CardHeader>
                  <CardContent className="h-64 min-h-[256px] min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={Object.entries(kpi.perArea)
                          .map(([a, c]) => ({
                            area: areaName(a),
                            count: c,
                          }))
                          .sort((a, b) => b.count - a.count)
                          .slice(0, 10)}
                      >
                        <XAxis dataKey="area" />
                        <YAxis allowDecimals={false} />
                        <RTooltip />
                        <Bar dataKey="count" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Areas */}
            <TabsContent value="areas">
              <Card>
                <CardHeader className="flex items-center justify-between pb-2">
                  <div>
                    <CardTitle className="text-base">
                      {STR.tabs.areas}
                    </CardTitle>
                    <CardDescription>Verwalte Bereiche</CardDescription>
                  </div>
                  <Button variant="outline" onClick={beginNewArea}>
                    <Plus className="h-4 w-4 mr-1" />
                    {STR.actions.newArea}
                  </Button>
                </CardHeader>
                <CardContent className="overflow-auto">
                  <TableCaption className="text-left mb-2">
                    {state.areas.length} Bereich(e)
                  </TableCaption>
                  <DataTable<Area>
                    data={state.areas}
                    getRowId={(a) => a.id}
                    getCellValue={(a, key) => {
                      switch (key) {
                        case "name":
                          return a.name;
                        case "contact":
                          return a.contact || "";
                        case "linked":
                          return state.topics.filter((t) =>
                            (t.areaIds || "")
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean)
                              .includes(a.id)
                          ).length;
                        default:
                          return "";
                      }
                    }}
                    columns={[
                      {
                        key: "name",
                        label: "Name",
                        sortable: true,
                        filterable: true,
                        width: 200,
                        render: (a) => a.name,
                      },
                      {
                        key: "contact",
                        label: "Kontakt",
                        sortable: true,
                        filterable: true,
                        width: 220,
                        render: (a) => a.contact || "—",
                      },
                      {
                        key: "linked",
                        label: "Verkn. Themen",
                        sortable: true,
                        filterable: false,
                        width: 110,
                        render: (a) =>
                          state.topics.filter((t) =>
                            (t.areaIds || "")
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean)
                              .includes(a.id)
                          ).length,
                      },
                      {
                        key: "actions",
                        label: "Aktionen",
                        sortable: false,
                        filterable: false,
                        width: 120,
                        render: (a) => (
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="Bearbeiten"
                              onClick={() => beginEditArea(a)}
                            >
                              <Settings2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="Löschen"
                              onClick={() => deleteArea(a.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ),
                      },
                    ]}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Teams */}
            <TabsContent value="teams">
              <Card>
                <CardHeader className="flex items-center justify-between pb-2">
                  <div>
                    <CardTitle className="text-base">
                      {STR.tabs.teams}
                    </CardTitle>
                    <CardDescription>Verwalte Teams</CardDescription>
                  </div>
                  <Button variant="outline" onClick={beginNewTeam}>
                    <Plus className="h-4 w-4 mr-1" />
                    {STR.actions.newTeam}
                  </Button>
                </CardHeader>
                <CardContent className="overflow-auto">
                  <TableCaption className="text-left mb-2">
                    {state.teams.length} Team(s)
                  </TableCaption>
                  <DataTable<Team>
                    data={state.teams}
                    getRowId={(t) => t.id}
                    getCellValue={(t, key) => {
                      switch (key) {
                        case "name":
                          return t.name;
                        case "owner":
                          return t.owner;
                        case "linked":
                          return state.topics.filter(
                            (tp) => tp.teamId === t.id
                          ).length;
                        default:
                          return "";
                      }
                    }}
                    columns={[
                      {
                        key: "name",
                        label: "Name",
                        sortable: true,
                        filterable: true,
                        width: 200,
                        render: (t) => t.name,
                      },
                      {
                        key: "owner",
                        label: "Owner",
                        sortable: true,
                        filterable: true,
                        width: 220,
                        render: (t) => t.owner,
                      },
                      {
                        key: "linked",
                        label: "Verkn. Themen",
                        sortable: true,
                        filterable: false,
                        width: 110,
                        render: (t) =>
                          state.topics.filter(
                            (tp) => tp.teamId === t.id
                          ).length,
                      },
                      {
                        key: "actions",
                        label: "Aktionen",
                        sortable: false,
                        filterable: false,
                        width: 120,
                        render: (t) => (
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="Bearbeiten"
                              onClick={() => beginEditTeam(t)}
                            >
                              <Settings2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="Löschen"
                              onClick={() => deleteTeam(t.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ),
                      },
                    ]}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </main>

      {/* Topic Dialog */}
      <Dialog
        open={openTopicDialog}
        onOpenChange={setOpenTopicDialog}
      >
        <DialogContent
          className="max-w-2xl max-h-[90vh] flex flex-col"
          aria-describedby="topic-desc"
        >
          <DialogHeader>
            <DialogTitle>{STR.dialogs.topicTitle}</DialogTitle>
            <DialogDescription id="topic-desc" className="sr-only">
              Formular zum Anlegen oder Bearbeiten eines Themas.
              Mindestens Titel und Team sind erforderlich. Bereiche
              und Fälligkeiten können optional ergänzt werden.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            {topicDraft && (
              <TopicForm
                draft={topicDraft}
                setDraft={setTopicDraft}
                teams={state.teams}
                areas={state.areas}
              />
            )}
            {topicDraft?.areaIds &&
              areaMissingContact(topicDraft.areaIds) && (
                <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  {STR.details.missingContact}
                </div>
              )}
          </div>
          <DialogFooter className="flex justify-between">
            <div />
            <div className="flex gap-2">
              {editTopic && (
                <Button
                  variant="destructive"
                  onClick={() => {
                    deleteTopic(editTopic.id);
                    setOpenTopicDialog(false);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Löschen
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => setOpenTopicDialog(false)}
              >
                <X className="h-4 w-4 mr-1" />
                Abbrechen
              </Button>
              <Button onClick={() => saveTopic(topicDraft, editTopic)}>
                <Download className="h-4 w-4 mr-1 rotate-180" />
                Speichern
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log Dialog */}
      <Dialog open={openLogDialog} onOpenChange={setOpenLogDialog}>
        <DialogContent aria-describedby="log-desc">
          <DialogHeader>
            <DialogTitle>{STR.dialogs.logTitle}</DialogTitle>
            <DialogDescription id="log-desc" className="sr-only">
              Formular zum Protokollieren einer Anfrage. Bitte Topic,
              Bereich, Datum und Ergebnis angeben.
            </DialogDescription>
          </DialogHeader>
          <LogForm
            topics={state.topics}
            areas={state.areas}
            onSubmit={addLog}
          />
        </DialogContent>
      </Dialog>

      {/* Team Dialog */}
      <Dialog open={openTeamDialog} onOpenChange={setOpenTeamDialog}>
        <DialogContent aria-describedby="team-desc">
          <DialogHeader>
            <DialogTitle>{STR.dialogs.teamTitle}</DialogTitle>
            <DialogDescription id="team-desc" className="sr-only">
              Formular zum Anlegen oder Bearbeiten eines Teams.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label>Name*</Label>
              <Input
                value={teamDraft?.name || ""}
                onChange={(e) =>
                  setTeamDraft({
                    ...(teamDraft || {}),
                    name: e.target.value,
                  })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Owner</Label>
              <Input
                value={teamDraft?.owner || ""}
                onChange={(e) =>
                  setTeamDraft({
                    ...(teamDraft || {}),
                    owner: e.target.value,
                  })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpenTeamDialog(false)}
            >
              <X className="h-4 w-4 mr-1" />
              Abbrechen
            </Button>
            <Button
              onClick={() =>
                saveTeam(teamDraft?.name || "", teamDraft?.owner || "")
              }
            >
              <Download className="h-4 w-4 mr-1 rotate-180" />
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Area Dialog */}
      <Dialog open={openAreaDialog} onOpenChange={setOpenAreaDialog}>
        <DialogContent aria-describedby="area-desc">
          <DialogHeader>
            <DialogTitle>{STR.dialogs.areaTitle}</DialogTitle>
            <DialogDescription id="area-desc" className="sr-only">
              Formular zum Anlegen oder Bearbeiten eines Bereichs.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label>Name*</Label>
              <Input
                value={areaDraft?.name || ""}
                onChange={(e) =>
                  setAreaDraft({
                    ...(areaDraft || {}),
                    name: e.target.value,
                  })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Kontakt (optional)</Label>
              <Input
                value={areaDraft?.contact || ""}
                onChange={(e) =>
                  setAreaDraft({
                    ...(areaDraft || {}),
                    contact: e.target.value,
                  })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpenAreaDialog(false)}
            >
              <X className="h-4 w-4 mr-1" />
              Abbrechen
            </Button>
            <Button
              onClick={() =>
                saveArea(
                  areaDraft?.name || "",
                  areaDraft?.contact || undefined
                )
              }
            >
              <Download className="h-4 w-4 mr-1 rotate-180" />
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Day Dialog (Calendar "+2" etc.) */}
      <Dialog
        open={openDayDialog}
        onOpenChange={(o) => {
          setOpenDayDialog(o);
          if (!o) setDayDialog(null);
        }}
      >
        <DialogContent
          className="max-w-lg max-h-[80vh] flex flex-col"
          aria-describedby="day-desc"
        >
          <DialogHeader>
            <DialogTitle>{STR.dialogs.dayTitle}</DialogTitle>
            <DialogDescription id="day-desc" className="sr-only">
              Alle Themen, die an diesem Tag fällig sind.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
            {dayDialog?.items.map((t) => (
              <div
                key={t.id}
                className="border rounded-lg px-3 py-2 flex flex-col gap-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-sm">
                    {t.title}
                  </div>
                  <StatusBadge s={t.status} />
                </div>
                <div className="text-xs text-muted-foreground">
                  Team: {teamName(t.teamId)}
                </div>
                {t.areaIds && (
                  <div className="text-xs text-muted-foreground">
                    Bereiche:{" "}
                    {t.areaIds
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .map((id) => areaName(id))
                      .join(", ")}
                  </div>
                )}
                <div className="flex justify-end mt-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Bearbeiten"
                    onClick={() => {
                      openEditTopic(t);
                      setOpenDayDialog(false);
                    }}
                  >
                    <Info className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {dayDialog && dayDialog.items.length === 0 && (
              <div className="text-sm text-muted-foreground">
                {STR.calendar.none}
              </div>
            )}
          </div>
          <DialogFooter className="flex justify-end">
            <Button
              variant="outline"
              onClick={() => setOpenDayDialog(false)}
            >
              <X className="h-4 w-4 mr-1" />
              Schließen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={openImportDialog} onOpenChange={setOpenImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Daten importieren</DialogTitle>
            <DialogDescription>
              Wähle zuerst den Import-Modus und starte dann den Import mit einer JSON-Datei.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="font-medium">Import-Modus</Label>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="importMode"
                    value="append"
                    checked={importMode === "append"}
                    onChange={() => setImportMode("append")}
                  />
                  <span>Hinzufügen (bestehende Daten bleiben erhalten)</span>
                </label>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="importMode"
                    value="truncateAll"
                    checked={importMode === "truncateAll"}
                    onChange={() => setImportMode("truncateAll")}
                  />
                  <span>
                    Komplett ersetzen (alle vorhandenen Daten in Supabase werden gelöscht)
                  </span>
                </label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenImportDialog(false)}>
              <X className="h-4 w-4 mr-1" />
              Abbrechen
            </Button>
            <Button
              onClick={() => {
                setOpenImportDialog(false);
                jsonFileInputRef.current?.click(); // 👉 startet Dateiauswahl + handleJsonFileChange
              }}
            >
              <Import className="h-4 w-4 mr-1" />
              Datei auswählen & importieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Detail Sheet */}
      <Sheet
        open={!!detailTopic}
        onOpenChange={(o) => !o && setDetailTopic(null)}
      >
        <SheetContent className="sm:max-w-lg">
          {detailTopic && (
            <>
              <SheetHeader>
                <SheetTitle className="truncate">
                  {detailTopic.title}
                </SheetTitle>
              </SheetHeader>
              
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <StatusBadge s={detailTopic.status} />
                  <PriorityBadge p={detailTopic.priority} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="font-medium text-xs uppercase text-muted-foreground">
                      Team
                    </div>
                    <div>{teamName(detailTopic.teamId)}</div>
                  </div>
                  <div>
                    <div className="font-medium text-xs uppercase text-muted-foreground">
                      Bereiche
                    </div>
                    <div>
                      {detailTopic.areaIds
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean)
                        .map((id) => areaName(id))
                        .join(", ") || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="font-medium text-xs uppercase text-muted-foreground">
                      Deliverable
                    </div>
                    <div>
                      {detailTopic.expectedDeliverable || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="font-medium text-xs uppercase text-muted-foreground">
                      Frequenz
                    </div>
                    <div>{detailTopic.cadence || "—"}</div>
                  </div>
                  <div>
                    <div className="font-medium text-xs uppercase text-muted-foreground">
                      Startdatum
                    </div>
                    <div>{detailTopic.startDate || "—"}</div>
                  </div>
                  <div>
                    <div className="font-medium text-xs uppercase text-muted-foreground">
                      Nächste Fälligkeit
                    </div>
                    <div>{getDue(detailTopic) || "—"}</div>
                  </div>
                </div>
                {detailTopic.description && (
                  <div>
                    <div className="font-medium text-xs uppercase text-muted-foreground">
                      Beschreibung
                    </div>
                    <div>{detailTopic.description}</div>
                  </div>
                )}
                {detailTopic.tags && (
                  <div>
                    <div className="font-medium text-xs uppercase text-muted-foreground">
                      Tags
                    </div>
                    <div>{detailTopic.tags}</div>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ===========================================================
   README (Kurz, im Code)
   ===========================================================
- Architektur:
  - Single-File-React-Komponente mit useReducer-State für Teams, Bereiche,
    Themen und RequestLogs.
  - Persistenz via localStorage (Key "work-request-planner:v2").

- Datenmodell:
  - Team, Area, Topic, RequestLog wie im ursprünglichen Datamodel.
  - Topic kann ohne Datum/Bereich angelegt werden; Startdatum/Cadence optional,
    nächste Fälligkeit wird bei Bedarf aus cadenceNextDate() berechnet.
  - Mehrere Bereiche je Topic via areaIds (kommagetrennt), in der UI über Chips
    auswählbar.

- UX:
  - Sticky-Header mit globalen Filtern & Suche.
  - Tabs: Übersicht, Matrix, Kalender, Themen, Protokoll, Reports, Bereiche, Teams.
  - Dialoge für neues Team, neuen Bereich, neues Thema, neue Logs; alle mit
    max-h und Scroll, sodass Save/Cancel auf Laptop-Displays sichtbar bleiben.
  - Kalender: Klick auf Badge öffnet Topic-Details; Klick auf +N öffnet
    Tagesdialog mit allen Einträgen.

- Tabellen:
  - In Tabs Themen, Protokoll, Bereiche, Teams: DataTable-Komponente mit
    Spaltensortierung (Header-Klick), Spaltenfilter (Input unter Header),
    Spalten-Resize (Drag an rechter Kante) und multiline-Zeilen über
    whitespace-normal/break-words.
  - Kein doppelter Name bei Teams/Bereichen/Themen (Validierung im Save).

- Erweiterungspunkte:
  - Einfach ergänzbar um:
    - Rollen/Rechte (z. B. readonly-Ansicht für externe Bereiche),
    - ICS-Export je Topic,
    - E-Mail-Reminder (Template-Generator statt Versand),
    - Webhook-Stubs für spätere Integrationen.
*/
