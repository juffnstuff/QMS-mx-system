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
  type: "create_work_order" | "create_maintenance_log" | "update_equipment_status";
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

## Message to Analyze
From: ${message.senderName} (${message.senderEmail})
Subject: ${message.subject || "(No subject)"}
Body:
${message.body.slice(0, 2000)}

## Instructions
1. Determine if this message is related to equipment maintenance, repairs, breakdowns, or service needs.
2. If relevant, identify which equipment is mentioned. Use fuzzy matching — people may refer to equipment by nickname, partial name, type, location, or serial number.
3. Suggest one or more actions:
   - **create_work_order**: Something is broken, needs repair, or needs attention. Include a priority (low/medium/high/critical based on urgency and safety implications).
   - **create_maintenance_log**: Maintenance was already performed and should be logged. Extract what was done and any parts used.
   - **update_equipment_status**: Equipment status should change (e.g., "down" if broken, "needs_service" if degraded, "operational" if fixed).
4. Provide a confidence score (0.0-1.0) for your overall assessment.

## Response Format
Respond with ONLY valid JSON, no markdown:
{
  "relevant": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of your analysis",
  "suggestedActions": [
    {
      "type": "create_work_order" | "create_maintenance_log" | "update_equipment_status",
      "equipmentId": "the equipment ID from the registry",
      "equipmentName": "the equipment name",
      "title": "Short descriptive title for the work order or log",
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

    // Validate equipment IDs against actual registry
    const validIds = new Set(equipmentList.map((e) => e.id));
    result.suggestedActions = result.suggestedActions.filter((action) => {
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
