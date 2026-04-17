import Anthropic from "@anthropic-ai/sdk";

interface Equipment {
  id: string;
  name: string;
  type: string;
  location: string;
  serialNumber: string;
  status: string;
  parentId?: string | null;
}

interface OpenWorkOrder {
  id: string;
  title: string;
  equipmentName: string;
  status: string;
  priority: string;
}

interface ActiveProject {
  id: string;
  title: string;
  status: string;
  phase: string;
  keywords?: string | null;
}

interface ActiveSchedule {
  id: string;
  title: string;
  equipmentName: string;
  frequency: string;
  nextDue: Date;
}

export interface AnalyzeContext {
  equipment: Equipment[];
  workOrders?: OpenWorkOrder[];
  projects?: ActiveProject[];
  schedules?: ActiveSchedule[];
}

export type SuggestionKind =
  | "maintenance"
  | "project"
  | "equipment"
  | "child_component";

// Per-kind proposed fields the reviewer can edit before approval.
export interface MaintenanceProposedFields {
  equipmentId?: string | null;
  title?: string;
  description?: string;
  frequency?: "daily" | "weekly" | "monthly" | "quarterly" | "annual";
  nextDue?: string; // ISO date (YYYY-MM-DD)
}

export interface ProjectProposedFields {
  title?: string;
  description?: string;
  priority?: "low" | "medium" | "high" | "critical";
  status?: "planning" | "in_progress" | "on_hold" | "completed";
  dueDate?: string; // ISO date
  budget?: string;
  keywords?: string;
}

export interface EquipmentProposedFields {
  name?: string;
  type?: string;
  location?: string;
  serialNumber?: string;
  status?: "operational" | "needs_service" | "down";
  criticality?: "A" | "B" | "C";
  equipmentClass?: string;
  groupName?: string;
  parentEquipmentId?: string | null; // optional parent equipment guess
  notes?: string;
}

export interface ChildComponentProposedFields {
  name?: string;
  type?: string; // e.g. "pump" | "motor" | "charger" | "vfd"
  location?: string;
  serialNumber?: string;
  status?: "operational" | "needs_service" | "down";
  parentEquipmentId: string; // required for child_component
  notes?: string;
  autoCreateWorkOrder?: boolean;
}

export type ProposedFields =
  | MaintenanceProposedFields
  | ProjectProposedFields
  | EquipmentProposedFields
  | ChildComponentProposedFields;

interface SuggestedAction {
  type:
    | "create_work_order"
    | "create_maintenance_log"
    | "update_equipment_status"
    | "flag_for_review"
    | "create_project"
    | "progress_existing"
    | "create_auxiliary_equipment";
  // AI classification of which record type this suggestion should produce.
  kind?: SuggestionKind;
  // Per-kind proposed values (populated when kind is set).
  proposedFields?: ProposedFields;
  equipmentId: string;
  equipmentName: string;
  title: string;
  description: string;
  priority?: "low" | "medium" | "high" | "critical";
  newStatus?: "operational" | "needs_service" | "down";
  partsUsed?: string;
  isNewEquipment?: boolean;
  budget?: string;
  // progress_existing: update an existing record with new notes
  existingRecordType?: "WorkOrder" | "Project" | "MaintenanceSchedule";
  existingRecordId?: string;
  progressNote?: string;
  // create_auxiliary_equipment: child component of an existing equipment
  parentEquipmentId?: string;
  auxiliaryType?: string; // "pump" | "motor" | "charger" | etc.
  autoCreateWorkOrder?: boolean;
}

export interface AIAnalysisResult {
  relevant: boolean;
  confidence: number;
  reasoning: string;
  suggestedActions: SuggestedAction[];
}

// Map a suggestion action's `type` to its record `kind` when the model didn't
// supply one (back-compat for older flows).
function inferKindFromType(type: SuggestedAction["type"]): SuggestionKind {
  switch (type) {
    case "create_project":
      return "project";
    case "create_maintenance_log":
      return "maintenance";
    case "create_auxiliary_equipment":
      return "child_component";
    case "create_work_order":
    case "update_equipment_status":
      return "equipment";
    default:
      return "project";
  }
}

// Build a best-effort proposedFields object from whatever the model gave us
// (either as a dedicated proposedFields blob, or fallback to the legacy
// top-level SuggestedAction fields). Also scrubs any parentEquipmentId that
// does not match a real equipment id.
function normalizeProposedFields(
  kind: SuggestionKind,
  action: SuggestedAction,
  validEquipmentIds: Set<string>
): ProposedFields {
  const incoming = (action.proposedFields ?? {}) as Record<string, unknown>;
  const validEqId = (id: unknown): string | null => {
    if (typeof id === "string" && id && id !== "unknown" && validEquipmentIds.has(id)) {
      return id;
    }
    return null;
  };

  if (kind === "project") {
    return {
      title: (incoming.title as string) || action.title || "",
      description: (incoming.description as string) || action.description || "",
      priority: (incoming.priority as ProjectProposedFields["priority"]) ||
        action.priority || "medium",
      status: (incoming.status as ProjectProposedFields["status"]) || "planning",
      dueDate: (incoming.dueDate as string) || "",
      budget: (incoming.budget as string) || action.budget || "",
      keywords: (incoming.keywords as string) || "",
    };
  }

  if (kind === "maintenance") {
    return {
      equipmentId:
        validEqId(incoming.equipmentId) ?? validEqId(action.equipmentId) ?? null,
      title: (incoming.title as string) || action.title || "",
      description:
        (incoming.description as string) || action.description || "",
      frequency:
        (incoming.frequency as MaintenanceProposedFields["frequency"]) ||
        "monthly",
      nextDue: (incoming.nextDue as string) || "",
    };
  }

  if (kind === "equipment") {
    return {
      name: (incoming.name as string) || action.equipmentName || "",
      type: (incoming.type as string) || "",
      location: (incoming.location as string) || "",
      serialNumber: (incoming.serialNumber as string) || "",
      status:
        (incoming.status as EquipmentProposedFields["status"]) ||
        action.newStatus ||
        "needs_service",
      criticality:
        (incoming.criticality as EquipmentProposedFields["criticality"]) || "C",
      equipmentClass: (incoming.equipmentClass as string) || "",
      groupName: (incoming.groupName as string) || "",
      parentEquipmentId:
        validEqId(incoming.parentEquipmentId) ??
        validEqId(action.parentEquipmentId) ??
        null,
      notes: (incoming.notes as string) || action.description || "",
    };
  }

  // child_component
  const parent =
    validEqId(incoming.parentEquipmentId) ??
    validEqId(action.parentEquipmentId) ??
    "";
  return {
    name:
      (incoming.name as string) ||
      action.equipmentName ||
      (action.auxiliaryType ? `${action.auxiliaryType}` : ""),
    type: (incoming.type as string) || action.auxiliaryType || "Component",
    location: (incoming.location as string) || "",
    serialNumber: (incoming.serialNumber as string) || "",
    status:
      (incoming.status as ChildComponentProposedFields["status"]) ||
      "needs_service",
    parentEquipmentId: parent,
    notes: (incoming.notes as string) || action.description || "",
    autoCreateWorkOrder:
      typeof incoming.autoCreateWorkOrder === "boolean"
        ? (incoming.autoCreateWorkOrder as boolean)
        : action.autoCreateWorkOrder ?? false,
  };
}

const client = new Anthropic();

function formatEquipment(list: Equipment[]): string {
  return list
    .map(
      (e) =>
        `- ID: ${e.id} | Name: "${e.name}" | Type: ${e.type} | Location: ${e.location} | Serial: ${e.serialNumber} | Status: ${e.status}${e.parentId ? ` | Parent: ${e.parentId}` : ""}`
    )
    .join("\n");
}

function formatWorkOrders(list: OpenWorkOrder[]): string {
  if (!list.length) return "(none open)";
  return list
    .map((w) => `- ID: ${w.id} | "${w.title}" | Equipment: ${w.equipmentName} | Status: ${w.status} | Priority: ${w.priority}`)
    .join("\n");
}

function formatProjects(list: ActiveProject[]): string {
  if (!list.length) return "(none active)";
  return list
    .map((p) => {
      const kw = p.keywords?.trim() ? ` | Keywords: ${p.keywords.trim()}` : "";
      return `- ID: ${p.id} | "${p.title}" | Status: ${p.status} | Phase: ${p.phase}${kw}`;
    })
    .join("\n");
}

function formatSchedules(list: ActiveSchedule[]): string {
  if (!list.length) return "(none active)";
  return list
    .map(
      (s) =>
        `- ID: ${s.id} | "${s.title}" | Equipment: ${s.equipmentName} | Frequency: ${s.frequency} | Next due: ${s.nextDue.toISOString().slice(0, 10)}`
    )
    .join("\n");
}

export async function analyzeMessage(
  message: { subject?: string; body: string; senderName: string; senderEmail: string },
  context: AnalyzeContext | Equipment[]
): Promise<AIAnalysisResult> {
  // Back-compat: allow bare equipment array
  const ctx: AnalyzeContext = Array.isArray(context) ? { equipment: context } : context;
  const equipmentList = ctx.equipment;
  const workOrders = ctx.workOrders ?? [];
  const projects = ctx.projects ?? [];
  const schedules = ctx.schedules ?? [];

  const prompt = `You are an AI assistant for the QMS (Quality Management System) at **RubberForm Recycled Products LLC**, a rubber recycling manufacturer in Buffalo, NY. Your job is to analyze emails and Teams messages to identify maintenance, equipment, project, and operational content, then suggest actions — including progressing existing records instead of creating duplicates.

## About RubberForm
RubberForm recycles rubber (primarily tires) into manufactured products like mats, pavers, and custom molded goods. Operations include shredding, grinding/granulating, mixing, molding, pressing, and shipping. The facility has production lines, a shop/maintenance area, warehouse, loading docks, office, and yard.

## Key People at RubberForm
- **shop@rubberform.com** — Shop/maintenance team shared mailbox. ALWAYS relevant.
- **Joe** (joe@rubberform.com) — Plant operations.
- **Anthony** (anthony@rubberform.com) — Operations.
- **Jesse** (jesse@rubberform.com) — Operations/shop.
- **Jesse at InQuip** (jesse@inquip.com) — External equipment supplier/service partner.
- **Bill** (bill@rubberform.com) — Management / capital equipment.
- **Aaron** (aaron@rubberform.com) — Operations.

## Equipment Registry
${equipmentList.length ? formatEquipment(equipmentList) : "(No equipment registered yet — suggest adding new equipment if mentioned)"}

## Open Work Orders
${formatWorkOrders(workOrders)}

## Active Projects
${formatProjects(projects)}

## Active Maintenance Schedules
${formatSchedules(schedules)}

## Manufacturing Domain Knowledge
**Vehicles & Fleet:** forklift, truck, loader, bobcat, plow, trailer, fleet, van, pickup, Penske, F250 / F-250, box truck
**Pumps:** hydraulic pump, water pump, sump pump, vacuum pump, transfer pump, fuel pump, coolant pump
**Rubber Processing:** extruder, grinder, baler, conveyor, shredder, granulator, mixer, press, mold, vulcanizer, crusher, roller, hopper, feeder, separator
**Motors & Power:** motor, compressor, generator, engine, gearbox, VFD, transformer, breaker, charger
**Hoses & Plumbing:** hydraulic hose, air hose, pipe, tubing, fitting, manifold, regulator
**Fluids:** hydraulic oil, gear oil, coolant, lubricant, grease, diesel, propane
**Parts:** bearing, belt, filter, gasket, seal, valve, rotor, impeller, sprocket, chain, blade, die, shaft
**Safety:** OSHA, LOTO, fire extinguisher, eye wash, incident, near-miss
**Facility:** HVAC, roof, door, dock leveler, overhead door, plumbing

## Message to Analyze
From: ${message.senderName} (${message.senderEmail})
Subject: ${message.subject || "(No subject)"}
Body:
${message.body.slice(0, 4000)}

## Instructions

### Relevance gate — REJECT these outright
These are **NEVER** QMS-relevant. If the email is one of these, set relevant=false:
- **Invoices, billing statements, accounts receivable/payable, financial reports, purchase order confirmations** — we do not track billing in QMS.
- Quotes that are purely financial with **no** equipment, part, or service content (e.g. a bare dollar number with no context).
- Sports tickets, box seats, game schedules (Sabres, Bills, etc.).
- Social events, happy hours, team outings, lunch orders.
- Marketing, newsletters, promotions, webinars.
- Job postings, recruiting, HR benefits.
- LTL/freight trucking rate quotes (unless about plant vehicle repair).
- Password resets, license renewals, software notifications.

**"Service" means equipment/maintenance service, NOT customer service or trucking service.**

### Relevance boosters — ALWAYS treat as relevant
Emails matching any of these patterns are RubberForm-operational and should be acted on (create_work_order, progress_existing, create_auxiliary_equipment, flag_for_review, etc.), never marked not-relevant:

- **External equipment/parts/service vendor replies** about RubberForm equipment. Examples of vendor signals: sender name or domain includes "parts", "service", "equipment", "industrial", "machinery", "repair", "supply"; names like Veritiv, Polychem, InQuip, Grainger, MSC, Motion, Applied, Kaman, Fastenal, McMaster, Bearings Inc., hydraulic/pneumatic shops; signature blocks listing equipment brands.
- **Any email naming a specific RubberForm machine, model, or equipment type** in the subject or body — even if it's a forwarded reply, thread, or carries a ref/case number (e.g. "[ ref:!00D... ]"). Equipment names/models like "PC-102", "table bander", "Dake press", "granulator", "extruder", "forklift", specific serial numbers, brand+model combos. This applies regardless of whether the equipment is in the registry yet. If unregistered, suggest create_work_order with isNewEquipment=true or flag_for_review.
- **Quotes, estimates, or pricing** that reference a specific piece of equipment, part, or service. "Quote for hydraulic pump rebuild on Dake" is relevant — log it (create_project or create_work_order). Only reject if the quote is literally a standalone dollar figure with zero equipment context.
- **Forwards (FW:/Fwd:) from our own team** that include any of the above — treat the forwarded content as the subject of analysis.
- **Vendor case/ticket acknowledgments** referencing our equipment (ref numbers, case IDs) — use progress_existing if tied to an open WO/project, otherwise create_work_order or flag_for_review.

When in doubt between "not relevant" and "flag_for_review", ALWAYS pick flag_for_review. A missed equipment/vendor email is a bigger cost than a false positive in the queue.

### Match emails to EXISTING records first
Before creating anything new, check the Open Work Orders, Active Projects, and Active Maintenance Schedules lists above. If this email is a progress update, parts-shipping notice, vendor reply, or follow-up to something already tracked:
- Use **progress_existing** with existingRecordType, existingRecordId, and a concise progressNote of what's new.
- Examples: "parts shipped Tuesday" on a WO already waiting on parts → progress_existing. "Jesse sent the quote we asked about" on an active project → progress_existing.

**Project keywords are authoritative.** Each Active Project may list Keywords — synonyms, facility areas, or shorthand terms that map to that project. If an email mentions any of those keywords (even loosely — e.g. "upstairs", "2nd floor", "new floor", "flooring estimate"), strongly prefer **progress_existing** against that project over creating a new one or flagging for review.

### Auxiliary equipment (child components)
When an email describes a component (pump, motor, charger, VFD) being ordered/installed/serviced for an existing piece of equipment in the registry, use **create_auxiliary_equipment** with parentEquipmentId set to the parent. Optionally set autoCreateWorkOrder=true if service/install work is described.
- Example: "Ordered new hydraulic pump for the Dake press" → create_auxiliary_equipment, parentEquipmentId=<Dake press id>, auxiliaryType="pump", autoCreateWorkOrder=true.

### Other action types
- **create_work_order**: New repair/service request with no matching open WO.
  - critical: safety hazard, equipment down, production stopped
  - high: significant degradation, intermittent failure
  - medium: scheduled maintenance, parts to order
  - low: cosmetic, future
- **create_maintenance_log**: Work already performed — log what was done.
- **update_equipment_status**: Equipment status should change (down/needs_service/operational).
- **create_project**: Capital equipment purchase, installation, upgrade, multi-step facility improvement. Include budget if mentioned.
- **flag_for_review**: Seems relevant, low confidence — better to flag than miss.

### Parts vs equipment
- Part mentioned FOR a registered parent → create_auxiliary_equipment.
- Part mentioned with no parent match → flag_for_review.
- Standalone equipment (vehicle, press, grinder, forklift) → create_work_order or update_equipment_status with isNewEquipment=true.

### Informal language — be smart
- "the big green one is acting up" → equipment issue
- "line 2 is down" → update_equipment_status newStatus=down
- "oil leaking near dock 3" → create_work_order
- "truck won't start" → vehicle maintenance
- "parts came in today" on an existing WO → progress_existing

### Confidence
0.0–1.0. Be generous — flag (0.5+) over miss (<0.3).

## Record-kind classification (REQUIRED)
For every suggestion you emit, also classify which **record kind** the reviewer will create when they approve it. Set \`kind\` to one of:
- **maintenance** — a recurring \`MaintenanceSchedule\` (PM, inspection due, calibration due, "every 30 days").
- **project** — a \`Project\` (capital purchase, multi-step install, facility improvement, estimate/quote threads).
- **equipment** — a new standalone \`Equipment\` record (press, grinder, forklift, truck, compressor). Work orders tied to existing equipment also fall under this kind — the work order is the action, the equipment is the primary record.
- **child_component** — an auxiliary/child \`Equipment\` record with a required parent (pump for a press, charger for a forklift, VFD for an extruder).

For each kind you must also populate \`proposedFields\` with the best values you can infer from the email. Leave fields you can't infer as null/empty — the reviewer will fill them in. Required shape per kind:

### kind = "maintenance"
\`proposedFields\` = {
  "equipmentId": "<existing equipment id, or null>",
  "title": "Short schedule title",
  "description": "What the schedule covers",
  "frequency": "daily" | "weekly" | "monthly" | "quarterly" | "annual",
  "nextDue": "YYYY-MM-DD"
}

### kind = "project"
\`proposedFields\` = {
  "title": "Project title",
  "description": "Scope / goals",
  "priority": "low" | "medium" | "high" | "critical",
  "status": "planning" | "in_progress" | "on_hold" | "completed",
  "dueDate": "YYYY-MM-DD or null",
  "budget": "$ amount or null",
  "keywords": "comma-separated synonyms for future email matching"
}

### kind = "equipment"
\`proposedFields\` = {
  "name": "Equipment name",
  "type": "Press | Grinder | Forklift | Vehicle | Pump | etc.",
  "location": "where in the facility",
  "serialNumber": "serial if known, else null",
  "status": "operational" | "needs_service" | "down",
  "criticality": "A" | "B" | "C",
  "equipmentClass": "extruders | presses | forklifts | utilities | other",
  "groupName": "group label or null",
  "parentEquipmentId": "<existing equipment id if this is logically under a parent, else null>",
  "notes": "anything useful from the email"
}

### kind = "child_component"
\`proposedFields\` = {
  "name": "Component name (e.g. 'Main hydraulic pump')",
  "type": "pump | motor | charger | vfd | gearbox | etc.",
  "location": "typically inherit from parent if unknown",
  "serialNumber": "if known, else null",
  "status": "operational" | "needs_service" | "down",
  "parentEquipmentId": "<REQUIRED — existing equipment id of the parent>",
  "notes": "what the email said about it",
  "autoCreateWorkOrder": true/false
}

Use the Equipment Registry list above to pick real equipment IDs when referencing a parent or a maintenance target. If no good match exists, set the id to null (maintenance / equipment) or flag the suggestion instead of guessing (child_component).

## Response Format
Respond with ONLY valid JSON, no markdown, no prose:
{
  "relevant": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation",
  "suggestedActions": [
    {
      "type": "create_work_order" | "create_maintenance_log" | "update_equipment_status" | "flag_for_review" | "create_project" | "progress_existing" | "create_auxiliary_equipment",
      "kind": "maintenance" | "project" | "equipment" | "child_component",
      "proposedFields": { /* per-kind shape from above */ },
      "equipmentId": "registry id or 'unknown'",
      "equipmentName": "equipment name or description",
      "title": "Short descriptive title",
      "description": "Detailed description",
      "priority": "low" | "medium" | "high" | "critical",
      "newStatus": "operational" | "needs_service" | "down",
      "partsUsed": "parts mentioned if any",
      "isNewEquipment": true/false,
      "budget": "budget amount if project",
      "existingRecordType": "WorkOrder" | "Project" | "MaintenanceSchedule",
      "existingRecordId": "id of existing record",
      "progressNote": "what's new to append",
      "parentEquipmentId": "parent id for auxiliary equipment",
      "auxiliaryType": "pump | motor | charger | vfd | etc.",
      "autoCreateWorkOrder": true/false
    }
  ]
}

If not relevant: {"relevant": false, "confidence": 0.9, "reasoning": "Not relevant: ...", "suggestedActions": []}`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  try {
    const result = JSON.parse(text) as AIAnalysisResult;

    // Validate equipment IDs against actual registry (allow "unknown" and
    // allow progress_existing / create_auxiliary_equipment to reference an
    // existing record without a direct equipmentId match).
    const validEquipmentIds = new Set(equipmentList.map((e) => e.id));
    const validWorkOrderIds = new Set(workOrders.map((w) => w.id));
    const validProjectIds = new Set(projects.map((p) => p.id));
    const validScheduleIds = new Set(schedules.map((s) => s.id));

    result.suggestedActions = result.suggestedActions.filter((action) => {
      if (action.type === "progress_existing") {
        const ok =
          (action.existingRecordType === "WorkOrder" && action.existingRecordId && validWorkOrderIds.has(action.existingRecordId)) ||
          (action.existingRecordType === "Project" && action.existingRecordId && validProjectIds.has(action.existingRecordId)) ||
          (action.existingRecordType === "MaintenanceSchedule" && action.existingRecordId && validScheduleIds.has(action.existingRecordId));
        if (!ok) {
          console.warn("[AI Analyzer] progress_existing with invalid target — converting to flag_for_review");
          action.type = "flag_for_review";
          action.equipmentId = "unknown";
        }
        return true;
      }

      if (action.type === "create_auxiliary_equipment") {
        if (!action.parentEquipmentId || !validEquipmentIds.has(action.parentEquipmentId)) {
          console.warn("[AI Analyzer] create_auxiliary_equipment with invalid parent — converting to flag_for_review");
          action.type = "flag_for_review";
          action.equipmentId = "unknown";
        }
        return true;
      }

      if (action.equipmentId === "unknown") return true;
      if (!validEquipmentIds.has(action.equipmentId)) {
        console.warn(
          `[AI Analyzer] Invalid equipment ID "${action.equipmentId}" — converting to flag_for_review`
        );
        action.type = "flag_for_review";
        action.equipmentId = "unknown";
      }
      return true;
    });

    // Ensure every action has a `kind` and a `proposedFields` object so the
    // review UI can render a per-kind editor even when the model skipped it.
    result.suggestedActions = result.suggestedActions.map((action) => {
      const kind: SuggestionKind = action.kind ?? inferKindFromType(action.type);
      const proposedFields = normalizeProposedFields(
        kind,
        action,
        validEquipmentIds
      );
      return { ...action, kind, proposedFields };
    });

    return result;
  } catch {
    console.error("[AI Analyzer] Failed to parse Claude response:", text);
    return {
      relevant: false,
      confidence: 0,
      reasoning: "Failed to parse AI response",
      suggestedActions: [],
    };
  }
}
