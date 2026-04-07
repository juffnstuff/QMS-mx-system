import { prisma } from "@/lib/prisma";
import { getUserConnection, getGraphClient } from "./graph-client";
import { analyzeMessage } from "@/lib/ai/analyze-message";
import type { RawMessage } from "./mail-poller";

// Maintenance-related keywords for pre-filtering messages before AI analysis
const MAINTENANCE_KEYWORDS = [
  // Vehicles
  "vehicle", "forklift", "truck", "loader", "bobcat", "plow", "trailer", "fleet",
  // Pumps
  "pump", "hydraulic", "sump", "vacuum",
  // Rubber processing equipment
  "extruder", "grinder", "baler", "conveyor", "shredder", "granulator", "mixer",
  "press", "mold", "vulcanizer", "crusher",
  // Motors & power
  "motor", "compressor", "generator", "engine", "drive", "gearbox",
  // Parts
  "belt", "bearing", "filter", "gasket", "seal", "valve", "wiring", "rotor",
  "impeller", "coupling", "sprocket", "chain",
  // Hoses & cables
  "hose", "cable", "pipe", "tubing", "fitting", "connector",
  // Oils & fluids
  "oil", "grease", "coolant", "lubricant", "fluid", "hydraulic fluid",
  // Maintenance actions
  "leak", "broken", "repair", "fix", "maintenance", "service", "replace",
  "install", "inspect", "calibrate", "overhaul",
  // Problem indicators
  "down", "malfunction", "noise", "vibration", "overheating", "pressure",
  "stuck", "jam", "fail", "crack", "wear", "corroded", "damaged",
  // Safety
  "osha", "ppe", "lockout", "tagout", "fire extinguisher", "guard", "safety",
  // General equipment
  "machine", "equipment", "tool", "part", "parts", "spare",
];

export interface ScanResult {
  messagesFound: number;
  messagesAnalyzed: number;
  suggestionsCreated: number;
  preFiltered: number;
  errors: string[];
}

/**
 * Pre-filter: check if a message likely contains maintenance-related content.
 */
function isMaintenanceRelated(message: RawMessage): boolean {
  const text = `${message.subject} ${message.bodyContent}`.toLowerCase();
  return MAINTENANCE_KEYWORDS.some((keyword) => text.includes(keyword));
}

/**
 * Poll the logged-in user's own mailbox using their delegated Graph token.
 * Uses /me/mailFolders/inbox/messages/delta for incremental fetching.
 */
async function pollUserMailbox(
  connectionId: string
): Promise<RawMessage[]> {
  const connection = await prisma.m365Connection.findUniqueOrThrow({
    where: { id: connectionId },
  });

  const graphClient = await getGraphClient(connectionId);
  const messages: RawMessage[] = [];

  try {
    let url: string;
    if (connection.deltaLink) {
      url = connection.deltaLink;
    } else {
      // First scan — get messages from last 7 days
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      url = `/me/mailFolders/inbox/messages/delta?$filter=receivedDateTime ge ${since}&$select=id,subject,from,bodyPreview,body,receivedDateTime&$top=50`;
    }

    const response = await graphClient.api(url).get();

    for (const msg of response.value || []) {
      // Skip if already processed
      const existing = await prisma.processedMessage.findUnique({
        where: { externalId: msg.id },
      });
      if (existing) continue;

      messages.push({
        externalId: msg.id,
        subject: msg.subject || "(No subject)",
        senderName: msg.from?.emailAddress?.name || "Unknown",
        senderEmail: msg.from?.emailAddress?.address || "",
        bodyPreview: (msg.bodyPreview || "").slice(0, 500),
        bodyContent: msg.body?.content || msg.bodyPreview || "",
        receivedAt: new Date(msg.receivedDateTime),
      });
    }

    // Store delta link for next scan
    const newDeltaLink = response["@odata.deltaLink"] || response["@odata.nextLink"];
    await prisma.m365Connection.update({
      where: { id: connectionId },
      data: {
        deltaLink: newDeltaLink || null,
        lastPolledAt: new Date(),
      },
    });
  } catch (error) {
    console.error(`[User Scan] Error polling mailbox:`, error);
    // Clear stale delta link
    if (connection.deltaLink) {
      await prisma.m365Connection.update({
        where: { id: connectionId },
        data: { deltaLink: null },
      });
    }
    throw error;
  }

  return messages;
}

/**
 * Run a scan of the logged-in user's own mailbox.
 * Uses their delegated OAuth token to read /me/messages.
 * Creates suggestions that the user must approve before content is visible to all.
 */
export async function runUserScan(userId: string): Promise<ScanResult> {
  const result: ScanResult = {
    messagesFound: 0,
    messagesAnalyzed: 0,
    suggestionsCreated: 0,
    preFiltered: 0,
    errors: [],
  };

  // Get this user's M365 connection
  const connection = await getUserConnection(userId);
  if (!connection) {
    result.errors.push("No MS365 connection found. Please connect your account first.");
    return result;
  }

  // Poll the user's inbox
  let messages: RawMessage[];
  try {
    messages = await pollUserMailbox(connection.id);
  } catch (err) {
    result.errors.push(
      `Failed to read mailbox: ${err instanceof Error ? err.message : String(err)}`
    );
    return result;
  }

  result.messagesFound = messages.length;

  if (messages.length === 0) return result;

  // Load equipment list for AI analysis
  const equipment = await prisma.equipment.findMany({
    select: { id: true, name: true, type: true, location: true, serialNumber: true, status: true },
  });

  for (const msg of messages) {
    // Pre-filter: skip non-maintenance messages
    if (!isMaintenanceRelated(msg)) {
      await prisma.processedMessage.create({
        data: {
          externalId: msg.externalId,
          sourceType: "email",
          sourceId: connection.connectedBy,
          scannedByUserId: userId,
          subject: msg.subject,
          senderName: msg.senderName,
          senderEmail: msg.senderEmail,
          bodyPreview: msg.bodyPreview,
          receivedAt: msg.receivedAt,
          actionTaken: "pre_filtered",
          confidence: 0,
        },
      });
      result.preFiltered++;
      continue;
    }

    // Full AI analysis
    try {
      const analysis = await analyzeMessage(
        {
          subject: msg.subject,
          body: msg.bodyContent,
          senderName: msg.senderName,
          senderEmail: msg.senderEmail,
        },
        equipment
      );

      const processed = await prisma.processedMessage.create({
        data: {
          externalId: msg.externalId,
          sourceType: "email",
          sourceId: connection.connectedBy,
          scannedByUserId: userId,
          subject: msg.subject,
          senderName: msg.senderName,
          senderEmail: msg.senderEmail,
          bodyPreview: msg.bodyPreview,
          receivedAt: msg.receivedAt,
          aiAnalysis: JSON.stringify(analysis),
          actionTaken: analysis.relevant
            ? analysis.suggestedActions[0]?.type || "ignored"
            : "ignored",
          confidence: analysis.confidence,
        },
      });

      result.messagesAnalyzed++;

      if (!analysis.relevant || analysis.suggestedActions.length === 0) continue;

      // Create suggestions — all start as "pending" for user approval
      for (const action of analysis.suggestedActions) {
        await prisma.aISuggestion.create({
          data: {
            processedMessageId: processed.id,
            suggestionType: action.type,
            status: "pending",
            payload: JSON.stringify(action),
          },
        });
        result.suggestionsCreated++;
      }
    } catch (err) {
      console.error("[User Scan] AI analysis failed:", msg.externalId, err);
      result.errors.push(`AI analysis failed for: ${msg.subject}`);
    }
  }

  return result;
}
