```tsx
import React, { useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { toast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";
import {
  CalendarDays,
  CalendarClock,
  Clock,
  Download,
  FileJson,
  Filter,
  Import,
  Info,
  Loader2,
  LogIn,
  Logs,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Table2,
  Trash2,
  Upload,
  X,
  Copy,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

/** ==============================
 * i18n Strings
 * ============================== */
const STR = {
  appTitle: "Work Request Planner",
  searchPlaceholder: "Suche in Themen (Titel, Beschreibung, Tags) …",
  tabs: {
    overview: "Übersicht",
    matrix: "Matrix",
    calendar: "Kalender",
    topics: "Themen",
    logs: "Protokoll",
    reports: "Reports",
  },
  kpis: {
    next7: "Fällig in 7 Tagen",
    next30: "Fällig in 30 Tagen",
    overdue: "Überfällig",
    perArea: "Themen je Bereich",
    perTeam: "Themen je Team",
  },
  actions: {
    newTopic: "Neues Thema",
    newLog: "Neue Anfrage protokollieren",
    demoLoad: "Demo-Daten laden",
    demoClear: "Demo-Daten entfernen",
    export: "Export",
    import: "Import",
    csvExport: "CSV (Themen)",
    jsonExport: "JSON (State)",
    jsonImport: "JSON importieren",
    duplicate: "Duplizieren",
    bulk: "Bulk-Aktionen",
    statusTo: "Status setzen: ",
    cadenceTo: "Frequenz setzen: ",
    clearFilters: "Filter zurücksetzen",
  },
  filters: {
    team: "Team",
    area: "Bereich",
    status: "Status",
    cadence: "Frequenz",
    priority: "Priorität",
    dateFrom: "Von",
    dateTo: "Bis",
    tag: "Tag",
  },
  details: {
    nextDue: "Nächste Fälligkeit",
    deliverable: "Deliverable",
    cadence: "Frequenz",
    dueStrategy: "Fälligkeitsstrategie",
    lastRequest: "Letzte Anfrage",
    areas: "Betroffene Bereiche",
    owner: "Verantwortlich",
    missingContact: "Hinweis: Für mindestens einen Bereich ist kein Kontakt hinterlegt.",
  },
  validations: {
    titleMin: "Titel muss mindestens 3 Zeichen lang sein.",
    startDateIso: "Startdatum muss ein gültiges ISO-Datum (YYYY-MM-DD) sein.",
    relativeOffset: "Bei relativer Fälligkeit ist dueOffsetDays erforderlich.",
    teamAreaExist: "Team und Bereiche müssen existieren.",
  },
  calendar: {
    today: "Heute",
    due: "fällig",
    overdue: "überfällig",
  },
  empty: {
    noData: "Noch keine Daten.",
    loadDemo: "Demo-Daten laden?",
  },
  dialogs: {
    topicTitle: "Thema anlegen / bearbeiten",
    logTitle: "Anfrage protokollieren",
    importTitle: "Import / Export",
  },
  reports: {
    r1: "Requests / Monat (12M Rolling)",
    r2: "Top 10 Bereiche nach Anfragevolumen",
    r3: "Anteil Frequenzen",
  },
  readme: "README (im Code am Ende)",
};

/** ==============================
 * Types
 * ============================== */
type ID = string;
export interface Team { id: ID; name: string; owner: string; }
export interface Area { id: ID; name: string; contact?: string; }
export type Cadence = "one-off" | "weekly" | "monthly" | "quarterly" | "yearly";
export type DueStrategy = "fixed-date" | "relative";
export type Priority = "low" | "medium" | "high";
export type Status = "planned" | "active" | "blocked" | "done";
export interface Topic {
  id: ID;
  teamId: ID;
  title: string;
  description?: string;
  areaIds: string; // CSV of Area IDs (per spec)
  cadence: Cadence;
  startDate: string; // ISO date
  dueStrategy: DueStrategy;
  dueOffsetDays?: number;
  expectedDeliverable: string;
  priority: Priority;
  status: Status;
  tags: string; // CSV tags
  lastRequestDate?: string;
  nextRequestDate?: string;
}
export type Outcome = "sent" | "ack" | "delivered" | "overdue";
export interface RequestLog {
  id: ID;
  topicId: ID;
  date: string;
  sentBy: string;
  toAreaId: ID;
  notes?: string;
  outcome: Outcome;
}
interface AppState {
  teams: Team[];
  areas: Area[];
  topics: Topic[];
  logs: RequestLog[];
  createdAt: string;
  version: number;
}

/** ==============================
 * Constants / Storage
 * ============================== */
const STORAGE_KEY = "work-request-planner:v1";

/** ==============================
 * Utilities (IDs, Dates, CSV, Fuzzy)
 * ============================== */
const uid = () => Math.random().toString(36).slice(2, 10);

const parseISO = (d: string) => {
  const x = new Date(d);
  return isNaN(x.getTime()) ? null : x;
};
const fmtISO = (d: Date) => d.toISOString().slice(0, 10);

const todayISO = () => fmtISO(new Date());
const cmpISO = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

const addDays = (d: string, days: number) => {
  const x = parseISO(d)!; const y = new Date(x); y.setDate(x.getDate() + days); return fmtISO(y);
};
const addMonths = (d: string, months: number) => {
  const x = parseISO(d)!; const y = new Date(x); y.setMonth(x.getMonth() + months); return fmtISO(y);
};
const cadenceNextDate = (startDateISO: string, cadence: Cadence, last?: string): string => {
  // If last provided, advance from last; else from start.
  const base = last ?? startDateISO;
  switch (cadence) {
    case "one-off": return startDateISO;
    case "weekly": return addDays(base, 7);
    case "monthly": return addMonths(base, 1);
    case "quarterly": return addMonths(base, 3);
    case "yearly": return addMonths(base, 12);
  }
};
const isOverdue = (iso: string) => iso < todayISO();
const isDueToday = (iso: string) => iso === todayISO();

const csvEscape = (s: string) => `"${(s ?? "").replace(/"/g, '""')}"`;
const topicsToCSV = (topics: Topic[]) => {
  const cols = Object.keys(topics[0] ?? {
    id: "", teamId: "", title: "", description: "", areaIds: "",
    cadence: "", startDate: "", dueStrategy: "", dueOffsetDays: "",
    expectedDeliverable: "", priority: "", status: "", tags: "",
    lastRequestDate: "", nextRequestDate: ""
  });
  const header = cols.join(",");
  const rows = topics.map(t => cols.map((c: any) => csvEscape(String((t as any)[c] ?? ""))).join(","));
  return [header, ...rows].join("\n");
};
const csvDownload = (name: string, data: string) => {
  const blob = new Blob([data], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
};
const jsonDownload = (name: string, data: any) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
};
const readFileAsText = (file: File) => new Promise<string>((res, rej) => {
  const fr = new FileReader();
  fr.onload = () => res(String(fr.result));
  fr.onerror = rej;
  fr.readAsText(file);
});

const fuzzyIncludes = (hay: string, needle: string) =>
  hay.toLowerCase().includes(needle.toLowerCase());

/** ==============================
 * Demo Seed
 * ============================== */
const seedState = (): AppState => {
  const teams: Team[] = [
    { id: "T-A", name: "Team A", owner: "a.owner@org" },
    { id: "T-B", name: "Team B", owner: "b.owner@org" },
    { id: "T-C", name: "Team C", owner: "c.owner@org" },
  ];
  const areas: Area[] = [
    { id: "AR-1", name: "Finanzen", contact: "fin@org" },
    { id: "AR-2", name: "HR", contact: "hr@org" },
    { id: "AR-3", name: "Compliance" }, // missing contact -> hint
    { id: "AR-4", name: "IT-Betrieb", contact: "ops@org" },
    { id: "AR-5", name: "Marketing", contact: "mkt@org" },
  ];
  const topics: Topic[] = [];
  const addTopic = (p: Partial<Topic>) => {
    const t: Topic = {
      id: uid(),
      teamId: p.teamId!,
      title: p.title || "Thema",
      description: p.description || "",
      areaIds: p.areaIds || "",
      cadence: p.cadence as Cadence,
      startDate: p.startDate || todayISO(),
      dueStrategy: p.dueStrategy || "fixed-date",
      dueOffsetDays: p.dueOffsetDays,
      expectedDeliverable: p.expectedDeliverable || "Report",
      priority: p.priority || "medium",
      status: p.status || "planned",
      tags: p.tags || "",
      lastRequestDate: p.lastRequestDate,
      nextRequestDate: p.nextRequestDate,
    };
    // compute initial nextRequestDate
    t.nextRequestDate = cadenceNextDate(t.startDate, t.cadence, t.lastRequestDate);
    topics.push(t);
  };

  // 10+ topics mixed
  addTopic({ teamId: "T-A", title: "Monatsreport KPIs", areaIds: "AR-1", cadence: "monthly", startDate: offsetDay(-40), expectedDeliverable: "KPI-Excel", status: "active", tags: "report,kpi" });
  addTopic({ teamId: "T-A", title: "Jahresabschluss-Daten", areaIds: "AR-1,AR-3", cadence: "yearly", startDate: offsetDay(-300), expectedDeliverable: "Abschluss-Paket", status: "planned", priority: "high", tags: "audit" });
  addTopic({ teamId: "T-B", title: "Onboarding-Prozess-Check", areaIds: "AR-2", cadence: "quarterly", startDate: offsetDay(-95), expectedDeliverable: "Checklist", status: "active" });
  addTopic({ teamId: "T-B", title: "Datenschutz-Prüfung", areaIds: "AR-3", cadence: "monthly", startDate: offsetDay(-70), expectedDeliverable: "DS-Review", status: "blocked", tags: "privacy" });
  addTopic({ teamId: "T-C", title: "Release-Notes IT", areaIds: "AR-4", cadence: "monthly", startDate: offsetDay(-10), expectedDeliverable: "Release-Notes", status: "active", tags: "release" });
  addTopic({ teamId: "T-C", title: "Kampagnen-Assets", areaIds: "AR-5", cadence: "weekly", startDate: offsetDay(-14), expectedDeliverable: "Asset-Paket", status: "active", priority: "high", tags: "campaign" });
  addTopic({ teamId: "T-A", title: "Einmalige Abfrage Lieferantenliste", areaIds: "AR-1", cadence: "one-off", startDate: offsetDay(-5), expectedDeliverable: "CSV", status: "planned" });
  addTopic({ teamId: "T-B", title: "Vierteljährlicher Risiko-Report", areaIds: "AR-3,AR-4", cadence: "quarterly", startDate: offsetDay(-200), expectedDeliverable: "Risiko-PDF", status: "active" });
  addTopic({ teamId: "T-C", title: "Mitarbeiterumfrage", areaIds: "AR-2,AR-5", cadence: "one-off", startDate: offsetDay(10), expectedDeliverable: "Survey-Result", status: "planned" });
  addTopic({ teamId: "T-A", title: "Budget-Forecast", areaIds: "AR-1", cadence: "monthly", startDate: offsetDay(-80), expectedDeliverable: "Forecast-Excel", status: "active" });
  addTopic({ teamId: "T-B", title: "Change-Window-Abstimmung", areaIds: "AR-4", cadence: "weekly", startDate: offsetDay(-1), expectedDeliverable: "Change-List", status: "active" });

  // Some lastRequestDate to move nextRequestDate forward
  topics.slice(0, 4).forEach(t => {
    t.lastRequestDate = offsetDay(-7);
    t.nextRequestDate = cadenceNextDate(t.startDate, t.cadence, t.lastRequestDate);
  });

  const logs: RequestLog[] = [];
  const addLog = (p: Partial<RequestLog>) => {
    logs.push({
      id: uid(),
      topicId: p.topicId!,
      date: p.date || todayISO(),
      sentBy: p.sentBy || "system",
      toAreaId: p.toAreaId!,
      notes: p.notes || "",
      outcome: p.outcome || "sent",
    });
  };
  // Logs over last 90 days
  topics.forEach((t, idx) => {
    const areasForT = t.areaIds.split(",").map(s => s.trim()).filter(Boolean);
    if (areasForT[0]) {
      addLog({ topicId: t.id, toAreaId: areasForT[0], date: offsetDay(-((idx + 1) * 6)), sentBy: "owner", outcome: (idx % 3 === 0 ? "delivered" : "ack") });
    }
  });

  return { teams, areas, topics, logs, createdAt: new Date().toISOString(), version: 1 };
};
function offsetDay(days: number) { const d = new Date(); d.setDate(d.getDate() + days); return fmtISO(d); }

/** ==============================
 * Store (Reducer + Context + Undo)
 * ============================== */
type Action =
  | { type: "LOAD"; state: AppState }
  | { type: "ADD_TOPIC"; topic: Topic }
  | { type: "UPDATE_TOPIC"; topic: Topic }
  | { type: "DELETE_TOPIC"; id: ID }
  | { type: "ADD_LOG"; log: RequestLog }
  | { type: "DELETE_LOG"; id: ID }
  | { type: "BULK_UPDATE_TOPICS"; ids: ID[]; patch: Partial<Topic> }
  | { type: "RECALC_DATES" }
  | { type: "RESET"; state: AppState }
  | { type: "UNDO" };

interface WithUndo<T> { past?: T[]; present: T; }
const withUndoInit = (s: AppState): WithUndo<AppState> => ({ present: s, past: [] });
function produce(next: (s: AppState) => AppState) {
  return (w: WithUndo<AppState>): WithUndo<AppState> => ({
    past: [...(w.past || []), w.present],
    present: next(w.present),
  });
}
const recalcAllDates = (s: AppState): AppState => {
  const topics = s.topics.map(t => {
    const next = cadenceNextDate(t.startDate, t.cadence, t.lastRequestDate);
    return { ...t, nextRequestDate: next };
  });
  return { ...s, topics };
};
function reducer(state: WithUndo<AppState>, action: Action): WithUndo<AppState> {
  switch (action.type) {
    case "LOAD": return withUndoInit(action.state);
    case "RESET": return withUndoInit(action.state);
    case "UNDO": {
      const past = state.past || [];
      if (!past.length) return state;
      const prev = past[past.length - 1];
      return { past: past.slice(0, -1), present: prev };
    }
    case "ADD_TOPIC": return produce(s => ({ ...s, topics: [...s.topics, action.topic] }))(state);
    case "UPDATE_TOPIC": return produce(s => ({
      ...s,
      topics: s.topics.map(t => t.id === action.topic.id ? action.topic : t),
    }))(state);
    case "DELETE_TOPIC": return produce(s => ({ ...s, topics: s.topics.filter(t => t.id !== action.id), logs: s.logs.filter(l => l.topicId !== action.id) }))(state);
    case "ADD_LOG": return produce(s => {
      const topic = s.topics.find(t => t.id === action.log.topicId);
      let topics = s.topics;
      if (topic) {
        const nextDate = cadenceNextDate(topic.startDate, topic.cadence, action.log.date);
        const updated = { ...topic, lastRequestDate: action.log.date, nextRequestDate: nextDate };
        topics = s.topics.map(t => t.id === topic.id ? updated : t);
      }
      return { ...s, logs: [action.log, ...s.logs], topics };
    })(state);
    case "DELETE_LOG": return produce(s => ({ ...s, logs: s.logs.filter(l => l.id !== action.id) }))(state);
    case "BULK_UPDATE_TOPICS": return produce(s => ({
      ...s,
      topics: s.topics.map(t => action.ids.includes(t.id) ? { ...t, ...action.patch } as Topic : t)
    }))(state);
    case "RECALC_DATES": return produce(recalcAllDates)(state);
    default: return state;
  }
}

const StoreContext = React.createContext<{
  state: AppState;
  dispatch: React.Dispatch<Action>;
}>({ state: seedState(), dispatch: () => {} });

/** ==============================
 * Main Component
 * ============================== */
export default function WorkRequestPlannerApp() {
  const [initializing, setInitializing] = useState(true);
  const [wrap, dispatch] = useReducer(reducer, withUndoInit(seedState()));
  const state = wrap.present;

  // Load from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: AppState = JSON.parse(raw);
        dispatch({ type: "LOAD", state: parsed });
      } else {
        // initial render with empty -> show empty state until user loads demo
        const empty: AppState = { teams: [], areas: [], topics: [], logs: [], createdAt: new Date().toISOString(), version: 1 };
        dispatch({ type: "LOAD", state: empty });
      }
    } catch (e) {
      console.error("Load error", e);
    } finally {
      setInitializing(false);
    }
  }, []);

  // Persist
  useEffect(() => {
    if (!initializing) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [state, initializing]);

  // Keyboard shortcuts
  const [openTopicDialog, setOpenTopicDialog] = useState(false);
  const [openLogDialog, setOpenLogDialog] = useState(false);
  const [openImportDialog, setOpenImportDialog] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !isInputLike(document.activeElement)) {
        e.preventDefault(); searchRef.current?.focus();
      }
      if (e.key === "n") setOpenTopicDialog(true);
      if (e.key === "e") setOpenImportDialog(true);
      if (e.key === "Delete") {
        // no-op globally
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Tests via hash ?test=1
  useEffect(() => {
    if (window.location.hash.includes("test=1")) {
      runInlineTests();
    }
  }, []);

  // Global Filters
  const [fltTeam, setFltTeam] = useState<string>("all");
  const [fltArea, setFltArea] = useState<string>("all");
  const [fltStatus, setFltStatus] = useState<string>("all");
  const [fltCadence, setFltCadence] = useState<string>("all");
  const [fltPriority, setFltPriority] = useState<string>("all");
  const [fltFrom, setFltFrom] = useState<string>("");
  const [fltTo, setFltTo] = useState<string>("");
  const [fltTag, setFltTag] = useState<string>("");
  const [query, setQuery] = useState("");

  const clearFilters = () => {
    setFltTeam("all"); setFltArea("all"); setFltStatus("all"); setFltCadence("all"); setFltPriority("all");
    setFltFrom(""); setFltTo(""); setFltTag("");
  };

  // Derived
  const teamMap = useMemo(() => new Map(state.teams.map(t => [t.id, t])), [state.teams]);
  const areaMap = useMemo(() => new Map(state.areas.map(a => [a.id, a])), [state.areas]);

  const filteredTopics = useMemo(() => {
    let arr = state.topics.slice();
    if (fltTeam !== "all") arr = arr.filter(t => t.teamId === fltTeam);
    if (fltArea !== "all") arr = arr.filter(t => t.areaIds.split(",").map(s => s.trim()).includes(fltArea));
    if (fltStatus !== "all") arr = arr.filter(t => t.status === fltStatus);
    if (fltCadence !== "all") arr = arr.filter(t => t.cadence === fltCadence);
    if (fltPriority !== "all") arr = arr.filter(t => t.priority === fltPriority);
    if (fltTag.trim()) {
      const needle = fltTag.trim().toLowerCase();
      arr = arr.filter(t => (t.tags || "").toLowerCase().split(",").map(s => s.trim()).includes(needle));
    }
    if (fltFrom) arr = arr.filter(t => (t.nextRequestDate || t.startDate) >= fltFrom);
    if (fltTo) arr = arr.filter(t => (t.nextRequestDate || t.startDate) <= fltTo);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      arr = arr.filter(t => fuzzyIncludes(t.title + " " + (t.description || "") + " " + (t.tags || ""), q));
    }
    return arr;
  }, [state.topics, fltTeam, fltArea, fltStatus, fltCadence, fltPriority, fltTag, fltFrom, fltTo, query]);

  // KPIs
  const kpi = useMemo(() => {
    const next7 = filteredTopics.filter(t => {
      const d = (t.nextRequestDate || t.startDate);
      return d >= todayISO() && d <= addDays(todayISO(), 7);
    }).length;
    const next30 = filteredTopics.filter(t => {
      const d = (t.nextRequestDate || t.startDate);
      return d >= todayISO() && d <= addDays(todayISO(), 30);
    }).length;
    const overdue = filteredTopics.filter(t => isOverdue(t.nextRequestDate || t.startDate)).length;

    const perArea: Record<string, number> = {};
    const perTeam: Record<string, number> = {};
    filteredTopics.forEach(t => {
      t.areaIds.split(",").map(s => s.trim()).filter(Boolean).forEach(a => perArea[a] = (perArea[a] || 0) + 1);
      perTeam[t.teamId] = (perTeam[t.teamId] || 0) + 1;
    });
    return { next7, next30, overdue, perArea, perTeam };
  }, [filteredTopics]);

  // Matrix data (Teams x Areas)
  const activeStatuses: Status[] = ["planned", "active", "blocked"];
  const matrix = useMemo(() => {
    const m = new Map<string, { count: number; next: string | null }>(); // key teamId|areaId
    state.teams.forEach(T => state.areas.forEach(A => m.set(`${T.id}|${A.id}`, { count: 0, next: null })));
    filteredTopics.forEach(t => {
      const areas = t.areaIds.split(",").map(s => s.trim()).filter(Boolean);
      const next = t.nextRequestDate || t.startDate;
      areas.forEach(a => {
        const key = `${t.teamId}|${a}`;
        const cell = m.get(key);
        if (!cell) return;
        if (activeStatuses.includes(t.status)) cell.count += 1;
        if (!cell.next || next < cell.next) cell.next = next;
      });
    });
    return m;
  }, [filteredTopics, state.teams, state.areas]);

  // Calendar month model
  const [calendarCursor, setCalendarCursor] = useState(() => {
    const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const calendarDays = useMemo(() => {
    const year = calendarCursor.getFullYear();
    const month = calendarCursor.getMonth();
    const first = new Date(year, month, 1);
    const startDay = first.getDay() || 7; // Monday=1..7
    const start = new Date(first); start.setDate(first.getDate() - (startDay - 1));
    const days: { date: Date; iso: string; items: Topic[] }[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const iso = fmtISO(d);
      const items = filteredTopics.filter(t => (t.nextRequestDate || t.startDate) === iso);
      days.push({ date: d, iso, items });
    }
    return days;
  }, [calendarCursor, filteredTopics]);

  // Topic detail panel
  const [detailTopic, setDetailTopic] = useState<Topic | null>(null);

  // Pagination for Topics table
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(filteredTopics.length / pageSize));
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [totalPages]); // adjust on filter change
  const pagedTopics = useMemo(() => filteredTopics.slice((page - 1) * pageSize, page * pageSize), [filteredTopics, page]);

  // Selection for bulk
  const [selected, setSelected] = useState<Set<ID>>(new Set());
  useEffect(() => { setSelected(new Set()); }, [filteredTopics]); // reset on filters

  // Helpers
  const teamName = (id: ID) => teamMap.get(id)?.name || id;
  const areaName = (id: ID) => areaMap.get(id)?.name || id;
  const areaHasMissingContact = (areaIds: string) =>
    areaIds.split(",").map(s => s.trim()).some(a => !areaMap.get(a)?.contact);

  // CRUD Handlers
  const handleCreateOrUpdateTopic = (t: Partial<Topic>, existing?: Topic) => {
    const validation = validateTopic(t, state);
    if (validation) { toastMsg(validation, "destructive"); return; }
    const topic: Topic = {
      id: existing?.id || uid(),
      teamId: t.teamId!,
      title: (t.title || "").trim(),
      description: t.description || "",
      areaIds: (t.areaIds || "").split(",").map(s => s.trim()).filter(Boolean).join(","),
      cadence: t.cadence as Cadence,
      startDate: t.startDate!,
      dueStrategy: t.dueStrategy as DueStrategy,
      dueOffsetDays: t.dueStrategy === "relative" ? (t.dueOffsetDays ?? 0) : undefined,
      expectedDeliverable: t.expectedDeliverable || "",
      priority: (t.priority as Priority) || "medium",
      status: (t.status as Status) || "planned",
      tags: (t.tags || "").toString(),
      lastRequestDate: existing?.lastRequestDate,
      nextRequestDate: cadenceNextDate(t.startDate!, t.cadence as Cadence, existing?.lastRequestDate),
    };
    if (existing) {
      dispatch({ type: "UPDATE_TOPIC", topic });
      toastMsg("Thema aktualisiert");
    } else {
      dispatch({ type: "ADD_TOPIC", topic });
      toastMsg("Thema angelegt");
    }
    setOpenTopicDialog(false);
  };

  const handleDeleteTopic = (id: ID) => {
    dispatch({ type: "DELETE_TOPIC", id });
    toastMsg("Thema gelöscht");
  };

  const handleAddLog = (log: Partial<RequestLog>) => {
    if (!log.topicId || !log.toAreaId) { toastMsg("Bitte Topic und Bereich wählen", "destructive"); return; }
    const L: RequestLog = {
      id: uid(),
      topicId: log.topicId,
      date: log.date || todayISO(),
      sentBy: log.sentBy || "user",
      toAreaId: log.toAreaId,
      notes: log.notes || "",
      outcome: (log.outcome as Outcome) || "sent",
    };
    dispatch({ type: "ADD_LOG", log: L });
    setOpenLogDialog(false);
    toastMsg("Anfrage protokolliert");
  };

  const handleExportJSON = () => jsonDownload(`work-planner_${todayISO()}.json`, state);
  const handleExportCSV = () => csvDownload(`topics_${todayISO()}.csv`, topicsToCSV(state.topics));

  const handleImportJSON = async (file: File, options: { reassignIds: boolean; merge: boolean }) => {
    try {
      const txt = await readFileAsText(file);
      const parsed = JSON.parse(txt);
      const check = validateImportedState(parsed);
      if (check !== true) { toastMsg("Import-Fehler: " + check, "destructive"); return; }
      let incoming: AppState = parsed;
      if (options.reassignIds) {
        incoming = {
          ...incoming,
          teams: incoming.teams.map(x => ({ ...x, id: "T-" + uid() })),
          areas: incoming.areas.map(x => ({ ...x, id: "AR-" + uid() })),
        };
        const teamMapOld: Record<string, string> = {};
        const areaMapOld: Record<string, string> = {};
        parsed.teams.forEach((t: Team, i: number) => teamMapOld[t.id] = incoming.teams[i].id);
        parsed.areas.forEach((a: Area, i: number) => areaMapOld[a.id] = incoming.areas[i].id);
        incoming.topics = incoming.topics.map((t: Topic) => ({
          ...t,
          id: "TP-" + uid(),
          teamId: teamMapOld[t.teamId] || t.teamId,
          areaIds: t.areaIds.split(",").map((a: string) => areaMapOld[a] || a).join(","),
        }));
        incoming.logs = incoming.logs.map((l: RequestLog) => ({
          ...l,
          id: "LG-" + uid(),
          topicId: incoming.topics.find(tt => tt.title === parsed.topics.find((pt: Topic) => pt.id === l.topicId)?.title)?.id || l.topicId,
          toAreaId: areaMapOld[l.toAreaId] || l.toAreaId,
        }));
      }
      if (options.merge) {
        const merged: AppState = {
          ...state,
          teams: mergeById(state.teams, incoming.teams),
          areas: mergeById(state.areas, incoming.areas),
          topics: mergeById(state.topics, incoming.topics),
          logs: mergeById(state.logs, incoming.logs),
          createdAt: state.createdAt,
          version: Math.max(state.version, incoming.version || 1),
        };
        dispatch({ type: "RESET", state: merged });
      } else {
        dispatch({ type: "RESET", state: incoming });
      }
      dispatch({ type: "RECALC_DATES" });
      setOpenImportDialog(false);
      toastMsg("Import erfolgreich");
    } catch (e: any) {
      console.error(e);
      toastMsg("Import fehlgeschlagen", "destructive");
    }
  };

  // Demo data controls
  const loadDemo = () => { dispatch({ type: "RESET", state: seedState() }); dispatch({ type: "RECALC_DATES" }); toastMsg("Demo-Daten geladen"); };
  const clearDemo = () => { const empty: AppState = { teams: [], areas: [], topics: [], logs: [], createdAt: new Date().toISOString(), version: 1 }; dispatch({ type: "RESET", state: empty }); toastMsg("Daten entfernt"); };

  // UI state for dialogs/forms
  const [editTopic, setEditTopic] = useState<Topic | null>(null);
  const [topicDraft, setTopicDraft] = useState<Partial<Topic>>({});
  const openNewTopic = () => { setEditTopic(null); setTopicDraft({ teamId: state.teams[0]?.id, cadence: "monthly", dueStrategy: "fixed-date", startDate: todayISO(), priority: "medium", status: "planned" }); setOpenTopicDialog(true); };
  const openEditTopic = (t: Topic) => { setEditTopic(t); setTopicDraft({ ...t }); setOpenTopicDialog(true); };

  // Bulk actions
  const bulkSetStatus = (s: Status) => {
    dispatch({ type: "BULK_UPDATE_TOPICS", ids: [...selected], patch: { status: s } });
    toastMsg(`Status auf '${s}' gesetzt`);
  };
  const bulkSetCadence = (c: Cadence) => {
    dispatch({ type: "BULK_UPDATE_TOPICS", ids: [...selected], patch: { cadence: c } });
    dispatch({ type: "RECALC_DATES" });
    toastMsg(`Frequenz auf '${c}' gesetzt`);
  };
  const bulkDelete = () => {
    [...selected].forEach(id => dispatch({ type: "DELETE_TOPIC", id }));
    setSelected(new Set());
    toastMsg("Ausgewählte Themen gelöscht");
  };

  // Day drawer for calendar
  const [dayDrawer, setDayDrawer] = useState<{ iso: string; items: Topic[] } | null>(null);

  // Reports data
  const rolling12 = useMemo(() => {
    const map: { label: string; key: string; count: number }[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      map.push({ label: key, key, count: 0 });
    }
    filteredTopics.forEach(t => {
      const d = t.nextRequestDate || t.startDate;
      const mm = d.slice(0, 7);
      const row = map.find(m => m.key === mm);
      if (row) row.count += 1;
    });
    return map;
  }, [filteredTopics]);

  const topAreas = useMemo(() => {
    const cnt: Record<string, number> = {};
    filteredTopics.forEach(t => t.areaIds.split(",").map(s => s.trim()).filter(Boolean).forEach(a => cnt[a] = (cnt[a] || 0) + 1));
    const arr = Object.entries(cnt).map(([a, c]) => ({ area: areaName(a), count: c })).sort((a, b) => b.count - a.count).slice(0, 10);
    return arr;
  }, [filteredTopics]);

  const cadenceShare = useMemo(() => {
    const cnt: Record<Cadence, number> = { "one-off": 0, weekly: 0, monthly: 0, quarterly: 0, yearly: 0 };
    filteredTopics.forEach(t => { cnt[t.cadence] += 1; });
    return Object.entries(cnt).map(([k, v]) => ({ name: k, value: v }));
  }, [filteredTopics]);

  // Render
  return (
    <TooltipProvider>
      <StoreContext.Provider value={{ state, dispatch }}>
        <div className="p-4 md:p-6 space-y-4">
          <Header
            state={state}
            query={query}
            setQuery={setQuery}
            searchRef={searchRef}
            filters={{
              fltTeam, setFltTeam,
              fltArea, setFltArea,
              fltStatus, setFltStatus,
              fltCadence, setFltCadence,
              fltPriority, setFltPriority,
              fltFrom, setFltFrom,
              fltTo, setFltTo,
              fltTag, setFltTag,
              clearFilters,
            }}
            onNewTopic={openNewTopic}
            onNewLog={() => setOpenLogDialog(true)}
            onExportJSON={handleExportJSON}
            onExportCSV={handleExportCSV}
            onImport={() => setOpenImportDialog(true)}
            onLoadDemo={loadDemo}
            onClearDemo={clearDemo}
          />

          {state.teams.length === 0 && state.areas.length === 0 && state.topics.length === 0 ? (
            <EmptyState onLoadDemo={loadDemo} />
          ) : (
            <Tabs defaultValue="overview">
              <TabsList className="grid grid-cols-6 w-full md:w-auto">
                <TabsTrigger value="overview">{STR.tabs.overview}</TabsTrigger>
                <TabsTrigger value="matrix">{STR.tabs.matrix}</TabsTrigger>
                <TabsTrigger value="calendar">{STR.tabs.calendar}</TabsTrigger>
                <TabsTrigger value="topics">{STR.tabs.topics}</TabsTrigger>
                <TabsTrigger value="logs">{STR.tabs.logs}</TabsTrigger>
                <TabsTrigger value="reports">{STR.tabs.reports}</TabsTrigger>
              </TabsList>

              {/* Overview */}
              <TabsContent value="overview">
                <div className="grid gap-4 md:grid-cols-4">
                  <KpiCard title={STR.kpis.next7} value={kpi.next7} icon={<CalendarClock className="h-5 w-5" />} />
                  <KpiCard title={STR.kpis.next30} value={kpi.next30} icon={<CalendarDays className="h-5 w-5" />} />
                  <KpiCard title={STR.kpis.overdue} value={kpi.overdue} icon={<Clock className="h-5 w-5" />} />
                  <Card>
                    <CardHeader><CardTitle>Minimap Timeline</CardTitle></CardHeader>
                    <CardContent>
                      <div className="h-28">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={rolling12}>
                            <XAxis dataKey="label" hide />
                            <YAxis hide />
                            <RTooltip />
                            <Line type="monotone" dataKey="count" dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader><CardTitle>{STR.kpis.perArea}</CardTitle></CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                      {Object.entries(kpi.perArea).map(([a, c]) => (
                        <Badge key={a} variant="secondary">{areaName(a)}: {c}</Badge>
                      ))}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle>{STR.kpis.perTeam}</CardTitle></CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                      {Object.entries(kpi.perTeam).map(([t, c]) => (
                        <Badge key={t} variant="outline">{teamName(t)}: {c}</Badge>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Matrix */}
              <TabsContent value="matrix">
                <Card>
                  <CardHeader><CardTitle>Teams × Bereiche</CardTitle></CardHeader>
                  <CardContent className="overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Team \\ Bereich</TableHead>
                          {state.areas.map(a => <TableHead key={a.id}>{a.name}</TableHead>)}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {state.teams.map(t => (
                          <TableRow key={t.id}>
                            <TableCell className="font-medium">{t.name}</TableCell>
                            {state.areas.map(a => {
                              const cell = matrix.get(`${t.id}|${a.id}`)!;
                              const badge =
                                cell.next ? (isOverdue(cell.next) ? STR.calendar.overdue : isDueToday(cell.next) ? STR.calendar.today : cell.next) : "—";
                              return (
                                <TableCell key={a.id}>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="secondary">{cell.count}</Badge>
                                    <Badge variant={isOverdue(String(cell.next)) ? "destructive" : "outline"} className="cursor-pointer"
                                      onClick={() => {
                                        // focus Topics tab filtered on that cell
                                        setFltTeam(t.id); setFltArea(a.id);
                                        const el = document.querySelector('[data-state="active"][value="topics"]') as HTMLElement;
                                        el?.click();
                                      }}>
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
                    <CardTitle>{STR.tabs.calendar}</CardTitle>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setCalendarCursor(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}>‹</Button>
                      <Button variant="outline" onClick={() => setCalendarCursor(new Date())}>{STR.calendar.today}</Button>
                      <Button variant="outline" onClick={() => setCalendarCursor(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}>›</Button>
                    </div>
                  </CardHeader>
                  <CardContent className="grid grid-cols-7 gap-2">
                    {["Mo","Di","Mi","Do","Fr","Sa","So"].map(w => <div key={w} className="text-xs font-semibold">{w}</div>)}
                    {calendarDays.map((d, i) => {
                      const inMonth = d.date.getMonth() === calendarCursor.getMonth();
                      const items = d.items.slice(0, 3);
                      const extra = d.items.length - items.length;
                      return (
                        <div key={i} className={`border rounded p-1 min-h-[84px] ${inMonth ? "" : "opacity-50"}`}>
                          <div className="text-xs">{d.date.getDate()}</div>
                          <div className="mt-1 flex flex-col gap-1">
                            {items.map(it => (
                              <Badge key={it.id} variant={isOverdue(it.nextRequestDate || it.startDate) ? "destructive" : "secondary"}
                                className="truncate cursor-pointer"
                                onClick={() => setDetailTopic(it)}>
                                {it.title}
                              </Badge>
                            ))}
                            {extra > 0 && <Badge variant="outline" className="cursor-pointer" onClick={() => setDayDrawer({ iso: d.iso, items: d.items })}>+{extra}</Badge>}
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
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>{STR.tabs.topics}</CardTitle>
                    <div className="flex gap-2">
                      <Select onValueChange={(v) => bulkSetStatus(v as Status)}>
                        <SelectTrigger className="w-44"><SelectValue placeholder={`${STR.actions.statusTo}…`} /></SelectTrigger>
                        <SelectContent>
                          {["planned","active","blocked","done"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Select onValueChange={(v) => bulkSetCadence(v as Cadence)}>
                        <SelectTrigger className="w-48"><SelectValue placeholder={`${STR.actions.cadenceTo}…`} /></SelectTrigger>
                        <SelectContent>
                          {["one-off","weekly","monthly","quarterly","yearly"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Button variant="destructive" onClick={bulkDelete} disabled={selected.size === 0}><Trash2 className="h-4 w-4 mr-1" />Löschen</Button>
                      <Button onClick={openNewTopic}><Plus className="h-4 w-4 mr-1" />{STR.actions.newTopic}</Button>
                    </div>
                  </CardHeader>
                  <CardContent className="overflow-auto">
                    <Table>
                      <TableCaption>{filteredTopics.length} Thema/Themen — Seite {page}/{totalPages}</TableCaption>
                      <TableHeader>
                        <TableRow>
                          <TableHead><Checkbox checked={selected.size === pagedTopics.length && pagedTopics.length > 0} onCheckedChange={(v) => {
                            if (v) setSelected(new Set(pagedTopics.map(t => t.id))); else setSelected(new Set());
                          }} /></TableHead>
                          <TableHead>Titel</TableHead>
                          <TableHead>Team</TableHead>
                          <TableHead>Bereiche</TableHead>
                          <TableHead>Frequenz</TableHead>
                          <TableHead>Fälligkeit</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Prio</TableHead>
                          <TableHead>Aktionen</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pagedTopics.map(t => {
                          const due = t.nextRequestDate || t.startDate;
                          return (
                            <TableRow key={t.id} className="hover:bg-muted/50">
                              <TableCell>
                                <Checkbox checked={selected.has(t.id)} onCheckedChange={(v) => {
                                  const s = new Set(selected); v ? s.add(t.id) : s.delete(t.id); setSelected(s);
                                }} />
                              </TableCell>
                              <TableCell className="max-w-[240px]">
                                <div className="flex flex-col">
                                  <span className="font-medium truncate">{t.title}</span>
                                  <span className="text-xs text-muted-foreground truncate">{t.expectedDeliverable}</span>
                                </div>
                              </TableCell>
                              <TableCell>{teamName(t.teamId)}</TableCell>
                              <TableCell className="max-w-[160px] truncate">{t.areaIds.split(",").map(a => areaName(a.trim())).join(", ")}</TableCell>
                              <TableCell>{t.cadence}</TableCell>
                              <TableCell>
                                <Badge variant={isOverdue(due) ? "destructive" : isDueToday(due) ? "secondary" : "outline"}>{due}</Badge>
                              </TableCell>
                              <TableCell>{t.status}</TableCell>
                              <TableCell>{t.priority}</TableCell>
                              <TableCell className="flex gap-2">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button size="icon" variant="ghost" aria-label="Details" onClick={() => setDetailTopic(t)}><Info className="h-4 w-4" /></Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Details</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button size="icon" variant="ghost" aria-label="Bearbeiten" onClick={() => openEditTopic(t)}><Settings className="h-4 w-4" /></Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Bearbeiten</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button size="icon" variant="ghost" aria-label="Duplizieren" onClick={() => {
                                      const dup = { ...t, id: uid(), title: t.title + " (Kopie)" };
                                      dispatch({ type: "ADD_TOPIC", topic: dup });
                                      toastMsg("Dupliziert");
                                    }}><Copy className="h-4 w-4" /></Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Duplizieren</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button size="icon" variant="ghost" aria-label="Löschen" onClick={() => handleDeleteTopic(t.id)}><Trash2 className="h-4 w-4" /></Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Löschen</TooltipContent>
                                </Tooltip>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                    {/* Pagination */}
                    <div className="flex items-center justify-end gap-2 mt-3">
                      <Button variant="outline" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>‹</Button>
                      <span className="text-sm">Seite {page} / {totalPages}</span>
                      <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>›</Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Logs */}
              <TabsContent value="logs">
                <Card>
                  <CardHeader className="flex items-center justify-between">
                    <CardTitle>{STR.tabs.logs}</CardTitle>
                    <Button onClick={() => setOpenLogDialog(true)}><Logs className="h-4 w-4 mr-1" />{STR.actions.newLog}</Button>
                  </CardHeader>
                  <CardContent className="overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Datum</TableHead>
                          <TableHead>Topic</TableHead>
                          <TableHead>Bereich</TableHead>
                          <TableHead>Von</TableHead>
                          <TableHead>Outcome</TableHead>
                          <TableHead>Notizen</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {state.logs
                          .filter(l => {
                            let ok = true;
                            if (fltTeam !== "all") {
                              const t = state.topics.find(t => t.id === l.topicId); ok = ok && t?.teamId === fltTeam;
                            }
                            if (fltArea !== "all") ok = ok && l.toAreaId === fltArea;
                            if (fltFrom) ok = ok && l.date >= fltFrom;
                            if (fltTo) ok = ok && l.date <= fltTo;
                            return ok;
                          })
                          .map(l => {
                            const t = state.topics.find(t => t.id === l.topicId);
                            return (
                              <TableRow key={l.id}>
                                <TableCell>{l.date}</TableCell>
                                <TableCell className="max-w-[240px] truncate">{t?.title || l.topicId}</TableCell>
                                <TableCell>{areaName(l.toAreaId)}</TableCell>
                                <TableCell>{l.sentBy}</TableCell>
                                <TableCell><Badge variant="outline">{l.outcome}</Badge></TableCell>
                                <TableCell className="max-w-[240px] truncate">{l.notes}</TableCell>
                                <TableCell><Button size="icon" variant="ghost" onClick={() => {
                                  dispatch({ type: "DELETE_LOG", id: l.id }); toastMsg("Log gelöscht");
                                }}><Trash2 className="h-4 w-4" /></Button></TableCell>
                              </TableRow>
                            );
                          })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Reports */}
              <TabsContent value="reports">
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader><CardTitle>{STR.reports.r1}</CardTitle></CardHeader>
                    <CardContent className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={rolling12}>
                          <XAxis dataKey="label" />
                          <YAxis allowDecimals={false} />
                          <RTooltip />
                          <Bar dataKey="count" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle>{STR.reports.r2}</CardTitle></CardHeader>
                    <CardContent className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={topAreas}>
                          <XAxis dataKey="area" />
                          <YAxis allowDecimals={false} />
                          <RTooltip />
                          <Bar dataKey="count" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                  <Card className="md:col-span-2">
                    <CardHeader><CardTitle>{STR.reports.r3}</CardTitle></CardHeader>
                    <CardContent className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={cadenceShare} dataKey="value" nameKey="name" outerRadius={100} label>
                            {cadenceShare.map((entry, index) => <Cell key={`c-${index}`} />)}
                          </Pie>
                          <Legend />
                          <RTooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          )}

          {/* Topic Dialog */}
          <Dialog open={openTopicDialog} onOpenChange={setOpenTopicDialog}>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>{STR.dialogs.topicTitle}</DialogTitle></DialogHeader>
              <TopicForm
                draft={topicDraft}
                setDraft={setTopicDraft}
                teams={state.teams}
                areas={state.areas}
              />
              <DialogFooter className="flex justify-between">
                <div className="text-xs text-muted-foreground">
                  {areaHasMissingContact(topicDraft.areaIds || "") && STR.details.missingContact}
                </div>
                <div className="flex gap-2">
                  {editTopic && (
                    <Button variant="destructive" onClick={() => { handleDeleteTopic(editTopic.id); setOpenTopicDialog(false); }}>
                      <Trash2 className="h-4 w-4 mr-1" />Löschen
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => setOpenTopicDialog(false)}><X className="h-4 w-4 mr-1" />Abbrechen</Button>
                  <Button onClick={() => handleCreateOrUpdateTopic(topicDraft, editTopic)}><SaveIcon />Speichern</Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Log Dialog */}
          <Dialog open={openLogDialog} onOpenChange={setOpenLogDialog}>
            <DialogContent>
              <DialogHeader><DialogTitle>{STR.dialogs.logTitle}</DialogTitle></DialogHeader>
              <LogForm
                topics={state.topics}
                areas={state.areas}
                onSubmit={handleAddLog}
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpenLogDialog(false)}><X className="h-4 w-4 mr-1" />Abbrechen</Button>
                <Button onClick={() => {
                  const el = document.getElementById("log-submit") as HTMLButtonElement; el?.click();
                }}><SaveIcon />Speichern</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Import/Export Dialog */}
          <Dialog open={openImportDialog} onOpenChange={setOpenImportDialog}>
            <DialogContent>
              <DialogHeader><DialogTitle>{STR.dialogs.importTitle}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Button onClick={handleExportJSON}><FileJson className="h-4 w-4 mr-1" />{STR.actions.jsonExport}</Button>
                  <Button onClick={handleExportCSV}><Table2 className="h-4 w-4 mr-1" />{STR.actions.csvExport}</Button>
                </div>
                <ImportBox onImport={handleImportJSON} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpenImportDialog(false)}><X className="h-4 w-4 mr-1" />Schließen</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Detail Panel */}
          <Sheet open={!!detailTopic} onOpenChange={(o) => !o && setDetailTopic(null)}>
            <SheetContent className="sm:max-w-lg">
              {detailTopic && (
                <>
                  <SheetHeader><SheetTitle className="truncate">{detailTopic.title}</SheetTitle></SheetHeader>
                  <div className="mt-4 space-y-2 text-sm">
                    <div><b>Team:</b> {teamName(detailTopic.teamId)}</div>
                    <div><b>{STR.details.areas}:</b> {detailTopic.areaIds.split(",").map(a => areaName(a.trim())).join(", ")}</div>
                    <div><b>{STR.details.deliverable}:</b> {detailTopic.expectedDeliverable}</div>
                    <div><b>{STR.details.cadence}:</b> {detailTopic.cadence}</div>
                    <div><b>{STR.details.dueStrategy}:</b> {detailTopic.dueStrategy}{detailTopic.dueStrategy === "relative" ? ` (+${detailTopic.dueOffsetDays} Tage)` : ""}</div>
                    <div><b>{STR.details.lastRequest}:</b> {detailTopic.lastRequestDate || "—"}</div>
                    <div><b>{STR.details.nextDue}:</b> <Badge variant={isOverdue(detailTopic.nextRequestDate || detailTopic.startDate) ? "destructive" : "secondary"}>
                      {detailTopic.nextRequestDate || detailTopic.startDate}
                    </Badge></div>
                    <div><b>Status:</b> {detailTopic.status} <span className="ml-2"><b>Prio:</b> {detailTopic.priority}</span></div>
                    {detailTopic.description && <div className="pt-2">{detailTopic.description}</div>}
                    {areaHasMissingContact(detailTopic.areaIds) && <div className="text-xs text-muted-foreground pt-1">{STR.details.missingContact}</div>}

                    <div className="pt-3 flex gap-2">
                      <Button size="sm" onClick={() => { setOpenLogDialog(true); /* preselect via local storage hack if needed */ }}><LogIn className="h-4 w-4 mr-1" />{STR.actions.newLog}</Button>
                      <Button size="sm" variant="outline" onClick={() => { openEditTopic(detailTopic); }}><Settings className="h-4 w-4 mr-1" />Bearbeiten</Button>
                      <Button size="sm" variant="ghost" onClick={() => { setDetailTopic(null); }}><X className="h-4 w-4 mr-1" />Schließen</Button>
                    </div>
                  </div>
                  <SheetFooter />
                </>
              )}
            </SheetContent>
          </Sheet>

          {/* Day Drawer */}
          <Sheet open={!!dayDrawer} onOpenChange={(o) => !o && setDayDrawer(null)}>
            <SheetContent side="left" className="sm:max-w-md">
              {dayDrawer && (
                <>
                  <SheetHeader><SheetTitle>Fälligkeiten {dayDrawer.iso}</SheetTitle></SheetHeader>
                  <div className="mt-4 space-y-2">
                    {dayDrawer.items.map(t => (
                      <Card key={t.id} className="cursor-pointer" onClick={() => setDetailTopic(t)}>
                        <CardHeader className="py-3"><CardTitle className="text-base">{t.title}</CardTitle></CardHeader>
                        <CardContent className="text-sm">
                          <div>Team: {teamName(t.teamId)}</div>
                          <div>Bereiche: {t.areaIds.split(",").map(a => areaName(a.trim())).join(", ")}</div>
                          <div>Deliverable: {t.expectedDeliverable}</div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </>
              )}
            </SheetContent>
          </Sheet>

          <Toaster />
        </div>
      </StoreContext.Provider>
    </TooltipProvider>
  );
}

/** ==============================
 * Subcomponents
 * ============================== */
function Header(props: {
  state: AppState;
  query: string;
  setQuery: (s: string) => void;
  searchRef: React.RefObject<HTMLInputElement>;
  filters: {
    fltTeam: string; setFltTeam: (v: string) => void;
    fltArea: string; setFltArea: (v: string) => void;
    fltStatus: string; setFltStatus: (v: string) => void;
    fltCadence: string; setFltCadence: (v: string) => void;
    fltPriority: string; setFltPriority: (v: string) => void;
    fltFrom: string; setFltFrom: (v: string) => void;
    fltTo: string; setFltTo: (v: string) => void;
    fltTag: string; setFltTag: (v: string) => void;
    clearFilters: () => void;
  };
  onNewTopic: () => void;
  onNewLog: () => void;
  onExportJSON: () => void;
  onExportCSV: () => void;
  onImport: () => void;
  onLoadDemo: () => void;
  onClearDemo: () => void;
}) {
  const {
    state, query, setQuery, searchRef, filters,
    onNewTopic, onNewLog, onExportJSON, onExportCSV, onImport, onLoadDemo, onClearDemo
  } = props;
  return (
    <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold">{STR.appTitle}</h1>
        <Badge variant="outline">localStorage</Badge>
      </div>
      <div className="flex flex-col md:flex-row gap-2 md:items-center w-full">
        <div className="flex items-center gap-2 w-full md:w-72">
          <Search className="h-4 w-4" />
          <Input
            ref={searchRef}
            placeholder={STR.searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Suche"
          />
        </div>
        <div className="grid md:grid-cols-6 grid-cols-2 gap-2 w-full">
          <SelectFilter label={STR.filters.team} value={filters.fltTeam} onValueChange={filters.setFltTeam} items={[{ id: "all", name: "Alle" }, ...state.teams]} getName={(x: any) => x.name || x} />
          <SelectFilter label={STR.filters.area} value={filters.fltArea} onValueChange={filters.setFltArea} items={[{ id: "all", name: "Alle" }, ...state.areas]} getName={(x: any) => x.name || x} />
          <SelectFilter label={STR.filters.status} value={filters.fltStatus} onValueChange={filters.setFltStatus} items={["all", "planned", "active", "blocked", "done"]} />
          <SelectFilter label={STR.filters.cadence} value={filters.fltCadence} onValueChange={filters.setFltCadence} items={["all", "one-off", "weekly", "monthly", "quarterly", "yearly"]} />
          <SelectFilter label={STR.filters.priority} value={filters.fltPriority} onValueChange={filters.setFltPriority} items={["all", "low", "medium", "high"]} />
          <div className="flex gap-2">
            <Input type="date" value={filters.fltFrom} onChange={(e) => filters.setFltFrom(e.target.value)} aria-label={STR.filters.dateFrom} />
            <Input type="date" value={filters.fltTo} onChange={(e) => filters.setFltTo(e.target.value)} aria-label={STR.filters.dateTo} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Input className="w-28" placeholder={STR.filters.tag} value={filters.fltTag} onChange={(e) => filters.setFltTag(e.target.value)} aria-label={STR.filters.tag} />
          <Button variant="outline" onClick={filters.clearFilters}><Filter className="h-4 w-4 mr-1" />{STR.actions.clearFilters}</Button>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onNewTopic}><Plus className="h-4 w-4 mr-1" />{STR.actions.newTopic}</Button>
        <Button variant="outline" onClick={onNewLog}><Logs className="h-4 w-4 mr-1" />{STR.actions.newLog}</Button>
        <Button variant="outline" onClick={onExportCSV}><Download className="h-4 w-4 mr-1" />CSV</Button>
        <Button variant="outline" onClick={onExportJSON}><Download className="h-4 w-4 mr-1" />JSON</Button>
        <Button variant="outline" onClick={onImport}><Import className="h-4 w-4 mr-1" />{STR.actions.import}</Button>
        <Button variant="secondary" onClick={onLoadDemo}>{STR.actions.demoLoad}</Button>
        <Button variant="ghost" onClick={onClearDemo}>{STR.actions.demoClear}</Button>
      </div>
    </div>
  );
}

function SelectFilter({ label, value, onValueChange, items, getName }: any) {
  return (
    <div className="flex items-center gap-2">
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="w-36">
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>
          {items.map((it: any) =>
            <SelectItem key={typeof it === "string" ? it : it.id} value={typeof it === "string" ? it : it.id}>
              {getName ? getName(it) : it}
            </SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function KpiCard({ title, value, icon }: { title: string; value: number; icon?: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ onLoadDemo }: { onLoadDemo: () => void }) {
  return (
    <Card className="border-dashed">
      <CardHeader><CardTitle>{STR.empty.noData}</CardTitle></CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <Button onClick={onLoadDemo}><RefreshCw className="h-4 w-4 mr-1" />{STR.empty.loadDemo}</Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** Topic Form */
function TopicForm({ draft, setDraft, teams, areas }: { draft: Partial<Topic>; setDraft: (d: Partial<Topic>) => void; teams: Team[]; areas: Area[]; }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div>
        <Label>Titel</Label>
        <Input value={draft.title || ""} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
      </div>
      <div>
        <Label>Team</Label>
        <Select value={draft.teamId} onValueChange={(v) => setDraft({ ...draft, teamId: v })}>
          <SelectTrigger><SelectValue placeholder="Team wählen" /></SelectTrigger>
          <SelectContent>
            {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="md:col-span-2">
        <Label>Beschreibung</Label>
        <Input value={draft.description || ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
      </div>
      <div>
        <Label>Bereiche (IDs, komma-getrennt)</Label>
        <Input value={draft.areaIds || ""} onChange={(e) => setDraft({ ...draft, areaIds: e.target.value })} placeholder={areas.map(a => a.id).join(",")} />
      </div>
      <div>
        <Label>Deliverable</Label>
        <Input value={draft.expectedDeliverable || ""} onChange={(e) => setDraft({ ...draft, expectedDeliverable: e.target.value })} />
      </div>
      <div>
        <Label>Startdatum</Label>
        <Input type="date" value={draft.startDate || ""} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} />
      </div>
      <div>
        <Label>Frequenz</Label>
        <Select value={draft.cadence} onValueChange={(v) => setDraft({ ...draft, cadence: v as Cadence })}>
          <SelectTrigger><SelectValue placeholder="Frequenz" /></SelectTrigger>
          <SelectContent>
            {["one-off","weekly","monthly","quarterly","yearly"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Fälligkeitsstrategie</Label>
        <Select value={draft.dueStrategy} onValueChange={(v) => setDraft({ ...draft, dueStrategy: v as DueStrategy })}>
          <SelectTrigger><SelectValue placeholder="Strategie" /></SelectTrigger>
          <SelectContent>
            {["fixed-date","relative"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {draft.dueStrategy === "relative" && (
        <div>
          <Label>Offset-Tage</Label>
          <Input type="number" value={draft.dueOffsetDays ?? 0} onChange={(e) => setDraft({ ...draft, dueOffsetDays: Number(e.target.value) })} />
        </div>
      )}
      <div>
        <Label>Status</Label>
        <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v as Status })}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            {["planned","active","blocked","done"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Priorität</Label>
        <Select value={draft.priority} onValueChange={(v) => setDraft({ ...draft, priority: v as Priority })}>
          <SelectTrigger><SelectValue placeholder="Priorität" /></SelectTrigger>
          <SelectContent>
            {["low","medium","high"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="md:col-span-2">
        <Label>Tags (CSV)</Label>
        <Input value={draft.tags || ""} onChange={(e) => setDraft({ ...draft, tags: e.target.value })} />
      </div>
    </div>
  );
}

/** Log Form */
function LogForm({ topics, areas, onSubmit }: { topics: Topic[]; areas: Area[]; onSubmit: (l: Partial<RequestLog>) => void; }) {
  const [draft, setDraft] = useState<Partial<RequestLog>>({ date: todayISO(), outcome: "sent" });
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label>Datum</Label>
          <Input type="date" value={draft.date || ""} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
        </div>
        <div>
          <Label>Topic</Label>
          <Select value={draft.topicId} onValueChange={(v) => setDraft({ ...draft, topicId: v })}>
            <SelectTrigger><SelectValue placeholder="Topic wählen" /></SelectTrigger>
            <SelectContent>
              {topics.map(t => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Bereich</Label>
          <Select value={draft.toAreaId} onValueChange={(v) => setDraft({ ...draft, toAreaId: v })}>
            <SelectTrigger><SelectValue placeholder="Bereich wählen" /></SelectTrigger>
            <SelectContent>
              {areas.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Von</Label>
          <Input value={draft.sentBy || ""} onChange={(e) => setDraft({ ...draft, sentBy: e.target.value })} placeholder="Ihr Name/Team" />
        </div>
        <div>
          <Label>Outcome</Label>
          <Select value={draft.outcome} onValueChange={(v) => setDraft({ ...draft, outcome: v as Outcome })}>
            <SelectTrigger><SelectValue placeholder="Outcome" /></SelectTrigger>
            <SelectContent>
              {["sent","ack","delivered","overdue"].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2">
          <Label>Notizen</Label>
          <Input value={draft.notes || ""} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
        </div>
      </div>
      <button id="log-submit" className="hidden" onClick={() => onSubmit(draft)} />
    </div>
  );
}

/** Import Box */
function ImportBox({ onImport }: { onImport: (file: File, opts: { reassignIds: boolean; merge: boolean }) => void; }) {
  const [file, setFile] = useState<File | null>(null);
  const [reassign, setReassign] = useState(false);
  const [merge, setMerge] = useState(true);
  return (
    <div className="border rounded p-3">
      <div className="flex items-center gap-2">
        <Input type="file" accept=".json,application/json" onChange={(e) => setFile(e.target.files?.[0] || null)} aria-label="JSON Datei wählen" />
        <Button disabled={!file} onClick={() => file && onImport(file, { reassignIds: reassign, merge })}><Upload className="h-4 w-4 mr-1" />{STR.actions.jsonImport}</Button>
      </div>
      <div className="flex items-center gap-4 mt-2">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={merge} onCheckedChange={(v) => setMerge(!!v)} /> Merge (nach ID)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={reassign} onCheckedChange={(v) => setReassign(!!v)} /> IDs neu vergeben
        </label>
      </div>
    </div>
  );
}

/** ==============================
 * Validation & Import helpers
 * ============================== */
function validateTopic(t: Partial<Topic>, state: AppState): string | null {
  if (!t.title || t.title.trim().length < 3) return STR.validations.titleMin;
  if (!t.startDate || !parseISO(t.startDate)) return STR.validations.startDateIso;
  if (!t.teamId || !state.teams.some(x => x.id === t.teamId)) return STR.validations.teamAreaExist;
  const areas = (t.areaIds || "").split(",").map(s => s.trim()).filter(Boolean);
  if (areas.length === 0 || !areas.every(a => state.areas.some(x => x.id === a))) return STR.validations.teamAreaExist;
  if (t.dueStrategy === "relative" && (t.dueOffsetDays === undefined || isNaN(Number(t.dueOffsetDays)))) return STR.validations.relativeOffset;
  return null;
}
function validateImportedState(obj: any): true | string {
  if (!obj || typeof obj !== "object") return "Kein Objekt";
  for (const k of ["teams","areas","topics","logs"]) if (!Array.isArray(obj[k])) return `Feld '${k}' fehlt/ist nicht Array`;
  return true;
}
function mergeById<T extends { id: ID }>(a: T[], b: T[]): T[] {
  const map = new Map<ID, T>(); a.forEach(x => map.set(x.id, x)); b.forEach(x => map.set(x.id, x)); return Array.from(map.values());
}

/** ==============================
 * Misc helpers
 * ============================== */
function isInputLike(el: any) { return el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA"); }
function SaveIcon() { return <Download className="h-4 w-4 mr-1 rotate-180" />; }
function toastMsg(title: string, variant?: "default" | "destructive") { try { toast({ title, variant }); } catch { console.log(title); } }

/** ==============================
 * Inline Tests (console)
 * ============================== */
function runInlineTests() {
  console.group("InlineTests");
  // cadenceNextDate
  console.assert(cadenceNextDate("2025-01-01","one-off")==="2025-01-01","one-off static");
  console.assert(cadenceNextDate("2025-01-01","weekly","2025-01-08")==="2025-01-15","weekly +7");
  console.assert(cadenceNextDate("2025-01-31","monthly","2025-01-31").startsWith("2025-02"),"monthly +1");
  // CSV
  const csv = topicsToCSV([{ id:"1", teamId:"T", title:"X", description:"", areaIds:"A", cadence:"monthly", startDate:"2025-01-01", dueStrategy:"fixed-date", expectedDeliverable:"D", priority:"low", status:"planned", tags:"t", lastRequestDate:"2025-01-01", nextRequestDate:"2025-02-01" } as any]);
  console.assert(csv.split("\n").length>=2, "CSV rows");
  // JSON validation
  console.assert(validateImportedState({teams:[],areas:[],topics:[],logs:[]})===true,"schema ok");
  console.groupEnd();
}

/** ==============================
 * README (Kurz)
 * ==============================
 * Architektur:
 * - Single-File React (TypeScript), default export.
 * - In-File Store: useReducer + Undo (1-Step) + Context; Persistenz via localStorage ("work-request-planner:v1").
 * - Tabs: Übersicht, Matrix, Kalender, Themen, Protokoll, Reports.
 * - Recharts für Minimap/Reports, shadcn/ui für UI (Buttons, Cards, Dialoge, Tabs, Table, Badge, Input, Select, Sheet, Tooltip, Toast).
 *
 * Datenmodell:
 * - Team, Area, Topic, RequestLog (entspricht Spezifikation).
 * - nextRequestDate wird via cadenceNextDate(startDate, cadence, lastRequestDate?) berechnet.
 * - Matrix zählt aktive Themen (planned|active|blocked) pro Team×Bereich und zeigt die nächste Anfrage.
 *
 * Validierung:
 * - Titel ≥ 3, Startdatum ISO, dueStrategy vs. dueOffsetDays konsistent, Team/Area existieren.
 *
 * Import/Export:
 * - JSON (kompletter State), CSV (Topics). Import mit Merge (nach id) oder vollständigem Replace, optional IDs neu vergeben.
 *
 * Reports:
 * - Chart 1: Requests/Monat (12M Rolling).
 * - Chart 2: Top 10 Bereiche.
 * - Chart 3: Anteil Cadences (Pie).
 *
 * Accessibility:
 * - ARIA durch native Labels, Fokus-freundliche Controls, Tastaturkürzel: '/' Suche, 'n' neues Thema, 'e' Import, 'Delete' reserviert.
 *
 * Edgecases:
 * - Leere DB (Leerzustand mit Demo-CTA).
 * - Viele Topics: einfache Pagination (20/Seite).
 * - Kalender: Badge-Stacking + Drawer für Tagesdetails.
 *
 * Erweiterungen (Hooks im Code vorhanden):
 * // EXT-ROLES: Rollen/Rechte (Read-Only für externe Bereiche) – Guard in Actions & UI.
 * // EXT-ICS: ICS-Export je Topic (Serie) – neue Utility zum Generieren von VEVENT.
 * // EXT-REMIND: E-Mail-Reminder Copy-Template – Button im Detailpanel.
 * // EXT-WEBHOOK: Webhook-Stub – Dispatch erweitern und Outbox-Queue in localStorage.
 */
