import Anthropic from "@anthropic-ai/sdk";

interface Equipment {
  id: string;
  name: string;
  type: string;
  location: string;
  serialNumber: string;
  status: string;
}

interface SuggestedAction {
  type: "create_work_order" | "create_maintenance_log" | "update_equipment_status" | "flag_for_review";
  equipmentId: string;
  equipmentName: string;
  title: string;
  description: string;
  priority?: "low" | "medium" | "high" | "critical";
  newStatus?: "operational" | "needs_service" | "down";
  partsUsed?: string;
}

export interface AIAnalysisResult {
  relevant: boolean;
  confidence: number;
  reasoning: string;
  suggestedActions: SuggestedAction[];
}

const client = new Anthropic();

export async function analyzeMessage(
  message: { subject?: string; body: string; senderName: string; senderEmail: string },
  equipmentList: Equipment[]
): Promise<AIAnalysisResult> {
  const equipmentContext = equipmentList
    .map(
      (e) =>
        `- ID: ${e.id} | Name: "${e.name}" | Type: ${e.type} | Location: ${e.location} | Serial: ${e.serialNumber} | Status: ${e.status}`
    )
    .join("\n");

  const prompt = `You are an AI assistant for a manufacturing QMS (Quality Management System) at RubberForm Recycled Products, a rubber recycling manufacturer in Buffalo, NY. Your job is to analyze emails and Teams messages to identify maintenance-related content and suggest actions.

## Equipment Registry
${equipmentContext}

## Manufacturing Domain Knowledge
RubberForm processes recycled rubber into products. Watch for mentions of:

**Vehicles & Fleet:** forklift, truck, loader, bobcat, plow, trailer, fleet, van, pickup, delivery vehicle, company vehicle
**Pumps:** hydraulic pump, water pump, sump pump, vacuum pump, transfer pump, fuel pump
**Rubber Processing Equipment:** extruder, grinder, baler, conveyor, shredder, granulator, mixer, press, mold, vulcanizer, crusher, roller, cutter, dryer, hopper, feeder, separator
**Motors & Power:** motor, compressor, generator, engine, drive, gearbox, VFD, starter, transformer, panel, breaker, electrical
**Hoses & Cables:** hydraulic hose, air hose, power cable, control cable, wiring, pipe, tubing, fitting, connector, coupling
**Oils & Fluids:** hydraulic oil, gear oil, coolant, lubricant, grease, fluid, fuel, diesel, propane, antifreeze
**Parts & Components:** bearing, belt, filter, gasket, seal, valve, rotor, impeller, sprocket, chain, blade, screen, die, nozzle, cylinder, piston
**Safety & Compliance:** OSHA, PPE, lockout/tagout, fire extinguisher, eye wash, guard, safety, inspection, compliance, audit

## Message to Analyze
From: ${message.senderName} (${message.senderEmail})
Subject: ${message.subject || "(No subject)"}
Body:
${message.body.slice(0, 3000)}

## Instructions
1. Determine if this message is related to equipment maintenance, repairs, breakdowns, service needs, parts ordering, safety concerns, or any operational equipment issue.
2. **Be smart about informal language.** People at RubberForm may say things like:
   - "the big green one is making that noise again" → likely refers to equipment
   - "oil leaking near dock 3" → maintenance issue even without naming equipment
   - "need to order more filters" → parts/maintenance related
   - "truck won't start" → vehicle maintenance
   - "line 2 is down" → production equipment issue
3. If relevant, identify which equipment is mentioned using **fuzzy matching**:
   - Match by nickname, partial name, type, color, size, or location
   - Match by serial number (partial or full)
   - If a location is mentioned and a problem described, try to match equipment at that location
   - If no specific equipment can be matched but the issue is clearly maintenance-related, use the closest match or flag for review
4. Suggest one or more actions:
   - **create_work_order**: Something needs repair, attention, or investigation. Include priority based on urgency and safety:
     - critical: safety hazard, equipment completely down, production stopped
     - high: significant degradation, risk of failure, intermittent problems
     - medium: scheduled maintenance needed, minor issues, parts to order
     - low: cosmetic, nice-to-have, future improvements
   - **create_maintenance_log**: Maintenance was already performed. Extract what was done and parts used.
   - **update_equipment_status**: Equipment status should change ("down" if broken, "needs_service" if degraded, "operational" if fixed).
   - **flag_for_review**: The message seems maintenance-adjacent but you're not confident enough to propose a specific action. Use this to avoid missing important items.
5. Provide a confidence score (0.0-1.0) for your overall assessment.

## Response Format
Respond with ONLY valid JSON, no markdown:
{
  "relevant": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of your analysis",
  "suggestedActions": [
    {
      "type": "create_work_order" | "create_maintenance_log" | "update_equipment_status" | "flag_for_review",
      "equipmentId": "the equipment ID from the registry (or 'unknown' for flag_for_review)",
      "equipmentName": "the equipment name",
      "title": "Short descriptive title",
      "description": "Detailed description of what needs to be done or was done",
      "priority": "low" | "medium" | "high" | "critical",
      "newStatus": "operational" | "needs_service" | "down",
      "partsUsed": "parts mentioned if any"
    }
  ]
}

If the message is not maintenance-related, return:
{"relevant": false, "confidence": 0.9, "reasoning": "Not maintenance-related: ...", "suggestedActions": []}`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  try {
    const result = JSON.parse(text) as AIAnalysisResult;

    // Validate equipment IDs against actual registry (allow "unknown" for flag_for_review)
    const validIds = new Set(equipmentList.map((e) => e.id));
    result.suggestedActions = result.suggestedActions.filter((action) => {
      if (action.type === "flag_for_review" && action.equipmentId === "unknown") {
        return true;
      }
      if (!validIds.has(action.equipmentId)) {
        console.warn(
          `[AI Analyzer] Invalid equipment ID "${action.equipmentId}" — skipping action`
        );
        return false;
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
