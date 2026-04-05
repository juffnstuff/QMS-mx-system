import { Client } from "@microsoft/microsoft-graph-client";
import { prisma } from "@/lib/prisma";
import type { RawMessage } from "./mail-poller";

export async function pollTeamsChannel(
  graphClient: Client,
  configId: string
): Promise<RawMessage[]> {
  const config = await prisma.m365MonitorConfig.findUniqueOrThrow({
    where: { id: configId },
  });

  const messages: RawMessage[] = [];
  // sourceId format: "teamId/channelId"
  const [teamId, channelId] = config.sourceId.split("/");

  try {
    let url: string;
    if (config.deltaLink) {
      url = config.deltaLink;
    } else {
      // First poll — messages from last 24 hours
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      url = `/teams/${teamId}/channels/${channelId}/messages/delta?$top=20`;
      // Note: Teams messages delta doesn't support $filter, so we filter client-side
    }

    const response = await graphClient.api(url).get();

    for (const msg of response.value || []) {
      // Skip system messages and already-processed
      if (msg.messageType !== "message") continue;

      const receivedAt = new Date(msg.createdDateTime);
      // Skip old messages on first poll
      if (!config.deltaLink) {
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
        if (receivedAt < cutoff) continue;
      }

      const existing = await prisma.processedMessage.findUnique({
        where: { externalId: msg.id },
      });
      if (existing) continue;

      const bodyText = msg.body?.content || "";
      messages.push({
        externalId: msg.id,
        subject: `Teams: ${config.displayName}`,
        senderName: msg.from?.user?.displayName || "Unknown",
        senderEmail: msg.from?.user?.email || "",
        bodyPreview: bodyText.replace(/<[^>]*>/g, "").slice(0, 500),
        bodyContent: bodyText.replace(/<[^>]*>/g, ""),
        receivedAt,
      });
    }

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
    console.error(`[M365 Teams Poller] Error polling ${config.displayName}:`, error);
    if (config.deltaLink) {
      await prisma.m365MonitorConfig.update({
        where: { id: configId },
        data: { deltaLink: null },
      });
    }
  }

  return messages;
}
