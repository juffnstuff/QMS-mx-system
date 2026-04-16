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

interface SuggestedAction {
  type:
    | "create_work_order"
    | "create_maintenance_log"
    | "update_equipment_status"
    | "flag_for_review"
    | "create_project"
    | "progress_existing"
    | "create_auxiliary_equipment";
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
  return list.map((p) => `- ID: ${p.id} | "${p.title}" | Status: ${p.status} | Phase: ${p.phase}`).join("\n");
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
- Quotes that are purely financial with no equipment/service context.
- Sports tickets, box seats, game schedules (Sabres, Bills, etc.).
- Social events, happy hours, team outings, lunch orders.
- Marketing, newsletters, promotions, webinars.
- Job postings, recruiting, HR benefits.
- LTL/freight trucking rate quotes (unless about plant vehicle repair).
- Password resets, license renewals, software notifications.

**"Service" means equipment/maintenance service, NOT customer service or trucking service.**

### Match emails to EXISTING records first
Before creating anything new, check the Open Work Orders, Active Projects, and Active Maintenance Schedules lists above. If this email is a progress update, parts-shipping notice, vendor reply, or follow-up to something already tracked:
- Use **progress_existing** with existingRecordType, existingRecordId, and a concise progressNote of what's new.
- Examples: "parts shipped Tuesday" on a WO already waiting on parts → progress_existing. "Jesse sent the quote we asked about" on an active project → progress_existing.

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

## Response Format
Respond with ONLY valid JSON, no markdown, no prose:
{
  "relevant": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation",
  "suggestedActions": [
    {
      "type": "create_work_order" | "create_maintenance_log" | "update_equipment_status" | "flag_for_review" | "create_project" | "progress_existing" | "create_auxiliary_equipment",
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
