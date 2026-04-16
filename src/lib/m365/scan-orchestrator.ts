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
  "noreply@",               // Automated form submissions
  "forms@",                 // MS Forms notifications
];

// Senders/domains to ALWAYS ignore — never analyze these
const BLOCKED_SENDERS = [
  "ticketmaster", "stubhub", "seatgeek", "vivid seats",
  "sabres", "bills", "nhl.com", "nfl.com", "mlb.com", "nba.com",
  "linkedin", "facebook", "twitter", "instagram", "tiktok",
  "newsletter", "unsubscribe", "marketing", "promo",
  "donotreply@", "no-reply@",
  "indeed.com", "glassdoor", "ziprecruiter",
  "grubhub", "doordash", "ubereats",
  "amazon.com", "ebay.com", "walmart.com",
  "docusign", "adobe", "dropbox",
  "zoom.us", "calendly", "doodle",
  "slack.com", "teams@email",
  "bankofamerica", "chase.com", "paypal",
  "xerox", "pitneybowes",
];

// Subject keywords that indicate irrelevant emails
const BLOCKED_SUBJECTS = [
  "box seats", "suite tickets", "game tickets", "season tickets",
  "happy hour", "team outing", "birthday", "potluck", "lunch order",
  "out of office", "ooo", "vacation",
  "newsletter", "digest", "weekly update from linkedin",
  "your receipt", "order confirmation", "shipping confirmation",
  "password reset", "verify your email", "two-factor",
  "webinar", "register now", "sign up today",
  "ltl", "freight quote", "freight rate", "trucking rate",
  "bill of lading", "bol", "tracking number",
  "invoice", "payment due", "accounts payable", "accounts receivable",
];

// Keywords for pre-filtering messages before AI analysis.
// Focused on: service, preventive maintenance, parts, equipment help, project progress.
// Excludes: invoices, billing, payments, money-related content.
const MAINTENANCE_KEYWORDS = [
  // RubberForm specific equipment
  "dake", "9-ram", "5-ram", "bollard cutting", "cst drill",
  "atlas copco", "emcor", "heatec", "jit toyota",
  // Rubber processing equipment
  "extruder", "grinder", "baler", "conveyor", "shredder", "granulator", "mixer",
  "press", "mold", "vulcanizer", "crusher", "roller", "hopper", "feeder",
  "separator", "classifier",
  // Forklifts & plant vehicles
  "forklift", "reach truck", "pallet jack", "scissor lift",
  "f250", "f-250", "penske", "box truck",
  // Motors & power
  "motor", "compressor", "generator", "gearbox", "vfd",
  "transformer", "breaker", "charger",
  // Parts & components
  "bearing", "belt", "filter", "gasket", "seal", "valve", "rotor",
  "impeller", "coupling", "sprocket", "chain", "blade", "die", "shaft",
  "bushing", "cylinder", "piston", "nozzle",
  // Hoses & plumbing
  "hydraulic hose", "air hose", "pipe", "tubing", "fitting", "manifold", "regulator",
  // Oils & fluids
  "hydraulic oil", "gear oil", "coolant", "lubricant", "grease",
  "hydraulic fluid", "propane",
  // Maintenance actions
  "needs repair", "broken", "leak", "maintenance", "preventive maintenance",
  "work order", "repair", "calibrate", "overhaul", "rebuild",
  "preventive", "preventative", "pm ", "scheduled maintenance", "routine service",
  "service needed", "needs service", "help needed", "need help",
  // Parts shipping & ordering
  "shipped", "shipping", "delivered", "arrived", "in transit",
  "back order", "backorder", "on order", "eta", "expected delivery",
  "parts needed", "parts ordered", "parts received", "parts on the way",
  "waiting on parts", "waiting for parts",
  // Problem indicators
  "malfunction", "vibration", "overheating", "pressure drop",
  "stuck", "jammed", "won't start", "not working", "acting up", "broke down",
  // Safety & compliance
  "osha", "lockout", "tagout", "loto", "fire extinguisher",
  "safety incident", "near miss", "injury",
  // Facility
  "hvac", "dock leveler", "overhead door", "loading dock", "plumbing",
  // Vendor/supplier (specific to equipment)
  "inquip", "parts order", "spare parts", "replacement part",
  "service call", "service tech", "field service",
  "pm agreement", "maintenance contract",
  // PM specific
  "pm schedule", "inspection due", "calibration due",
  "maintenance due", "service due", "overdue",
  // General equipment & auxiliary
  "machine", "equipment", "auxiliary", "attachment", "accessory", "component",
  // Projects & progress (no money terms)
  "project", "upgrade", "installation", "progress", "update on",
  "status update", "next step", "ready for",
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
 * Check if a sender/subject should be blocked entirely.
 */
function isBlocked(message: RawMessage): boolean {
  const email = message.senderEmail.toLowerCase();
  const subject = message.subject.toLowerCase();
  if (BLOCKED_SENDERS.some((b) => email.includes(b))) return true;
  if (BLOCKED_SUBJECTS.some((b) => subject.includes(b))) return true;
  return false;
}

/**
 * Pre-filter: check if a message likely contains maintenance-related content.
 * Blocked senders/subjects are always rejected.
 * Priority senders always pass the filter.
 */
function shouldAnalyze(message: RawMessage): boolean {
  if (isBlocked(message)) return false;
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
