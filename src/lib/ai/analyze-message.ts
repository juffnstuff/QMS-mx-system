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

  const prompt = `You are an AI assistant for the QMS (Quality Management System) at **RubberForm Recycled Products LLC**, a rubber recycling manufacturer in Buffalo, NY. Your job is to analyze emails, Teams messages, and SharePoint documents to identify maintenance, equipment, project, and operational content, then suggest actions.

## About RubberForm
RubberForm recycles rubber (primarily tires) into manufactured products like mats, pavers, and custom molded goods. Operations include shredding, grinding/granulating, mixing, molding, pressing, and shipping. The facility has production lines, a shop/maintenance area, warehouse, loading docks, office, and yard.

## Key People at RubberForm
These people are part of the RubberForm team. Emails from them about plant/factory operations are almost always relevant:
- **shop@rubberform.com** — Shop/maintenance team shared mailbox. ALWAYS relevant — these are maintenance requests, parts orders, and equipment reports.
- **Joe** (joe@rubberform.com) — Plant operations. Emails about equipment, production, and facility issues.
- **Anthony** (anthony@rubberform.com) — Operations. Emails about equipment, maintenance, and projects.
- **Jesse** (jesse@rubberform.com) — Operations/shop. Emails about equipment and maintenance.
- **Jesse at InQuip** (jesse@inquip.com) — External equipment supplier/service partner. Emails about parts, equipment service, quotes, and repairs.
- **Bill** (bill@rubberform.com) — Management. Emails about factory/plant operations, projects, and capital equipment.
- **Aaron** (aaron@rubberform.com) — Operations. Emails about equipment, production, and shop matters.

When you see emails from or mentioning these people discussing plant/shop/equipment/maintenance topics, they are highly likely to be relevant.

## Equipment Registry
${equipmentContext || "(No equipment registered yet — suggest adding new equipment if mentioned)"}

## Manufacturing Domain Knowledge
RubberForm processes recycled rubber. Watch for mentions of:

**Vehicles & Fleet:** forklift, truck, loader, bobcat, plow, trailer, fleet, van, pickup, delivery vehicle, company truck, dump truck, flatbed, **Penske truck** (rental box truck), **F250 / Ford F-250** (company pickup truck), box truck, rental truck
**Pumps:** hydraulic pump, water pump, sump pump, vacuum pump, transfer pump, fuel pump, coolant pump
**Rubber Processing Equipment:** extruder, grinder, baler, conveyor, shredder, granulator, mixer, press, mold, vulcanizer, crusher, roller, cutter, dryer, hopper, feeder, separator, screen, classifier, magnetic separator, metal detector
**Motors & Power:** motor, compressor, generator, engine, drive, gearbox, VFD, variable frequency drive, starter, transformer, panel, breaker, electrical, power supply, battery, charger
**Hoses & Cables:** hydraulic hose, air hose, power cable, control cable, wiring, pipe, tubing, fitting, connector, coupling, manifold, regulator
**Oils & Fluids:** hydraulic oil, gear oil, coolant, lubricant, grease, fluid, fuel, diesel, propane, antifreeze, cutting fluid
**Parts & Components:** bearing, belt, filter, gasket, seal, valve, rotor, impeller, sprocket, chain, blade, screen, die, nozzle, cylinder, piston, shaft, bushing, bracket, roller, wheel, tire, brake
**Safety & Compliance:** OSHA, PPE, lockout/tagout, LOTO, fire extinguisher, eye wash, guard, safety, inspection, compliance, audit, incident, injury, near-miss
**Facility:** HVAC, roof, door, dock, dock leveler, overhead door, lighting, plumbing, drainage, floor, concrete, fencing, gate, parking lot, yard
**Projects & Capital:** install, installation, upgrade, retrofit, new equipment, project, capital, budget, quote, proposal, vendor, supplier, contractor, construction

## Message to Analyze
From: ${message.senderName} (${message.senderEmail})
Subject: ${message.subject || "(No subject)"}
Body:
${message.body.slice(0, 4000)}

## Known Company Assets
- **Penske truck** — rental box truck used for deliveries/pickups. Any mention of "Penske", "box truck", or "rental truck" is vehicle-related.
- **Ford F-250** — company pickup truck. Any mention of "F250", "F-250", "Ford", or "the pickup" likely refers to this.
- **Hydraulic press pump** — the presses need pumps. Any email about "pump for the press", "press pump", "hydraulic pump" related to the press is maintenance-critical.

## MS Forms Responses
If the message subject starts with "Form:" it's an MS Forms response from SharePoint. These are structured submissions (like maintenance requests, inspection checklists, or work requests). Treat ALL form fields as relevant data — extract equipment references, issues described, and actions needed.

## Instructions
1. Determine if this message relates to: equipment maintenance, repairs, breakdowns, parts ordering, service requests, safety issues, facility maintenance, fleet/vehicle issues, vendor/supplier communications about equipment, operational projects, or MS Forms submissions about any of the above.

2. **Be smart about informal language.** RubberForm people write casually:
   - "the big green one is making that noise again" → equipment issue
   - "oil leaking near dock 3" → maintenance needed
   - "need to order more filters" → parts/maintenance
   - "truck won't start" → vehicle maintenance
   - "line 2 is down" → production equipment
   - "jesse from inquip called about the parts" → vendor follow-up on repairs
   - "shop needs to look at the press" → maintenance request
   - "got the quote from Bill" → could be project/equipment purchase

3. **Match equipment using fuzzy matching:**
   - Match by nickname, partial name, type, color, size, or location
   - Match by serial number (partial or full)
   - If location + problem mentioned, match equipment at that location
   - If no specific equipment matches but the issue is clearly relevant, use "unknown" and flag for review

4. **Suggest actions:**
   - **create_work_order**: Something needs repair, attention, service, or investigation
     - critical: safety hazard, equipment completely down, production stopped
     - high: significant degradation, risk of failure, intermittent problems
     - medium: scheduled maintenance, minor issues, parts to order
     - low: cosmetic, nice-to-have, future improvements
   - **create_maintenance_log**: Work was already performed — log what was done
   - **update_equipment_status**: Equipment status should change (down/needs_service/operational)
   - **flag_for_review**: Seems relevant but not confident — better to flag than miss it

5. **For vendor emails (like from InQuip):** If discussing parts, repairs, or equipment service, create work orders or flag for review. Include quote/pricing info in the description if present.

6. **For SharePoint documents:** If analyzing a document (SOP, Work Instruction, form), suggest creating or updating the relevant equipment's maintenance schedule or logging it.

7. Confidence score (0.0-1.0): Be generous — it's better to flag something (0.5+) than miss it (< 0.3).

## Response Format
Respond with ONLY valid JSON, no markdown:
{
  "relevant": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation",
  "suggestedActions": [
    {
      "type": "create_work_order" | "create_maintenance_log" | "update_equipment_status" | "flag_for_review",
      "equipmentId": "equipment ID from registry or 'unknown'",
      "equipmentName": "equipment name or description",
      "title": "Short descriptive title",
      "description": "Detailed description including any quotes, part numbers, vendor info",
      "priority": "low" | "medium" | "high" | "critical",
      "newStatus": "operational" | "needs_service" | "down",
      "partsUsed": "parts mentioned if any"
    }
  ]
}

If not relevant: {"relevant": false, "confidence": 0.9, "reasoning": "Not relevant: ...", "suggestedActions": []}`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  try {
    const result = JSON.parse(text) as AIAnalysisResult;

    // Validate equipment IDs against actual registry (allow "unknown" for flag_for_review)
    const validIds = new Set(equipmentList.map((e) => e.id));
    result.suggestedActions = result.suggestedActions.filter((action) => {
      if (action.equipmentId === "unknown") {
        return true;
      }
      if (!validIds.has(action.equipmentId)) {
        console.warn(
          `[AI Analyzer] Invalid equipment ID "${action.equipmentId}" — converting to flag_for_review`
        );
        // Convert to flag_for_review instead of dropping
        action.type = "flag_for_review";
        action.equipmentId = "unknown";
        return true;
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
