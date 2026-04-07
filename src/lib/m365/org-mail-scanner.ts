import { Client } from "@microsoft/microsoft-graph-client";
import { prisma } from "@/lib/prisma";
import type { RawMessage } from "./mail-poller";

/**
 * Sync all org users from Azure AD into M365UserMailbox table.
 * Uses client credentials (application permissions) to list all users.
 */
export async function syncOrgUsers(graphClient: Client): Promise<number> {
  const scanConfig = await prisma.m365ScanConfig.findUnique({
    where: { id: "default" },
  });
  const excludedMailboxes: string[] = scanConfig
    ? JSON.parse(scanConfig.excludedMailboxes)
    : [];

  let synced = 0;
  let nextLink: string | null = null;
  let url = "/users?$filter=accountEnabled eq true and mail ne null&$select=id,displayName,mail,userPrincipalName&$top=100";

  do {
    const response = await graphClient.api(nextLink || url).get();

    for (const user of response.value || []) {
      const upn = (user.userPrincipalName || "").toLowerCase();
      const mail = (user.mail || "").toLowerCase();

      // Skip excluded mailboxes
      if (
        excludedMailboxes.some(
          (ex: string) =>
            ex.toLowerCase() === upn || ex.toLowerCase() === mail
        )
      ) {
        continue;
      }

      await prisma.m365UserMailbox.upsert({
        where: { userPrincipalName: upn },
        update: {
          displayName: user.displayName || upn,
          mail: user.mail,
        },
        create: {
          userPrincipalName: upn,
          displayName: user.displayName || upn,
          mail: user.mail,
          isActive: true,
        },
      });
      synced++;
    }

    nextLink = response["@odata.nextLink"] || null;
  } while (nextLink);

  // Update last sync time
  await prisma.m365ScanConfig.upsert({
    where: { id: "default" },
    update: { lastUserSyncAt: new Date() },
    create: {
      id: "default",
      scanAllMailboxes: true,
      excludedMailboxes: "[]",
      scanSharePoint: false,
      lastUserSyncAt: new Date(),
    },
  });

  return synced;
}

/**
 * Poll a single user's mailbox using delta queries.
 */
export async function pollUserMailbox(
  graphClient: Client,
  userPrincipalName: string,
  deltaLink: string | null
): Promise<{ messages: RawMessage[]; newDeltaLink: string | null }> {
  const messages: RawMessage[] = [];
  let newDeltaLink: string | null = null;

  try {
    let url: string;
    if (deltaLink) {
      url = deltaLink;
    } else {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      url = `/users/${userPrincipalName}/mailFolders/inbox/messages/delta?$filter=receivedDateTime ge ${since}&$select=id,subject,from,bodyPreview,body,receivedDateTime&$top=25`;
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

    newDeltaLink =
      response["@odata.deltaLink"] || response["@odata.nextLink"] || null;
  } catch (error) {
    console.error(
      `[Org Mail Scanner] Error polling ${userPrincipalName}:`,
      error
    );
    // If delta link is stale, return null so it resets on next poll
    if (deltaLink) {
      newDeltaLink = null;
    }
  }

  return { messages, newDeltaLink };
}

/**
 * Poll ALL active mailboxes in the org.
 * Iterates M365UserMailbox records and polls each one.
 */
export async function pollAllMailboxes(
  graphClient: Client
): Promise<RawMessage[]> {
  const mailboxes = await prisma.m365UserMailbox.findMany({
    where: { isActive: true },
  });

  const allMessages: RawMessage[] = [];

  for (const mailbox of mailboxes) {
    const { messages, newDeltaLink } = await pollUserMailbox(
      graphClient,
      mailbox.userPrincipalName,
      mailbox.deltaLink
    );

    // Update delta link and poll time
    await prisma.m365UserMailbox.update({
      where: { id: mailbox.id },
      data: {
        deltaLink: newDeltaLink,
        lastPolledAt: new Date(),
      },
    });

    allMessages.push(...messages);
  }

  return allMessages;
}
