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
  "penske",                 // Penske truck rental/leasing emails
  "noreply@",               // Automated form submissions
  "forms@",                 // MS Forms notifications
];

// Maintenance-related keywords for pre-filtering messages before AI analysis
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
  // Parts
  "belt", "bearing", "filter", "gasket", "seal", "valve", "wiring", "rotor",
  "impeller", "coupling", "sprocket", "chain", "blade", "screen", "die", "shaft",
  "bushing", "bracket", "wheel", "tire", "brake", "cylinder", "piston",
  // Hoses & cables
  "hose", "cable", "pipe", "tubing", "fitting", "connector", "manifold", "regulator",
  // Oils & fluids
  "oil", "grease", "coolant", "lubricant", "fluid", "hydraulic fluid", "diesel",
  "propane", "antifreeze", "fuel",
  // Maintenance actions
  "leak", "broken", "repair", "fix", "maintenance", "service", "replace",
  "install", "inspect", "calibrate", "overhaul", "rebuild", "order", "ordered",
  // Problem indicators
  "down", "malfunction", "noise", "vibration", "overheating", "pressure",
  "stuck", "jam", "fail", "crack", "wear", "corroded", "damaged", "broke",
  "not working", "won't start", "won't run", "acting up",
  // Safety
  "osha", "ppe", "lockout", "tagout", "loto", "fire extinguisher", "guard",
  "safety", "incident", "injury", "near miss",
  // General equipment
  "machine", "equipment", "tool", "part", "parts", "spare",
  // Projects & vendors
  "quote", "vendor", "supplier", "inquip", "contractor", "project", "upgrade",
  "purchase", "po ", "p.o.", "invoice",
  // Facility
  "hvac", "roof", "dock", "door", "plumbing", "lighting", "electrical", "floor",
  "concrete", "fencing", "gate", "parking", "yard",
  // Shop-specific
  "shop", "plant", "factory", "production", "line", "bay", "warehouse",
  // Documents & forms
  "sop", "work instruction", "checklist", "form", "procedure", "inspection",
  "maintenance needed", "work request", "service request",
];

export interface ScanResult {
  messagesFound: number;
  messagesAnalyzed: number;
  suggestionsCreated: number;
  preFiltered: number;
  teamsMessages: number;
  sharePointDocs: number;
  formsResponses: number;
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
 * Scan SharePoint for documents AND list items (including MS Forms responses).
 * MS Forms stores responses in SharePoint lists, so we read them via the Lists API.
 */
async function scanSharePoint(): Promise<{
  docs: RawMessage[];
  docsIndexed: number;
  formsResponses: RawMessage[];
}> {
  const docs: RawMessage[] = [];
  const formsResponses: RawMessage[] = [];
  let docsIndexed = 0;

  try {
    const appClient = await getAppGraphClient();

    const sitesResponse = await appClient
      .api("/sites?search=*&$select=id,displayName,webUrl&$top=50")
      .get();

    for (const site of sitesResponse.value || []) {
      if (!site.id || !site.displayName) continue;

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

      // --- DOCUMENT LIBRARIES ---
      try {
        const drives = await appClient
          .api(`/sites/${site.id}/drives?$select=id,name&$top=10`)
          .get();

        for (const drive of drives.value || []) {
          try {
            const items = await appClient
              .api(`/drives/${drive.id}/root/children?$select=id,name,webUrl,file,lastModifiedDateTime,lastModifiedBy&$top=50`)
              .get();

            for (const item of items.value || []) {
              if (!item.file) continue;

              const existing = await prisma.sharePointDocument.findUnique({
                where: { externalId: item.id },
              });
              const lastModified = new Date(item.lastModifiedDateTime);
              if (existing && existing.lastModified >= lastModified) continue;

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
                nameLC.includes("equipment") ||
                nameLC.includes("vehicle") ||
                nameLC.includes("truck") ||
                nameLC.includes("pump");

              if (isRelevantDoc) {
                const modifiedBy = item.lastModifiedBy?.user?.displayName || "Unknown";
                docs.push({
                  externalId: `sp-${item.id}`,
                  subject: `SharePoint: ${item.name}`,
                  senderName: modifiedBy,
                  senderEmail: item.lastModifiedBy?.user?.email || "",
                  bodyPreview: `Document "${item.name}" in ${site.displayName} (${item.file.mimeType || "unknown type"}).`,
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
        // Skip inaccessible site drives
      }

      // --- SHAREPOINT LISTS (includes MS Forms responses) ---
      try {
        const listsResponse = await appClient
          .api(`/sites/${site.id}/lists?$select=id,displayName,list&$top=50`)
          .get();

        for (const list of listsResponse.value || []) {
          const listName = (list.displayName || "").toLowerCase();

          // Look for lists that are Forms responses or maintenance-related
          const isRelevantList =
            listName.includes("maintenance") ||
            listName.includes("form") ||
            listName.includes("request") ||
            listName.includes("work order") ||
            listName.includes("equipment") ||
            listName.includes("inspection") ||
            listName.includes("checklist") ||
            listName.includes("safety") ||
            listName.includes("vehicle") ||
            listName.includes("truck") ||
            listName.includes("pump") ||
            listName.includes("shop") ||
            // MS Forms creates lists with template "genericList" or the form title
            (list.list?.template === "genericList");

          if (!isRelevantList) continue;

          try {
            // Get recent list items (last 30 days)
            const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
            const itemsResponse = await appClient
              .api(
                `/sites/${site.id}/lists/${list.id}/items?$expand=fields&$top=50&$orderby=lastModifiedDateTime desc&$filter=lastModifiedDateTime ge '${since}'`
              )
              .get();

            for (const item of itemsResponse.value || []) {
              const itemId = `form-${list.id}-${item.id}`;

              const existing = await prisma.processedMessage.findUnique({
                where: { externalId: itemId },
              });
              if (existing) continue;

              // Extract all field values into a readable format
              const fields = item.fields || {};
              const fieldEntries = Object.entries(fields)
                .filter(
                  ([key]) =>
                    !key.startsWith("@") &&
                    !key.startsWith("_") &&
                    key !== "id" &&
                    key !== "ContentType" &&
                    key !== "Attachments"
                )
                .map(([key, value]) => `${key}: ${value}`)
                .join("\n");

              const createdBy =
                item.createdBy?.user?.displayName || "Unknown";
              const createdAt = new Date(
                item.createdDateTime || item.lastModifiedDateTime
              );

              formsResponses.push({
                externalId: itemId,
                subject: `Form: ${list.displayName}`,
                senderName: createdBy,
                senderEmail: item.createdBy?.user?.email || "",
                bodyPreview: `Form response in "${list.displayName}" from ${createdBy}. ${fieldEntries.slice(0, 300)}`,
                bodyContent: `MS Forms / SharePoint List Response\nForm: "${list.displayName}"\nSite: ${site.displayName}\nSubmitted by: ${createdBy}\nSubmitted: ${createdAt.toISOString()}\n\n--- Response Fields ---\n${fieldEntries}`,
                receivedAt: createdAt,
              });
            }
          } catch (listErr) {
            console.warn(`[Scan] Cannot read list "${list.displayName}":`, listErr);
          }
        }
      } catch {
        // Skip if lists API fails for this site
      }

      await prisma.m365SharePointSite
        .update({
          where: { siteId: site.id },
          data: { lastScannedAt: new Date() },
        })
        .catch(() => {});
    }
  } catch (error) {
    console.error("[Scan] SharePoint scanning failed:", error);
    throw error;
  }

  return { docs, docsIndexed, formsResponses };
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
        // Forms auto-create: if source is forms AND action is create_work_order AND equipment is known
        if (
          sourceType === "forms" &&
          action.type === "create_work_order" &&
          action.equipmentId !== "unknown"
        ) {
          try {
            const workOrder = await prisma.workOrder.create({
              data: {
                equipmentId: action.equipmentId,
                createdById: userId,
                title: action.title,
                description: `[Auto-created from MS Forms submission]\n\n${action.description}`,
                priority: action.priority || "medium",
              },
            });
            await prisma.aISuggestion.create({
              data: {
                processedMessageId: processed.id,
                suggestionType: action.type,
                status: "auto_applied",
                payload: JSON.stringify(action),
                createdRecordType: "WorkOrder",
                createdRecordId: workOrder.id,
              },
            });
            result.suggestionsCreated++;
            continue;
          } catch (autoErr) {
            console.warn("[Scan] Forms auto-create failed, falling back to pending:", autoErr);
          }
        }

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
 * Run a full scan: user's email + Teams channels + SharePoint + Forms.
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
    sharePointDocs: 0,
    formsResponses: 0,
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

  // --- SHAREPOINT + FORMS SCANNING ---
  try {
    const { docs, docsIndexed, formsResponses } = await scanSharePoint();
    result.sharePointDocs = docsIndexed;
    result.formsResponses = formsResponses.length;
    result.messagesFound += docs.length + formsResponses.length;
    await processMessages(docs, "sharepoint", userId, result);
    await processMessages(formsResponses, "forms", userId, result);
  } catch (err) {
    console.warn("[Scan] SharePoint/Forms scanning failed:", err);
    result.errors.push("SharePoint/Forms: not accessible (may need admin consent)");
  }

  return result;
}
