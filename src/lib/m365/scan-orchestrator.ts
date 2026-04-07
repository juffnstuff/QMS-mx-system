import { prisma } from "@/lib/prisma";
import { getUserConnection, getGraphClient, getAppGraphClient } from "./graph-client";
import { analyzeMessage } from "@/lib/ai/analyze-message";
import type { RawMessage } from "./mail-poller";
import type { Client } from "@microsoft/microsoft-graph-client";

// Key senders whose emails ALWAYS get AI analysis (skip pre-filter)
const PRIORITY_SENDERS = [
  "shop@rubberform.com",
  "joe@rubberform.com",
  "anthony@rubberform.com",
  "jesse@rubberform.com",
  "jesse@inquip",           // partial match for jesse@inquip.com or similar
  "bill@rubberform.com",
  "aaron@rubberform.com",
];

// Maintenance-related keywords for pre-filtering messages before AI analysis
const MAINTENANCE_KEYWORDS = [
  // Vehicles
  "vehicle", "forklift", "truck", "loader", "bobcat", "plow", "trailer", "fleet",
  // Pumps
  "pump", "hydraulic", "sump", "vacuum",
  // Rubber processing equipment
  "extruder", "grinder", "baler", "conveyor", "shredder", "granulator", "mixer",
  "press", "mold", "vulcanizer", "crusher", "roller", "hopper", "feeder",
  // Motors & power
  "motor", "compressor", "generator", "engine", "drive", "gearbox", "vfd",
  // Parts
  "belt", "bearing", "filter", "gasket", "seal", "valve", "wiring", "rotor",
  "impeller", "coupling", "sprocket", "chain", "blade", "screen", "die", "shaft",
  // Hoses & cables
  "hose", "cable", "pipe", "tubing", "fitting", "connector",
  // Oils & fluids
  "oil", "grease", "coolant", "lubricant", "fluid", "hydraulic fluid", "diesel", "propane",
  // Maintenance actions
  "leak", "broken", "repair", "fix", "maintenance", "service", "replace",
  "install", "inspect", "calibrate", "overhaul", "rebuild",
  // Problem indicators
  "down", "malfunction", "noise", "vibration", "overheating", "pressure",
  "stuck", "jam", "fail", "crack", "wear", "corroded", "damaged",
  // Safety
  "osha", "ppe", "lockout", "tagout", "fire extinguisher", "guard", "safety",
  // General equipment
  "machine", "equipment", "tool", "part", "parts", "spare",
  // Projects & vendors
  "quote", "vendor", "supplier", "inquip", "contractor", "project", "upgrade",
  // Facility
  "hvac", "roof", "dock", "door", "plumbing", "lighting", "electrical",
  // Shop-specific
  "shop", "plant", "factory", "production", "line", "bay",
  // Documents
  "sop", "work instruction", "checklist", "form", "procedure", "inspection",
];

export interface ScanResult {
  messagesFound: number;
  messagesAnalyzed: number;
  suggestionsCreated: number;
  preFiltered: number;
  teamsMessages: number;
  sharePointDocs: number;
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
  // Priority senders always get analyzed
  if (isPrioritySender(message.senderEmail)) return true;

  const text = `${message.subject} ${message.bodyContent}`.toLowerCase();
  return MAINTENANCE_KEYWORDS.some((keyword) => text.includes(keyword));
}

/**
 * Poll the user's mailbox using /me/mailFolders/inbox/messages/delta
 */
async function pollUserMailbox(connectionId: string): Promise<RawMessage[]> {
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
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      url = `/me/mailFolders/inbox/messages/delta?$filter=receivedDateTime ge ${since}&$select=id,subject,from,bodyPreview,body,receivedDateTime&$top=50`;
    }

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

    const newDeltaLink = response["@odata.deltaLink"] || response["@odata.nextLink"];
    await prisma.m365Connection.update({
      where: { id: connectionId },
      data: { deltaLink: newDeltaLink || null, lastPolledAt: new Date() },
    });
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
 * No manual monitor configuration needed.
 */
async function pollUserTeams(connectionId: string): Promise<RawMessage[]> {
  const graphClient = await getGraphClient(connectionId);
  const messages: RawMessage[] = [];

  try {
    // Get all teams the user is a member of
    const teamsResponse = await graphClient.api("/me/joinedTeams?$select=id,displayName").get();
    const teams = teamsResponse.value || [];

    for (const team of teams) {
      try {
        // Get all channels in this team
        const channelsResponse = await graphClient
          .api(`/teams/${team.id}/channels?$select=id,displayName`)
          .get();

        for (const channel of channelsResponse.value || []) {
          try {
            // Get recent messages from this channel (last 7 days on first scan)
            const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            const msgsResponse = await graphClient
              .api(`/teams/${team.id}/channels/${channel.id}/messages?$top=25`)
              .get();

            for (const msg of msgsResponse.value || []) {
              if (msg.messageType !== "message") continue;

              const receivedAt = new Date(msg.createdDateTime);
              // Skip old messages
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
            // Some channels may not be accessible — skip silently
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
 * Scan SharePoint sites for SOPs, Work Instructions, and shop forms.
 * Uses app-level permissions to discover and read sites.
 */
async function scanSharePoint(): Promise<{ docs: RawMessage[]; docsIndexed: number }> {
  const docs: RawMessage[] = [];
  let docsIndexed = 0;

  try {
    const appClient = await getAppGraphClient();

    // Discover SharePoint sites
    const sitesResponse = await appClient
      .api("/sites?search=*&$select=id,displayName,webUrl&$top=50")
      .get();

    for (const site of sitesResponse.value || []) {
      if (!site.id || !site.displayName) continue;

      // Upsert site record
      await prisma.m365SharePointSite.upsert({
        where: { siteId: site.id },
        update: { siteName: site.displayName, siteUrl: site.webUrl || "" },
        create: {
          siteId: site.id,
          siteName: site.displayName,
          siteUrl: site.webUrl || "",
          isActive: true,
        },
      });

      try {
        // Get drives (document libraries)
        const drives = await appClient
          .api(`/sites/${site.id}/drives?$select=id,name&$top=10`)
          .get();

        for (const drive of drives.value || []) {
          try {
            // List recent files
            const items = await appClient
              .api(`/drives/${drive.id}/root/children?$select=id,name,webUrl,file,lastModifiedDateTime,lastModifiedBy&$top=50`)
              .get();

            for (const item of items.value || []) {
              if (!item.file) continue;

              // Check if already processed
              const existing = await prisma.sharePointDocument.findUnique({
                where: { externalId: item.id },
              });
              const lastModified = new Date(item.lastModifiedDateTime);
              if (existing && existing.lastModified >= lastModified) continue;

              // Upsert document
              await prisma.sharePointDocument.upsert({
                where: { externalId: item.id },
                update: {
                  name: item.name,
                  webUrl: item.webUrl || "",
                  contentType: item.file.mimeType || null,
                  lastModified,
                },
                create: {
                  externalId: item.id,
                  siteId: site.id,
                  name: item.name,
                  webUrl: item.webUrl || "",
                  contentType: item.file.mimeType || null,
                  lastModified,
                },
              });
              docsIndexed++;

              // Check if document name looks relevant (SOPs, WIs, forms, checklists)
              const nameLC = item.name.toLowerCase();
              const isRelevantDoc =
                nameLC.includes("sop") ||
                nameLC.includes("work instruction") ||
                nameLC.includes("wi-") ||
                nameLC.includes("checklist") ||
                nameLC.includes("form") ||
                nameLC.includes("maintenance") ||
                nameLC.includes("inspection") ||
                nameLC.includes("procedure") ||
                nameLC.includes("safety") ||
                nameLC.includes("equipment");

              if (isRelevantDoc) {
                const modifiedBy =
                  item.lastModifiedBy?.user?.displayName || "Unknown";

                docs.push({
                  externalId: `sp-${item.id}`,
                  subject: `SharePoint: ${item.name}`,
                  senderName: modifiedBy,
                  senderEmail: item.lastModifiedBy?.user?.email || "",
                  bodyPreview: `Document "${item.name}" in ${site.displayName} (${item.file.mimeType || "unknown type"}). Last modified by ${modifiedBy}.`,
                  bodyContent: `SharePoint document: "${item.name}"\nSite: ${site.displayName}\nLibrary: ${drive.name}\nType: ${item.file.mimeType || "unknown"}\nURL: ${item.webUrl}\nLast modified by: ${modifiedBy}\nLast modified: ${lastModified.toISOString()}`,
                  receivedAt: lastModified,
                });
              }
            }
          } catch {
            // Skip inaccessible drives
          }
        }
      } catch {
        // Skip inaccessible sites
      }

      await prisma.m365SharePointSite.update({
        where: { siteId: site.id },
        data: { lastScannedAt: new Date() },
      }).catch(() => {});
    }
  } catch (error) {
    console.error("[Scan] SharePoint scanning failed:", error);
    throw error;
  }

  return { docs, docsIndexed };
}

/**
 * Process messages through AI analysis and create suggestions.
 */
async function processMessages(
  messages: RawMessage[],
  sourceType: string,
  userId: string,
  result: ScanResult
) {
  const equipment = await prisma.equipment.findMany({
    select: { id: true, name: true, type: true, location: true, serialNumber: true, status: true },
  });

  for (const msg of messages) {
    // Pre-filter: skip non-maintenance messages (unless priority sender)
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
 * Run a full scan: user's email + Teams channels + SharePoint.
 */
export async function runUserScan(userId: string): Promise<ScanResult> {
  const result: ScanResult = {
    messagesFound: 0,
    messagesAnalyzed: 0,
    suggestionsCreated: 0,
    preFiltered: 0,
    teamsMessages: 0,
    sharePointDocs: 0,
    errors: [],
  };

  const connection = await getUserConnection(userId);
  if (!connection) {
    result.errors.push("No MS365 connection found. Please connect your account first.");
    return result;
  }

  // --- EMAIL SCANNING ---
  try {
    const mailMessages = await pollUserMailbox(connection.id);
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
    // Teams may not be accessible — just log, don't fail the whole scan
    console.warn("[Scan] Teams scanning failed (may need Teams scopes):", err);
    result.errors.push("Teams: not accessible (may need additional permissions)");
  }

  // --- SHAREPOINT SCANNING ---
  try {
    const { docs, docsIndexed } = await scanSharePoint();
    result.sharePointDocs = docsIndexed;
    result.messagesFound += docs.length;
    await processMessages(docs, "sharepoint", userId, result);
  } catch (err) {
    console.warn("[Scan] SharePoint scanning failed:", err);
    result.errors.push("SharePoint: not accessible (may need admin consent for app permissions)");
  }

  return result;
}
