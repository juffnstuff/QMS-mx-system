import Anthropic from "@anthropic-ai/sdk";

interface Equipment {
  id: string;
  name: string;
  type: string;
  location: string;
  serialNumber: string;
  status: string;
  parentEquipmentId: string | null;
}

interface OpenWorkOrder {
  id: string;
  title: string;
  equipmentId: string;
  equipmentName: string;
  priority: string;
  status: string;
}

interface ActiveProject {
  id: string;
  title: string;
  status: string;
  description: string | null;
}

interface ActiveSchedule {
  id: string;
  title: string;
  equipmentId: string;
  equipmentName: string;
  frequency: string;
  nextDue: string;
}

interface SuggestedAction {
  type:
    | "create_work_order"
    | "create_maintenance_log"
    | "update_equipment_status"
    | "flag_for_review"
    | "create_project"
    | "create_auxiliary_equipment"
    | "progress_existing";
  equipmentId: string;
  equipmentName: string;
  title: string;
  description: string;
  priority?: "low" | "medium" | "high" | "critical";
  newStatus?: "operational" | "needs_service" | "down";
  partsUsed?: string;
  isNewEquipment?: boolean;
  parentEquipmentId?: string;
  parentEquipmentName?: string;
  existingRecordType?: "WorkOrder" | "Project" | "MaintenanceSchedule";
  existingRecordId?: string;
  suggestedUpdate?: string;
}

export interface AIAnalysisResult {
  relevant: boolean;
  confidence: number;
  reasoning: string;
  suggestedActions: SuggestedAction[];
}

export interface AnalysisContext {
  equipment: Equipment[];
  openWorkOrders: OpenWorkOrder[];
  activeProjects: ActiveProject[];
  activeSchedules: ActiveSchedule[];
}

const client = new Anthropic();

export async function analyzeMessage(
  message: { subject?: string; body: string; senderName: string; senderEmail: string },
  context: AnalysisContext
): Promise<AIAnalysisResult> {
  const equipmentContext = context.equipment
    .map(
      (e) =>
        `- ID: ${e.id} | Name: "${e.name}" | Type: ${e.type} | Location: ${e.location} | Serial: ${e.serialNumber} | Status: ${e.status}${e.parentEquipmentId ? ` | Parent: ${e.parentEquipmentId}` : ""}`
    )
    .join("\n");

  const workOrderContext = context.openWorkOrders.length > 0
    ? context.openWorkOrders
        .map(
          (wo) =>
            `- WO ID: ${wo.id} | "${wo.title}" | Equipment: "${wo.equipmentName}" (${wo.equipmentId}) | Priority: ${wo.priority} | Status: ${wo.status}`
        )
        .join("\n")
    : "(No open work orders)";

  const projectContext = context.activeProjects.length > 0
    ? context.activeProjects
        .map(
          (p) =>
            `- Project ID: ${p.id} | "${p.title}" | Status: ${p.status}${p.description ? ` | Desc: ${p.description.slice(0, 100)}` : ""}`
        )
        .join("\n")
    : "(No active projects)";

  const scheduleContext = context.activeSchedules.length > 0
    ? context.activeSchedules
        .map(
          (s) =>
            `- Schedule ID: ${s.id} | "${s.title}" | Equipment: "${s.equipmentName}" (${s.equipmentId}) | Frequency: ${s.frequency} | Next due: ${s.nextDue}`
        )
        .join("\n")
    : "(No active maintenance schedules)";

  const prompt = `You are an AI assistant for the QMS (Quality Management System) at **RubberForm Recycled Products LLC**, a rubber recycling manufacturer in Buffalo, NY. Your job is to analyze emails and Teams messages to identify maintenance, service, parts, equipment, and project-related content, then suggest actions.

## WHAT TO LOOK FOR (RELEVANT)
- Equipment service needs, breakdowns, repairs
- Preventive/preventative maintenance tasks and scheduling
- Parts shipped, parts received, parts needed, parts on backorder
- Help needed on a piece of equipment
- Progress updates on existing work orders, projects, or maintenance tasks
- New auxiliary equipment or components that should be tracked (pumps for presses, attachments for vehicles, etc.)
- Safety issues related to equipment

## WHAT TO IGNORE (NOT RELEVANT)
- Invoices, billing, payments, accounts payable/receivable
- Price quotes, cost estimates, budgets, financial discussions
- Purchase orders, POs — UNLESS they are specifically about parts arriving/shipping for maintenance
- General business emails (HR, meetings, lunch orders, etc.)
- Marketing, sales, customer communications unrelated to equipment
- Any email primarily about money or financial transactions

If an email mentions both maintenance AND money (like "the pump repair cost $500"), focus ONLY on the maintenance aspect and ignore the cost details.

## About RubberForm
RubberForm recycles rubber (primarily tires) into manufactured products like mats, pavers, and custom molded goods. Operations include shredding, grinding/granulating, mixing, molding, pressing, and shipping. The facility has production lines, a shop/maintenance area, warehouse, loading docks, office, and yard.

## Key People at RubberForm
- **shop@rubberform.com** — Shop/maintenance team shared mailbox. ALWAYS relevant.
- **Joe** (joe@rubberform.com) — Plant operations.
- **Anthony** (anthony@rubberform.com) — Operations.
- **Jesse** (jesse@rubberform.com) — Operations/shop.
- **Jesse at InQuip** (jesse@inquip.com) — External equipment supplier/service partner.
- **Bill** (bill@rubberform.com) — Management.
- **Aaron** (aaron@rubberform.com) — Operations.

## Equipment Registry
${equipmentContext || "(No equipment registered yet — suggest adding new equipment if mentioned)"}

## Open Work Orders (in-progress or open)
${workOrderContext}

## Active Projects
${projectContext}

## Active Maintenance Schedules
${scheduleContext}

## Manufacturing Domain Knowledge
**Vehicles & Fleet:** forklift, truck, loader, bobcat, plow, trailer, van, pickup, Penske truck (rental box truck), F250/Ford F-250 (company pickup), box truck
**Pumps:** hydraulic pump, water pump, sump pump, vacuum pump, transfer pump, fuel pump, coolant pump
**Rubber Processing Equipment:** extruder, grinder, baler, conveyor, shredder, granulator, mixer, press, mold, vulcanizer, crusher, roller, cutter, dryer, hopper, feeder, separator, screen, classifier
**Motors & Power:** motor, compressor, generator, engine, drive, gearbox, VFD, starter, transformer, breaker, battery, charger
**Parts & Components:** bearing, belt, filter, gasket, seal, valve, rotor, impeller, sprocket, chain, blade, screen, die, nozzle, cylinder, piston, shaft, bushing, bracket, roller, wheel, tire, brake
**Hoses & Cables:** hydraulic hose, air hose, cable, pipe, tubing, fitting, connector, coupling, manifold, regulator
**Fluids:** hydraulic oil, gear oil, coolant, lubricant, grease, fuel, diesel, propane, antifreeze

## Message to Analyze
From: ${message.senderName} (${message.senderEmail})
Subject: ${message.subject || "(No subject)"}
Body:
${message.body.slice(0, 4000)}

## Instructions

### 1. Match Against Existing Records First
Before suggesting new records, CHECK the existing work orders, projects, and maintenance schedules listed above. If this email is a **progress update, status update, parts shipment, or follow-up** for an existing record, use \`progress_existing\` instead of creating a duplicate.

Examples:
- Email says "pump shipped for the press" and there's an open WO about the press pump → \`progress_existing\` with a suggested note
- Email says "the new grinder installation is moving forward" and there's an active project for grinder upgrade → \`progress_existing\`
- Email says "filters arrived" and there's an open WO about filters → \`progress_existing\`

### 2. Auxiliary Equipment Detection
When an email mentions a **component, part, or sub-system that should be tracked as its own equipment record** (e.g., a replacement pump for a press, a new motor for the grinder, a charger for a forklift), use \`create_auxiliary_equipment\`. This:
- Creates a new equipment record for the auxiliary item
- Links it to the parent equipment via \`parentEquipmentId\`
- Can also trigger a maintenance task or project

Examples:
- "New hydraulic pump arriving for the Dake press" → create_auxiliary_equipment: name "Hydraulic Pump (Dake Press)", parent = Dake Press
- "Got the replacement motor for grinder #2" → create_auxiliary_equipment: name "Drive Motor (Grinder #2)", parent = Grinder #2
- "Battery charger for the Yale forklift" → create_auxiliary_equipment: name "Battery Charger (Yale Forklift)", parent = Yale Forklift

### 3. Standard Suggestions
- **create_work_order**: Something needs repair, service, attention, or investigation. Assign priority:
  - critical: safety hazard, equipment completely down, production stopped
  - high: significant degradation, failure risk, intermittent problems
  - medium: scheduled maintenance, minor issues, parts to order
  - low: cosmetic, future improvements
- **create_maintenance_log**: Work was already performed — log what was done
- **update_equipment_status**: Equipment status should change (down/needs_service/operational)
- **create_project**: Large-scale items — equipment installations, upgrades, major facility improvements. Do NOT include budget/cost info.
- **flag_for_review**: Seems relevant but not confident enough to suggest a specific action

### 4. Equipment Matching Rules
- Match by nickname, partial name, type, color, size, or location
- Match by serial number (partial or full)
- If a PART is mentioned FOR a piece of equipment, the \`equipmentId\` should be the PARENT EQUIPMENT, with part details in \`description\` and \`partsUsed\`
- Set \`isNewEquipment: true\` ONLY for standalone equipment (vehicles, presses, grinders, conveyors, forklifts)
- Set \`isNewEquipment: false\` for parts/components or existing registry matches
- For auxiliary equipment, use \`create_auxiliary_equipment\` instead of \`isNewEquipment: true\`

### 5. Be Smart About Informal Language
- "the big green one is making that noise again" → equipment issue
- "parts are on the way" → progress update on existing WO
- "jesse said the pump shipped" → parts tracking, progress existing
- "line 2 is down" → production equipment down
- "need help with the press" → service needed
- "the new pump for the press is here" → auxiliary equipment + progress existing

### 6. Confidence Score
Be generous — it's better to flag something (0.5+) than miss it (< 0.3).

## Response Format
Respond with ONLY valid JSON, no markdown:
{
  "relevant": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation",
  "suggestedActions": [
    {
      "type": "create_work_order" | "create_maintenance_log" | "update_equipment_status" | "flag_for_review" | "create_project" | "create_auxiliary_equipment" | "progress_existing",
      "equipmentId": "equipment ID from registry or 'unknown'",
      "equipmentName": "equipment name or description",
      "title": "Short descriptive title",
      "description": "Detailed description",
      "priority": "low" | "medium" | "high" | "critical",
      "newStatus": "operational" | "needs_service" | "down",
      "partsUsed": "parts mentioned if any",
      "isNewEquipment": true/false,
      "parentEquipmentId": "ID of parent equipment (for create_auxiliary_equipment)",
      "parentEquipmentName": "name of parent equipment (for create_auxiliary_equipment when parent is unknown)",
      "existingRecordType": "WorkOrder" | "Project" | "MaintenanceSchedule",
      "existingRecordId": "ID of the existing record (for progress_existing)",
      "suggestedUpdate": "what to add/update on the existing record (for progress_existing)"
    }
  ]
}

If not relevant: {"relevant": false, "confidence": 0.9, "reasoning": "Not relevant: ...", "suggestedActions": []}`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  try {
    const result = JSON.parse(text) as AIAnalysisResult;

    // Validate equipment IDs against actual registry (allow "unknown" for flag_for_review)
    const validIds = new Set(context.equipment.map((e) => e.id));
    result.suggestedActions = result.suggestedActions.filter((action) => {
      if (action.equipmentId === "unknown") {
        return true;
      }
      if (!validIds.has(action.equipmentId)) {
        console.warn(
          `[AI Analyzer] Invalid equipment ID "${action.equipmentId}" — converting to flag_for_review`
        );
        action.type = "flag_for_review";
        action.equipmentId = "unknown";
        return true;
      }
      return true;
    });

    // Validate existing record IDs for progress_existing
    result.suggestedActions = result.suggestedActions.filter((action) => {
      if (action.type === "progress_existing" && action.existingRecordId) {
        if (action.existingRecordType === "WorkOrder") {
          const valid = context.openWorkOrders.some((wo) => wo.id === action.existingRecordId);
          if (!valid) {
            console.warn(`[AI Analyzer] Invalid WO ID "${action.existingRecordId}" — converting to flag_for_review`);
            action.type = "flag_for_review";
          }
        } else if (action.existingRecordType === "Project") {
          const valid = context.activeProjects.some((p) => p.id === action.existingRecordId);
          if (!valid) {
            console.warn(`[AI Analyzer] Invalid Project ID "${action.existingRecordId}" — converting to flag_for_review`);
            action.type = "flag_for_review";
          }
        }
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
