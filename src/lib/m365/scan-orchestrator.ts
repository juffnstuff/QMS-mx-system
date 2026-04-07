import { prisma } from "@/lib/prisma";
import { getAppGraphClient, getActiveConnection, getGraphClient } from "./graph-client";
import { syncOrgUsers, pollAllMailboxes } from "./org-mail-scanner";
import { pollTeamsChannel } from "./teams-poller";
import { syncSharePointSites, scanAllSharePointSites } from "./sharepoint-scanner";
import { analyzeMessage } from "@/lib/ai/analyze-message";
import type { RawMessage } from "./mail-poller";

const AUTO_APPLY_THRESHOLD = 0.92;

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
  source: "cron" | "manual";
  mailboxesSynced: number;
  messagesPolled: number;
  messagesAnalyzed: number;
  suggestionsCreated: number;
  autoApplied: number;
  teamsMessages: number;
  sharePointDocs: number;
  preFiltered: number;
  errors: string[];
}

/**
 * Pre-filter: check if a message likely contains maintenance-related content.
 * Returns true if the message should be sent to Claude for full analysis.
 */
function isMaintenanceRelated(message: RawMessage): boolean {
  const text = `${message.subject} ${message.bodyContent}`.toLowerCase();
  return MAINTENANCE_KEYWORDS.some((keyword) => text.includes(keyword));
}

/**
 * Process messages through AI analysis and create suggestions.
 * Shared logic used by both cron and manual scan.
 */
async function processMessages(
  messages: RawMessage[],
  sourceType: string,
  sourceId: string,
  result: ScanResult
) {
  const equipment = await prisma.equipment.findMany({
    select: {
      id: true,
      name: true,
      type: true,
      location: true,
      serialNumber: true,
      status: true,
    },
  });

  for (const msg of messages) {
    result.messagesPolled++;

    // Pre-filter: skip non-maintenance messages
    if (!isMaintenanceRelated(msg)) {
      await prisma.processedMessage.create({
        data: {
          externalId: msg.externalId,
          sourceType,
          sourceId,
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
          sourceType,
          sourceId,
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

      for (const action of analysis.suggestedActions) {
        const shouldAutoApply =
          analysis.confidence >= AUTO_APPLY_THRESHOLD &&
          action.type === "create_work_order";

        const suggestion = await prisma.aISuggestion.create({
          data: {
            processedMessageId: processed.id,
            suggestionType: action.type,
            status: shouldAutoApply ? "auto_applied" : "pending",
            payload: JSON.stringify(action),
          },
        });

        result.suggestionsCreated++;

        if (shouldAutoApply) {
          try {
            const adminUser = await prisma.user.findFirst({
              where: { role: "admin" },
            });
            if (adminUser) {
              const workOrder = await prisma.workOrder.create({
                data: {
                  equipmentId: action.equipmentId,
                  createdById: adminUser.id,
                  title: action.title,
                  description: `[Auto-created by AI from ${sourceType}]\n\n${action.description}`,
                  priority: action.priority || "medium",
                },
              });

              await prisma.aISuggestion.update({
                where: { id: suggestion.id },
                data: {
                  createdRecordType: "WorkOrder",
                  createdRecordId: workOrder.id,
                },
              });

              result.autoApplied++;
            }
          } catch (err) {
            console.error("[Scan] Auto-apply failed:", err);
            await prisma.aISuggestion.update({
              where: { id: suggestion.id },
              data: { status: "pending" },
            });
          }
        }
      }
    } catch (err) {
      console.error("[Scan] AI analysis failed for message:", msg.externalId, err);
      result.errors.push(`AI analysis failed for ${msg.externalId}`);
    }
  }
}

/**
 * Run a full scan of all email, Teams, and SharePoint sources.
 * Called by both the cron job and the "Scan All" button.
 */
export async function runFullScan(
  options: { source: "cron" | "manual" } = { source: "cron" }
): Promise<ScanResult> {
  const result: ScanResult = {
    source: options.source,
    mailboxesSynced: 0,
    messagesPolled: 0,
    messagesAnalyzed: 0,
    suggestionsCreated: 0,
    autoApplied: 0,
    teamsMessages: 0,
    sharePointDocs: 0,
    preFiltered: 0,
    errors: [],
  };

  // Get scan config
  const scanConfig = await prisma.m365ScanConfig.findUnique({
    where: { id: "default" },
  });

  // --- ORG-WIDE EMAIL SCANNING ---
  if (scanConfig?.scanAllMailboxes !== false) {
    try {
      const appClient = await getAppGraphClient();

      // Sync org users if stale (>1 hour) or if manual scan
      const lastSync = scanConfig?.lastUserSyncAt;
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (!lastSync || lastSync < oneHourAgo || options.source === "manual") {
        result.mailboxesSynced = await syncOrgUsers(appClient);
      }

      // Poll all mailboxes
      const mailMessages = await pollAllMailboxes(appClient);
      await processMessages(mailMessages, "email", "org-wide", result);
    } catch (err) {
      console.error("[Scan] Org-wide mail scanning failed:", err);
      result.errors.push(
        `Org-wide mail scan failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // --- TEAMS CHANNEL SCANNING ---
  try {
    const connection = await getActiveConnection();
    if (connection) {
      const monitors = await prisma.m365MonitorConfig.findMany({
        where: { isActive: true, sourceType: "teams_channel" },
      });

      const delegatedClient = await getGraphClient(connection.id);

      for (const monitor of monitors) {
        try {
          const teamsMessages = await pollTeamsChannel(delegatedClient, monitor.id);
          result.teamsMessages += teamsMessages.length;
          await processMessages(teamsMessages, "teams", monitor.sourceId, result);
        } catch (err) {
          console.error(`[Scan] Teams channel ${monitor.displayName} failed:`, err);
          result.errors.push(`Teams: ${monitor.displayName} failed`);
        }
      }
    }
  } catch (err) {
    console.error("[Scan] Teams scanning failed:", err);
    result.errors.push("Teams scanning failed");
  }

  // --- SHAREPOINT SCANNING ---
  if (scanConfig?.scanSharePoint) {
    try {
      const appClient = await getAppGraphClient();
      await syncSharePointSites(appClient);
      result.sharePointDocs = await scanAllSharePointSites(appClient);
    } catch (err) {
      console.error("[Scan] SharePoint scanning failed:", err);
      result.errors.push(
        `SharePoint scan failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return result;
}
