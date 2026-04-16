import { prisma } from "@/lib/prisma";
import { getUserConnection, getGraphClient } from "./graph-client";
import { analyzeMessage } from "@/lib/ai/analyze-message";
import type { RawMessage } from "./mail-poller";

// Key senders whose emails ALWAYS get AI analysis (skip pre-filter)
const PRIORITY_SENDERS = [
  "shop@rubberform.com",
  "joe@rubberform.com",
  "anthony@rubberform.com",
  "jesse@rubberform.com",
  "jesse@inquip",           // partial match for jesse@inquip.com or similar
  "bill@rubberform.com",
  "aaron@rubberform.com",
  "penske",                 // Penske truck rental/leasing emails
  "noreply@",               // Automated form submissions
  "forms@",                 // MS Forms notifications
];

// Keywords for pre-filtering messages before AI analysis.
// Focused on: service, preventive maintenance, parts, equipment help, project progress.
// Excludes: invoices, billing, payments, money-related content.
const MAINTENANCE_KEYWORDS = [
  // RubberForm specific vehicles
  "penske", "f250", "f-250", "ford", "pickup", "box truck", "rental truck",
  // Vehicles general
  "vehicle", "forklift", "truck", "loader", "bobcat", "plow", "trailer", "fleet",
  "van", "flatbed", "dump truck", "company truck",
  // Pumps
  "pump", "hydraulic", "sump", "vacuum", "coolant pump", "transfer pump",
  // Rubber processing equipment
  "extruder", "grinder", "baler", "conveyor", "shredder", "granulator", "mixer",
  "press", "mold", "vulcanizer", "crusher", "roller", "hopper", "feeder",
  "separator", "screen", "classifier",
  // Motors & power
  "motor", "compressor", "generator", "engine", "drive", "gearbox", "vfd",
  "starter", "transformer", "breaker", "battery", "charger",
  // Parts & components
  "belt", "bearing", "filter", "gasket", "seal", "valve", "wiring", "rotor",
  "impeller", "coupling", "sprocket", "chain", "blade", "screen", "die", "shaft",
  "bushing", "bracket", "wheel", "tire", "brake", "cylinder", "piston",
  // Hoses & cables
  "hose", "cable", "pipe", "tubing", "fitting", "connector", "manifold", "regulator",
  // Oils & fluids
  "oil", "grease", "coolant", "lubricant", "fluid", "hydraulic fluid", "diesel",
  "propane", "antifreeze", "fuel",
  // Service & maintenance actions
  "leak", "broken", "repair", "fix", "maintenance", "service", "replace",
  "install", "inspect", "calibrate", "overhaul", "rebuild",
  "preventive", "preventative", "pm ", "scheduled maintenance", "routine service",
  "service call", "service request", "service needed", "needs service",
  "work request", "maintenance needed", "help needed", "need help",
  // Parts shipping & ordering
  "shipped", "shipping", "tracking", "delivered", "arrived", "in transit",
  "back order", "backorder", "on order", "eta", "expected delivery",
  "parts needed", "parts ordered", "parts received", "parts on the way",
  "waiting on parts", "waiting for parts",
  // Problem indicators
  "down", "malfunction", "noise", "vibration", "overheating", "pressure",
  "stuck", "jam", "fail", "crack", "wear", "corroded", "damaged", "broke",
  "not working", "won't start", "won't run", "acting up",
  // Safety
  "osha", "ppe", "lockout", "tagout", "loto", "fire extinguisher", "guard",
  "safety", "incident", "injury", "near miss",
  // General equipment
  "machine", "equipment", "tool", "part", "parts", "spare", "auxiliary",
  "attachment", "accessory", "add-on", "component",
  // Projects & progress (no money terms)
  "project", "upgrade", "install", "installation", "progress", "update on",
  "status update", "next step", "ready for", "completed", "finished",
  // Facility
  "hvac", "roof", "dock", "door", "plumbing", "lighting", "electrical", "floor",
  "concrete", "fencing", "gate", "parking", "yard",
  // Shop-specific
  "shop", "plant", "factory", "production", "line", "bay", "warehouse",
  // Schedules & inspections
  "sop", "work instruction", "checklist", "procedure", "inspection",
  "schedule", "due date", "overdue", "upcoming",
];

export interface ScanResult {
  messagesFound: number;
  messagesAnalyzed: number;
  suggestionsCreated: number;
  preFiltered: number;
  teamsMessages: number;
  errors: string[];
}

/**
 * Check if a sender is a priority sender who always gets AI analysis.
 */
function isPrioritySender(senderEmail: string): boolean {
  const email = senderEmail.toLowerCase();
  return PRIORITY_SENDERS.some((ps) => email.includes(ps));
}

/**
 * Pre-filter: check if a message likely contains maintenance-related content.
 * Priority senders always pass the filter.
 */
function shouldAnalyze(message: RawMessage): boolean {
  if (isPrioritySender(message.senderEmail)) return true;
  const text = `${message.subject} ${message.bodyContent}`.toLowerCase();
  return MAINTENANCE_KEYWORDS.some((keyword) => text.includes(keyword));
}

/**
 * Poll the user's mailbox. If deep=true, clears delta link and goes back 30 days.
 */
async function pollUserMailbox(
  connectionId: string,
  deep: boolean = false
): Promise<RawMessage[]> {
  const connection = await prisma.m365Connection.findUniqueOrThrow({
    where: { id: connectionId },
  });

  // Deep scan: clear delta link to re-fetch everything
  if (deep && connection.deltaLink) {
    await prisma.m365Connection.update({
      where: { id: connectionId },
      data: { deltaLink: null },
    });
  }

  const graphClient = await getGraphClient(connectionId);
  const messages: RawMessage[] = [];
  const useDeep = deep || !connection.deltaLink;

  try {
    let url: string;
    if (!useDeep && connection.deltaLink) {
      url = connection.deltaLink;
    } else {
      // Deep scan goes back 30 days, normal first scan goes back 7 days
      const days = deep ? 30 : 7;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      url = `/me/mailFolders/inbox/messages/delta?$filter=receivedDateTime ge ${since}&$select=id,subject,from,bodyPreview,body,receivedDateTime&$top=100`;
    }

    // Follow pagination to get all messages
    let hasMore = true;
    while (hasMore) {
      const response = await graphClient.api(url).get();

      for (const msg of response.value || []) {
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

      // Check for next page or delta link
      if (response["@odata.nextLink"]) {
        url = response["@odata.nextLink"];
      } else {
        // Save delta link for next incremental scan
        if (response["@odata.deltaLink"]) {
          await prisma.m365Connection.update({
            where: { id: connectionId },
            data: { deltaLink: response["@odata.deltaLink"], lastPolledAt: new Date() },
          });
        }
        hasMore = false;
      }

      // Safety limit: don't fetch more than 500 messages in one scan
      if (messages.length >= 500) {
        hasMore = false;
      }
    }
  } catch (error) {
    console.error("[Scan] Error polling mailbox:", error);
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
 * Auto-discover and poll ALL Teams channels the user has access to.
 */
async function pollUserTeams(connectionId: string): Promise<RawMessage[]> {
  const graphClient = await getGraphClient(connectionId);
  const messages: RawMessage[] = [];

  try {
    const teamsResponse = await graphClient.api("/me/joinedTeams?$select=id,displayName").get();
    const teams = teamsResponse.value || [];

    for (const team of teams) {
      try {
        const channelsResponse = await graphClient
          .api(`/teams/${team.id}/channels?$select=id,displayName`)
          .get();

        for (const channel of channelsResponse.value || []) {
          try {
            const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            const msgsResponse = await graphClient
              .api(`/teams/${team.id}/channels/${channel.id}/messages?$top=25`)
              .get();

            for (const msg of msgsResponse.value || []) {
              if (msg.messageType !== "message") continue;

              const receivedAt = new Date(msg.createdDateTime);
              if (receivedAt < new Date(since)) continue;

              const existing = await prisma.processedMessage.findUnique({
                where: { externalId: msg.id },
              });
              if (existing) continue;

              const bodyText = (msg.body?.content || "").replace(/<[^>]*>/g, "");
              messages.push({
                externalId: msg.id,
                subject: `Teams: ${team.displayName} > ${channel.displayName}`,
                senderName: msg.from?.user?.displayName || "Unknown",
                senderEmail: msg.from?.user?.email || "",
                bodyPreview: bodyText.slice(0, 500),
                bodyContent: bodyText,
                receivedAt,
              });
            }
          } catch (msgErr) {
            console.warn(`[Scan] Cannot read channel ${channel.displayName}:`, msgErr);
          }
        }
      } catch (chErr) {
        console.warn(`[Scan] Cannot list channels for team ${team.displayName}:`, chErr);
      }
    }
  } catch (error) {
    console.error("[Scan] Error discovering Teams:", error);
    throw error;
  }

  return messages;
}

/**
 * Process messages through AI analysis and create suggestions.
 * Provides full context: equipment registry, open work orders, active projects, and schedules.
 */
async function processMessages(
  messages: RawMessage[],
  sourceType: string,
  userId: string,
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
      parentId: true,
    },
  });

  const openWorkOrders = await prisma.workOrder.findMany({
    where: { status: { in: ["open", "in_progress"] } },
    select: {
      id: true,
      title: true,
      equipmentId: true,
      priority: true,
      status: true,
      equipment: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const activeProjects = await prisma.project.findMany({
    where: { status: { in: ["planning", "in_progress"] } },
    select: { id: true, title: true, status: true, description: true },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const activeSchedules = await prisma.maintenanceSchedule.findMany({
    select: {
      id: true,
      title: true,
      equipmentId: true,
      frequency: true,
      nextDue: true,
      equipment: { select: { name: true } },
    },
    orderBy: { nextDue: "asc" },
    take: 30,
  });

  const analysisContext = {
    equipment,
    openWorkOrders: openWorkOrders.map((wo: typeof openWorkOrders[number]) => ({
      id: wo.id,
      title: wo.title,
      equipmentId: wo.equipmentId,
      equipmentName: wo.equipment.name,
      priority: wo.priority,
      status: wo.status,
    })),
    activeProjects: activeProjects.map((p: typeof activeProjects[number]) => ({
      id: p.id,
      title: p.title,
      status: p.status,
      description: p.description,
    })),
    activeSchedules: activeSchedules.map((s: typeof activeSchedules[number]) => ({
      id: s.id,
      title: s.title,
      equipmentId: s.equipmentId,
      equipmentName: s.equipment.name,
      frequency: s.frequency,
      nextDue: s.nextDue.toISOString().split("T")[0],
    })),
  };

  for (const msg of messages) {
    if (!shouldAnalyze(msg)) {
      await prisma.processedMessage.create({
        data: {
          externalId: msg.externalId,
          sourceType,
          sourceId: userId,
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

    try {
      const analysis = await analyzeMessage(
        {
          subject: msg.subject,
          body: msg.bodyContent,
          senderName: msg.senderName,
          senderEmail: msg.senderEmail,
        },
        analysisContext
      );

      const processed = await prisma.processedMessage.create({
        data: {
          externalId: msg.externalId,
          sourceType,
          sourceId: userId,
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
      console.error("[Scan] AI analysis failed:", msg.externalId, err);
      result.errors.push(`AI analysis failed for: ${msg.subject}`);
    }
  }
}

/**
 * Run a scan: user's email + Teams channels.
 * If deep=true, clears delta link and goes back 30 days for email.
 */
export async function runUserScan(
  userId: string,
  options: { deep?: boolean } = {}
): Promise<ScanResult> {
  const result: ScanResult = {
    messagesFound: 0,
    messagesAnalyzed: 0,
    suggestionsCreated: 0,
    preFiltered: 0,
    teamsMessages: 0,
    errors: [],
  };

  const connection = await getUserConnection(userId);
  if (!connection) {
    result.errors.push("No MS365 connection found. Please connect your account first.");
    return result;
  }

  // --- EMAIL SCANNING ---
  try {
    const mailMessages = await pollUserMailbox(connection.id, options.deep);
    result.messagesFound += mailMessages.length;
    await processMessages(mailMessages, "email", userId, result);
  } catch (err) {
    result.errors.push(`Email scan: ${err instanceof Error ? err.message : String(err)}`);
  }

  // --- TEAMS SCANNING ---
  try {
    const teamsMessages = await pollUserTeams(connection.id);
    result.teamsMessages = teamsMessages.length;
    result.messagesFound += teamsMessages.length;
    await processMessages(teamsMessages, "teams", userId, result);
  } catch (err) {
    console.warn("[Scan] Teams scanning failed:", err);
    result.errors.push("Teams: not accessible (may need additional permissions)");
  }

  return result;
}
