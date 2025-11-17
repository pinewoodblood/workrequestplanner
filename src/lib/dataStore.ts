// src/lib/dataStore.ts (Pfad ggf. anpassen)

import { supabase } from "./supabaseClient";
import type { Team, Area, Topic, RequestLog } from "../WorkRequestPlannerApp";

// ------------------------------------------------------------------
// AppState & DataStore Interface
// ------------------------------------------------------------------

export interface AppState {
  teams: Team[];
  areas: Area[];
  topics: Topic[];
  logs: RequestLog[];
}

export interface DataStore {
  // Vollständigen Zustand aus Supabase laden
  loadState(): Promise<AppState>;

  // Teams
  addTeam(input: Omit<Team, "id">): Promise<Team>;
  updateTeam(team: Team): Promise<Team>;
  deleteTeam(id: string): Promise<void>;

  // Areas
  addArea(input: Omit<Area, "id">): Promise<Area>;
  updateArea(area: Area): Promise<Area>;
  deleteArea(id: string): Promise<void>;

  // Topics (inkl. topic_areas)
  addTopic(input: Omit<Topic, "id">): Promise<Topic>;
  updateTopic(topic: Topic): Promise<Topic>;
  deleteTopic(id: string): Promise<void>;

  // Request Logs
  addLog(input: Omit<RequestLog, "id">): Promise<RequestLog>;
  updateLog(log: RequestLog): Promise<RequestLog>;
  deleteLog(id: string): Promise<void>;
  
   /** Alles (Teams, Areas, Topics, Logs) für diesen User löschen */
   deleteAllForUser(): Promise<void>;
  
  // JSON Upload
  replaceAllWithSnapshot(
    snapshot: AppState,
    mode?: "append" | "truncateAll"
  ): Promise<void>;
}

// ------------------------------------------------------------------
// Hilfsfunktionen
// ------------------------------------------------------------------

// areaIds-String / Array → saubere Liste von IDs
function parseAreaIds(
  areaIds: string | string[] | undefined | null
): string[] {
  if (!areaIds) return [];
  if (Array.isArray(areaIds)) {
    return areaIds
      .map((s) => (s ?? "").trim())
      .filter(Boolean);
  }
  return areaIds
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Topic → DB-Row (ohne Joins)
// Typ extra locker, damit sowohl Omit<Topic, "id"> als auch Topic passt
function mapTopicToDb(topic: {
  id?: string;
  teamId: string;
  title: string;
  description?: string;
  cadence?: Topic["cadence"];
  startDate?: string;
  dueStrategy?: Topic["dueStrategy"];
  dueOffsetDays?: number;
  expectedDeliverable?: string;
  priority?: Topic["priority"];
  status?: Topic["status"];
  tags?: string;
  lastRequestDate?: string;
  nextRequestDate?: string;
}) {
  return {
    id: topic.id, // wird bei insert ignoriert, wenn undefined
    team_id: topic.teamId,
    title: topic.title,
    description: topic.description ?? null,
    cadence: topic.cadence ?? null,
    start_date: topic.startDate ?? null,
    due_strategy: topic.dueStrategy ?? null,
    due_offset_days:
      typeof topic.dueOffsetDays === "number"
        ? topic.dueOffsetDays
        : null,
    expected_deliverable: topic.expectedDeliverable ?? "",
    priority: topic.priority ?? "medium",
    status: topic.status ?? "planned",
    tags: topic.tags ?? "",
    last_request_date: topic.lastRequestDate ?? null,
    next_request_date: topic.nextRequestDate ?? null,
  };
}

function mapTeamFromDb(row: any): Team {
  return {
    id: row.id,
    name: row.name,
    owner: row.owner ?? "",
  };
}

function mapAreaFromDb(row: any): Area {
  return {
    id: row.id,
    name: row.name,
    contact: row.contact ?? "",
  };
}

function mapLogFromDb(row: any): RequestLog {
  return {
    id: row.id,
    topicId: row.topic_id,
    date: row.date,
    sentBy: row.sent_by,
    toAreaId: row.to_area_id,
    notes: row.notes ?? "",
    outcome: row.outcome,
  };
}

// n:m Topic ↔ Areas in Supabase pflegen
async function syncTopicAreas(topicId: string, areaIds: string[]) {
  // erst alle alten Zuordnungen dieses Topics löschen
  const { error: delError } = await supabase
    .from("topic_areas")
    .delete()
    .eq("topic_id", topicId);

  if (delError) {
    console.error("Fehler beim Löschen aus topic_areas:", delError);
    throw delError;
  }

  // wenn keine Bereiche verknüpft sein sollen → fertig
  if (!areaIds.length) return;

  const rows = areaIds.map((areaId) => ({
    topic_id: topicId,
    area_id: areaId,
  }));

  const { error: insError } = await supabase
    .from("topic_areas")
    .insert(rows);

  if (insError) {
    console.error("Fehler beim Einfügen in topic_areas:", insError);
    throw insError;
  }
}

// ------------------------------------------------------------------
// dataStore – zentrale Backend-Schnittstelle (Supabase als Source of Truth)
// ------------------------------------------------------------------

export const dataStore: DataStore = {
  /**
   * Lädt den kompletten Zustand aus Supabase:
   * - teams
   * - areas
   * - topics inkl. topic_areas
   * - request_logs
   *
   * Topic.areaIds wird als kommaseparierter String aufgebaut,
   * damit dein bestehender UI-Code weiter funktioniert.
   */
  async loadState(): Promise<AppState> {
    // Teams
    const teamsRes = await supabase
      .from("teams")
      .select("*")
      .order("created_at", { ascending: true });
    if (teamsRes.error) throw teamsRes.error;

    // Areas
    const areasRes = await supabase
      .from("areas")
      .select("*")
      .order("created_at", { ascending: true });
    if (areasRes.error) throw areasRes.error;

    // Topics + topic_areas (JOIN)
    const topicsRes = await supabase
      .from("topics")
      .select(
        `
        id,
        team_id,
        title,
        description,
        cadence,
        start_date,
        due_strategy,
        due_offset_days,
        expected_deliverable,
        priority,
        status,
        tags,
        last_request_date,
        next_request_date,
        topic_areas (
          area_id
        )
      `
      )
      .order("created_at", { ascending: true });
    if (topicsRes.error) throw topicsRes.error;

    // Request Logs
    const logsRes = await supabase
      .from("request_logs")
      .select("*")
      .order("date", { ascending: true });
    if (logsRes.error) throw logsRes.error;

    // Mapping
    const teams: Team[] = (teamsRes.data ?? []).map(mapTeamFromDb);
    const areas: Area[] = (areasRes.data ?? []).map(mapAreaFromDb);

    const topics: Topic[] = (topicsRes.data ?? []).map((row: any) => {
      const topicAreas: { area_id: string }[] = row.topic_areas ?? [];
      const areaIds = topicAreas.map((ta) => ta.area_id).join(",");

      const topic: Topic = {
        id: row.id,
        teamId: row.team_id,
        title: row.title,
        description: row.description ?? "",
        cadence: row.cadence,
        startDate: row.start_date,
        dueStrategy: row.due_strategy,
        dueOffsetDays:
          row.due_offset_days === null
            ? undefined
            : row.due_offset_days,
        expectedDeliverable: row.expected_deliverable,
        priority: row.priority,
        status: row.status,
        tags: row.tags ?? "",
        lastRequestDate:
          row.last_request_date === null
            ? undefined
            : row.last_request_date,
        nextRequestDate:
          row.next_request_date === null
            ? undefined
            : row.next_request_date,
        areaIds,
      };

      return topic;
    });

    const logs: RequestLog[] = (logsRes.data ?? []).map(mapLogFromDb);

    return { teams, areas, topics, logs };
  },

  // ----------------------------- Teams -----------------------------

  async addTeam(input: Omit<Team, "id">): Promise<Team> {
    const payload = {
      name: input.name,
      owner: input.owner ?? "",
    };

    const res = await supabase
      .from("teams")
      .insert(payload)
      .select("*")
      .single();

    if (res.error) throw res.error;
    return mapTeamFromDb(res.data);
  },

  async updateTeam(team: Team): Promise<Team> {
    if (!team.id) throw new Error("updateTeam: team.id fehlt");

    const payload = {
      name: team.name,
      owner: team.owner ?? "",
    };

    const res = await supabase
      .from("teams")
      .update(payload)
      .eq("id", team.id)
      .select("*")
      .single();

    if (res.error) throw res.error;
    return mapTeamFromDb(res.data);
  },

  async deleteTeam(id: string): Promise<void> {
    // Optional: abhängige Topics/Logs/Joins löschen,
    // falls du kein ON DELETE CASCADE gesetzt hast.
    const topicsRes = await supabase
      .from("topics")
      .select("id")
      .eq("team_id", id);

    if (topicsRes.error) throw topicsRes.error;

    const topicIds = (topicsRes.data ?? []).map((t: any) => t.id);

    if (topicIds.length > 0) {
      await supabase.from("topic_areas").delete().in("topic_id", topicIds);
      await supabase.from("request_logs").delete().in("topic_id", topicIds);
      await supabase.from("topics").delete().in("id", topicIds);
    }

    const delTeam = await supabase.from("teams").delete().eq("id", id);
    if (delTeam.error) throw delTeam.error;
  },

  // ----------------------------- Areas -----------------------------

  async addArea(input: Omit<Area, "id">): Promise<Area> {
    const payload = {
      name: input.name,
      contact: input.contact ?? "",
    };

    const res = await supabase
      .from("areas")
      .insert(payload)
      .select("*")
      .single();

    if (res.error) throw res.error;
    return mapAreaFromDb(res.data);
  },

  async updateArea(area: Area): Promise<Area> {
    if (!area.id) throw new Error("updateArea: area.id fehlt");

    const payload = {
      name: area.name,
      contact: area.contact ?? "",
    };

    const res = await supabase
      .from("areas")
      .update(payload)
      .eq("id", area.id)
      .select("*")
      .single();

    if (res.error) throw res.error;
    return mapAreaFromDb(res.data);
  },

  async deleteArea(id: string): Promise<void> {
    // Join-Zuordnungen löschen (oder ON DELETE CASCADE)
    const delJoins = await supabase
      .from("topic_areas")
      .delete()
      .eq("area_id", id);
    if (delJoins.error) throw delJoins.error;

    const delArea = await supabase.from("areas").delete().eq("id", id);
    if (delArea.error) throw delArea.error;
  },

  // ----------------------------- Topics ----------------------------

  async addTopic(input: Omit<Topic, "id">): Promise<Topic> {
    const dbPayload = mapTopicToDb(input as any);

    const insertRes = await supabase
      .from("topics")
      .insert(dbPayload)
      .select(
        `
        id,
        team_id,
        title,
        description,
        cadence,
        start_date,
        due_strategy,
        due_offset_days,
        expected_deliverable,
        priority,
        status,
        tags,
        last_request_date,
        next_request_date
      `
      )
      .single();

    if (insertRes.error) throw insertRes.error;
    const created = insertRes.data;

    const areaIds = parseAreaIds(input.areaIds);
    await syncTopicAreas(created.id, areaIds);

    const result: Topic = {
      id: created.id,
      teamId: created.team_id,
      title: created.title,
      description: created.description ?? "",
      cadence: created.cadence,
      startDate: created.start_date,
      dueStrategy: created.due_strategy,
      dueOffsetDays:
        created.due_offset_days === null
          ? undefined
          : created.due_offset_days,
      expectedDeliverable: created.expected_deliverable,
      priority: created.priority,
      status: created.status,
      tags: created.tags ?? "",
      lastRequestDate:
        created.last_request_date === null
          ? undefined
          : created.last_request_date,
      nextRequestDate:
        created.next_request_date === null
          ? undefined
          : created.next_request_date,
      areaIds: areaIds.join(","),
    };

    return result;
  },

  async updateTopic(topic: Topic): Promise<Topic> {
    if (!topic.id) {
      throw new Error("updateTopic: topic.id fehlt");
    }

    const dbPayload = mapTopicToDb(topic);

    const updateRes = await supabase
      .from("topics")
      .update(dbPayload)
      .eq("id", topic.id)
      .select(
        `
        id,
        team_id,
        title,
        description,
        cadence,
        start_date,
        due_strategy,
        due_offset_days,
        expected_deliverable,
        priority,
        status,
        tags,
        last_request_date,
        next_request_date
      `
      )
      .single();

    if (updateRes.error) throw updateRes.error;
    const updated = updateRes.data;

    const areaIds = parseAreaIds(topic.areaIds);
    await syncTopicAreas(topic.id, areaIds);

    const result: Topic = {
      id: updated.id,
      teamId: updated.team_id,
      title: updated.title,
      description: updated.description ?? "",
      cadence: updated.cadence,
      startDate: updated.start_date,
      dueStrategy: updated.due_strategy,
      dueOffsetDays:
        updated.due_offset_days === null
          ? undefined
          : updated.due_offset_days,
      expectedDeliverable: updated.expected_deliverable,
      priority: updated.priority,
      status: updated.status,
      tags: updated.tags ?? "",
      lastRequestDate:
        updated.last_request_date === null
          ? undefined
          : updated.last_request_date,
      nextRequestDate:
        updated.next_request_date === null
          ? undefined
          : updated.next_request_date,
      areaIds: areaIds.join(","),
    };

    return result;
  },

  async deleteTopic(id: string): Promise<void> {
    const delJoins = await supabase
      .from("topic_areas")
      .delete()
      .eq("topic_id", id);
    if (delJoins.error) throw delJoins.error;

    const delLogs = await supabase
      .from("request_logs")
      .delete()
      .eq("topic_id", id);
    if (delLogs.error) throw delLogs.error;

    const delTopic = await supabase.from("topics").delete().eq("id", id);
    if (delTopic.error) throw delTopic.error;
  },

  // --------------------------- Request Logs ------------------------

  async addLog(input: Omit<RequestLog, "id">): Promise<RequestLog> {
    const payload = {
      topic_id: input.topicId,
      date: input.date,
      sent_by: input.sentBy,
      to_area_id: input.toAreaId,
      notes: input.notes ?? "",
      outcome: input.outcome,
    };

    const res = await supabase
      .from("request_logs")
      .insert(payload)
      .select("*")
      .single();

    if (res.error) throw res.error;
    return mapLogFromDb(res.data);
  },

  async updateLog(log: RequestLog): Promise<RequestLog> {
    if (!log.id) throw new Error("updateLog: log.id fehlt");

    const payload = {
      topic_id: log.topicId,
      date: log.date,
      sent_by: log.sentBy,
      to_area_id: log.toAreaId,
      notes: log.notes ?? "",
      outcome: log.outcome,
    };

    const res = await supabase
      .from("request_logs")
      .update(payload)
      .eq("id", log.id)
      .select("*")
      .single();

    if (res.error) throw res.error;
    return mapLogFromDb(res.data);
  },

  async deleteLog(id: string): Promise<void> {
    const res = await supabase
      .from("request_logs")
      .delete()
      .eq("id", id);
    if (res.error) throw res.error;
  },

  
  async deleteAllForUser(): Promise<void> {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) {
      throw new Error("Kein eingeloggter Benutzer – deleteAllForUser abgebrochen.");
    }
    const uid = data.user.id;
  
    let res;
  
    res = await supabase.from("topic_areas").delete().eq("user_id", uid);
    if (res.error) throw res.error;
  
    res = await supabase.from("request_logs").delete().eq("user_id", uid);
    if (res.error) throw res.error;
  
    res = await supabase.from("topics").delete().eq("user_id", uid);
    if (res.error) throw res.error;
  
    res = await supabase.from("areas").delete().eq("user_id", uid);
    if (res.error) throw res.error;
  
    res = await supabase.from("teams").delete().eq("user_id", uid);
    if (res.error) throw res.error;
  },

  async replaceAllWithSnapshot(
    snapshot: AppState,
    mode: "append" | "truncateAll" = "append"
  ): Promise<void> {
    const { teams, areas, topics, logs } = snapshot;
  
    if (mode === "truncateAll") {
      await dataStore.deleteAllForUser(); // ⬅ hiermit wird jetzt mit WHERE gelöscht
    }
  
  
    // 2. Teams neu anlegen
    const teamIdMap = new Map<string, string>();
    for (const t of teams) {
      const created = await dataStore.addTeam({
        name: t.name,
        owner: t.owner ?? "",
      });
      teamIdMap.set(t.id, created.id);
    }
  
    // 3. Areas neu anlegen
    const areaIdMap = new Map<string, string>();
    for (const a of areas) {
      const created = await dataStore.addArea({
        name: a.name,
        contact: a.contact ?? "",
      });
      areaIdMap.set(a.id, created.id);
    }
  
    // 4. Topics neu anlegen (mit gemappten IDs)
    const topicIdMap = new Map<string, string>();
    for (const t of topics) {
      // alte areaIds → neue areaIds über areaIdMap mappen
      const oldAreaIds = (t.areaIds || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
  
      const newAreaIds = oldAreaIds
        .map((oldId) => areaIdMap.get(oldId))
        .filter((id): id is string => !!id)
        .join(",");
  
      const created = await dataStore.addTopic({
        teamId: teamIdMap.get(t.teamId)!, // Team muss es geben, sonst war Snapshot inkonsistent
        title: t.title,
        description: t.description,
        cadence: t.cadence,
        startDate: t.startDate,
        dueStrategy: t.dueStrategy,
        dueOffsetDays: t.dueOffsetDays,
        expectedDeliverable: t.expectedDeliverable,
        priority: t.priority,
        status: t.status,
        tags: t.tags,
        lastRequestDate: t.lastRequestDate,
        nextRequestDate: t.nextRequestDate,
        areaIds: newAreaIds,
      });
  
      topicIdMap.set(t.id, created.id);
    }
  
    // 5. Logs neu anlegen (mit gemappten Topic/Area-IDs)
    for (const l of logs) {
      const newTopicId = topicIdMap.get(l.topicId);
      const newAreaId = areaIdMap.get(l.toAreaId);
  
      if (!newTopicId || !newAreaId) {
        console.warn("Log konnte nicht gemappt werden, wird übersprungen:", l);
        continue;
      }
  
      await dataStore.addLog({
        topicId: newTopicId,
        toAreaId: newAreaId,
        date: l.date,
        sentBy: l.sentBy,
        notes: l.notes,
        outcome: l.outcome,
      });
    }
  }
};
