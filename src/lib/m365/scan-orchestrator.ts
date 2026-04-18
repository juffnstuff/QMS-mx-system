import { prisma } from "@/lib/prisma";
import { getUserConnection, getGraphClient } from "./graph-client";
import { analyzeMessage } from "@/lib/ai/analyze-message";
import { extractAttachmentText } from "./extract-attachment-text";
import type { RawMessage, RawAttachment } from "./mail-poller";

// Key senders whose emails ALWAYS get AI analysis (skip pre-filter)
const PRIORITY_SENDERS = [
  "shop@rubberform.com",
  "joe@rubberform.com",
  "anthony@rubberform.com",
  "jesse@rubberform.com",
  "jesse@inquip",
  "bill@rubberform.com",
  "aaron@rubberform.com",
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
  "bill of lading", "bol",
  // Billing/financial — QMS does not track these
  "invoice", "statement of account", "past due", "accounts receivable",
  "accounts payable", "remittance",
];

// Maintenance-related keywords for pre-filtering messages before AI analysis
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
  // Problem indicators
  "malfunction", "vibration", "overheating", "pressure drop",
  "stuck", "jammed", "won't start", "not working", "acting up", "broke down",
  // Safety & compliance
  "osha", "lockout", "tagout", "loto", "fire extinguisher",
  "safety incident", "near miss", "injury",
  // Facility
  "hvac", "dock leveler", "overhead door", "loading dock", "plumbing",
  // Vendor/supplier (equipment)
  "inquip", "parts order", "spare parts", "replacement part",
  "service call", "service tech", "field service",
  "pm agreement", "maintenance contract",
  // PM specific
  "pm schedule", "preventive", "inspection due", "calibration due",
  "maintenance due", "service due", "overdue",
  // Parts shipping / arrival — progress signals on existing WOs
  "parts shipped", "parts shipping", "parts on the way", "parts in transit",
  "parts arrived", "parts in", "parts delivery", "part shipped",
  "tracking number for parts", "pump shipped", "motor shipped",
  // Help-needed / urgent signals
  "need help", "help needed", "help with", "can you look at", "can someone look",
  "can someone check", "please check", "urgent issue", "asap",
  // Progress / follow-up signals
  "update on", "status on", "status of", "progress on", "any progress",
  "waiting on", "follow up on", "following up on", "heads up on",
];

export interface ScanResult {
  messagesFound: number;
  messagesAnalyzed: number;
  suggestionsCreated: number;
  preFiltered: number;
  irrelevant: number;
  suggestionErrors: number;
  teamsMessages: number;
  errors: string[];
}

function isPrioritySender(senderEmail: string): boolean {
  const email = senderEmail.toLowerCase();
  return PRIORITY_SENDERS.some((ps) => email.includes(ps));
}

function isBlocked(message: RawMessage): boolean {
  const email = message.senderEmail.toLowerCase();
  const subject = message.subject.toLowerCase();
  if (BLOCKED_SENDERS.some((b) => email.includes(b))) return true;
  if (BLOCKED_SUBJECTS.some((b) => subject.includes(b))) return true;
  return false;
}

function shouldAnalyze(message: RawMessage): boolean {
  if (isBlocked(message)) return false;
  if (isPrioritySender(message.senderEmail)) return true;
  const text = `${message.subject} ${message.bodyContent}`.toLowerCase();
  return MAINTENANCE_KEYWORDS.some((keyword) => text.includes(keyword));
}

async function pollUserMailbox(
  connectionId: string,
  deep: boolean = false
): Promise<RawMessage[]> {
  const connection = await prisma.m365Connection.findUniqueOrThrow({
    where: { id: connectionId },
  });

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
      const days = deep ? 30 : 7;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      url = `/me/mailFolders/inbox/messages/delta?$filter=receivedDateTime ge ${since}&$select=id,subject,from,bodyPreview,body,receivedDateTime,hasAttachments&$top=100`;
    }

    let hasMore = true;
    while (hasMore) {
      const response = await graphClient.api(url).get();

      for (const msg of response.value || []) {
        const existing = await prisma.processedMessage.findUnique({
          where: { externalId: msg.id },
        });
        if (existing) continue;

        let attachments: RawAttachment[] | undefined;
        if (msg.hasAttachments) {
          try {
            const attachmentResp = await graphClient
              .api(`/me/messages/${msg.id}/attachments?$select=name,contentType,size,contentBytes,@odata.type`)
              .get();
            attachments = (attachmentResp.value || [])
              .filter((a: { ["@odata.type"]?: string }) =>
                // Only file attachments carry contentBytes; skip itemAttachment / referenceAttachment.
                a["@odata.type"] === "#microsoft.graph.fileAttachment",
              )
              .map((a: { name: string; contentType: string; size: number; contentBytes?: string }) => ({
                filename: a.name,
                contentType: a.contentType || "application/octet-stream",
                sizeBytes: a.size || 0,
                contentBase64: a.contentBytes || "",
              }));
          } catch (err) {
            console.warn(`[Scan] Failed to fetch attachments for ${msg.id}:`, err);
          }
        }

        messages.push({
          externalId: msg.id,
          subject: msg.subject || "(No subject)",
          senderName: msg.from?.emailAddress?.name || "Unknown",
          senderEmail: msg.from?.emailAddress?.address || "",
          bodyPreview: (msg.bodyPreview || "").slice(0, 500),
          bodyContent: msg.body?.content || msg.bodyPreview || "",
          receivedAt: new Date(msg.receivedDateTime),
          attachments,
        });
      }

      if (response["@odata.nextLink"]) {
        url = response["@odata.nextLink"];
      } else {
        if (response["@odata.deltaLink"]) {
          await prisma.m365Connection.update({
            where: { id: connectionId },
            data: { deltaLink: response["@odata.deltaLink"], lastPolledAt: new Date() },
          });
        }
        hasMore = false;
      }

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

async function processMessages(
  messages: RawMessage[],
  sourceType: string,
  userId: string,
  result: ScanResult
) {
  // Full context for the AI — equipment + open records so it can progress
  // existing items instead of creating duplicates.
  const [equipment, openWorkOrders, activeProjects, activeSchedules] = await Promise.all([
    prisma.equipment.findMany({
      select: {
        id: true,
        name: true,
        type: true,
        location: true,
        serialNumber: true,
        status: true,
        parentId: true,
      },
    }),
    prisma.workOrder.findMany({
      where: { status: { in: ["open", "in_progress"] } },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        equipment: { select: { name: true } },
      },
    }),
    prisma.project.findMany({
      where: { status: { in: ["planning", "in_progress", "on_hold"] } },
      select: {
        id: true,
        title: true,
        status: true,
        phase: true,
        keywords: true,
        parentProjectId: true,
      },
    }),
    prisma.maintenanceSchedule.findMany({
      where: { boardStatus: { not: "done" } },
      select: {
        id: true,
        title: true,
        frequency: true,
        nextDue: true,
        equipment: { select: { name: true } },
      },
    }),
  ]);

  const workOrderContext = openWorkOrders.map((w) => ({
    id: w.id,
    title: w.title,
    equipmentName: w.equipment.name,
    status: w.status,
    priority: w.priority,
  }));

  const scheduleContext = activeSchedules.map((s) => ({
    id: s.id,
    title: s.title,
    equipmentName: s.equipment.name,
    frequency: s.frequency,
    nextDue: s.nextDue,
  }));

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

    // Extract text from any file attachments now so the AI sees them as part
    // of the message context. Each attachment's extracted text (or error) gets
    // persisted as MessageAttachment so the reviewer can see the breakdown.
    const extractedAttachments: Array<{
      filename: string;
      contentType: string;
      sizeBytes: number;
      extractedText: string | null;
      extractionError: string | null;
    }> = [];

    if (msg.attachments && msg.attachments.length > 0) {
      for (const att of msg.attachments) {
        if (!att.contentBase64) {
          extractedAttachments.push({
            filename: att.filename,
            contentType: att.contentType,
            sizeBytes: att.sizeBytes,
            extractedText: null,
            extractionError: "Attachment content was not provided by Microsoft Graph",
          });
          continue;
        }
        const buffer = Buffer.from(att.contentBase64, "base64");
        const out = await extractAttachmentText({
          buffer,
          contentType: att.contentType,
          filename: att.filename,
          sizeBytes: att.sizeBytes,
        });
        extractedAttachments.push({
          filename: att.filename,
          contentType: att.contentType,
          sizeBytes: att.sizeBytes,
          extractedText: out.text ?? null,
          extractionError: out.error ?? null,
        });
      }
    }

    let analysis: Awaited<ReturnType<typeof analyzeMessage>>;
    try {
      analysis = await analyzeMessage(
        {
          subject: msg.subject,
          body: msg.bodyContent,
          senderName: msg.senderName,
          senderEmail: msg.senderEmail,
          attachments: extractedAttachments
            .filter((a) => a.extractedText && a.extractedText.trim().length > 0)
            .map((a) => ({ filename: a.filename, text: a.extractedText! })),
        },
        {
          equipment,
          workOrders: workOrderContext,
          projects: activeProjects,
          schedules: scheduleContext,
        }
      );
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error("[Scan] AI analysis threw:", msg.externalId, err);
      result.errors.push(`AI analysis failed for "${msg.subject}": ${detail}`);
      continue;
    }

    const hasActions = analysis.relevant && analysis.suggestedActions.length > 0;

    // Persist the processed message and any suggestions atomically so a
    // suggestion-insert failure cannot leave a bare ProcessedMessage behind
    // (which would block the message from ever being re-scanned).
    try {
      await prisma.$transaction(async (tx) => {
        const processed = await tx.processedMessage.create({
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

        for (const att of extractedAttachments) {
          await tx.messageAttachment.create({
            data: {
              processedMessageId: processed.id,
              filename: att.filename,
              contentType: att.contentType,
              sizeBytes: att.sizeBytes,
              extractedText: att.extractedText,
              extractionError: att.extractionError,
            },
          });
        }

        if (!hasActions) return;

        for (const action of analysis.suggestedActions) {
          await tx.aISuggestion.create({
            data: {
              processedMessageId: processed.id,
              suggestionType: action.type,
              kind: action.kind ?? "project",
              status: "pending",
              payload: JSON.stringify(action),
              proposedFields: action.proposedFields
                ? (action.proposedFields as object)
                : undefined,
            },
          });
        }
      });

      result.messagesAnalyzed++;
      if (!hasActions) {
        result.irrelevant++;
      } else {
        result.suggestionsCreated += analysis.suggestedActions.length;
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error(
        "[Scan] Suggestion persistence failed:",
        msg.externalId,
        err,
      );
      result.suggestionErrors++;
      result.errors.push(
        `Suggestion insert failed for "${msg.subject}": ${detail}`,
      );
    }
  }
}

/**
 * Run a full scan: user's email + Teams channels. SharePoint/Forms scanning
 * has been removed — the scanner is now email + Teams only.
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
    irrelevant: 0,
    suggestionErrors: 0,
    teamsMessages: 0,
    errors: [],
  };

  const connection = await getUserConnection(userId);
  if (!connection) {
    result.errors.push("No MS365 connection found. Please connect your account first.");
    return result;
  }

  try {
    const mailMessages = await pollUserMailbox(connection.id, options.deep);
    result.messagesFound += mailMessages.length;
    await processMessages(mailMessages, "email", userId, result);
  } catch (err) {
    result.errors.push(`Email scan: ${err instanceof Error ? err.message : String(err)}`);
  }

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
