import { Client } from "@microsoft/microsoft-graph-client";
import { prisma } from "@/lib/prisma";

export interface RawMessage {
  externalId: string;
  subject: string;
  senderName: string;
  senderEmail: string;
  bodyPreview: string;
  bodyContent: string;
  receivedAt: Date;
}

export async function pollMailbox(
  graphClient: Client,
  configId: string
): Promise<RawMessage[]> {
  const config = await prisma.m365MonitorConfig.findUniqueOrThrow({
    where: { id: configId },
  });

  const messages: RawMessage[] = [];

  try {
    let url: string;
    if (config.deltaLink) {
      // Incremental poll using delta link
      url = config.deltaLink;
    } else {
      // First poll — get messages from last 24 hours
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      url = `/users/${config.sourceId}/mailFolders/inbox/messages/delta?$filter=receivedDateTime ge ${since}&$select=id,subject,from,bodyPreview,body,receivedDateTime&$top=20`;
    }

    const response = await graphClient.api(url).get();

    // Batch-check which messages are already processed (avoids N+1 queries)
    const messageIds = (response.value || []).map((msg: any) => msg.id);
    const existingMessages = await prisma.processedMessage.findMany({
      where: { externalId: { in: messageIds } },
      select: { externalId: true },
    });
    const existingIds = new Set(existingMessages.map((m: any) => m.externalId));

    // Process messages
    for (const msg of response.value || []) {
      // Skip if already processed
      if (existingIds.has(msg.id)) continue;

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

    // Store delta link for next poll
    const newDeltaLink = response["@odata.deltaLink"] || response["@odata.nextLink"];
    if (newDeltaLink) {
      await prisma.m365MonitorConfig.update({
        where: { id: configId },
        data: { deltaLink: newDeltaLink, lastPolledAt: new Date() },
      });
    } else {
      await prisma.m365MonitorConfig.update({
        where: { id: configId },
        data: { lastPolledAt: new Date() },
      });
    }
  } catch (error) {
    console.error(`[M365 Mail Poller] Error polling ${config.sourceId}:`, error);
    // If delta link is stale, clear it so next poll starts fresh
    if (config.deltaLink) {
      await prisma.m365MonitorConfig.update({
        where: { id: configId },
        data: { deltaLink: null },
      });
    }
  }

  return messages;
}
