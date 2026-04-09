import { ConfidentialClientApplication } from "@azure/msal-node";
import { Client } from "@microsoft/microsoft-graph-client";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "./encryption";

function getMsalClient() {
  return new ConfidentialClientApplication({
    auth: {
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      authority: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}`,
    },
  });
}

export async function getActiveConnection() {
  return prisma.m365Connection.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Get the active M365 connection for a specific user.
 */
export async function getUserConnection(userId: string) {
  return prisma.m365Connection.findFirst({
    where: { connectedBy: userId, isActive: true },
    orderBy: { createdAt: "desc" },
  });
}

async function refreshTokenIfNeeded(connectionId: string): Promise<string> {
  const connection = await prisma.m365Connection.findUniqueOrThrow({
    where: { id: connectionId },
  });

  // If token is still valid (more than 5 minutes remaining), use it
  const fiveMinFromNow = new Date(Date.now() + 5 * 60 * 1000);
  if (connection.tokenExpiresAt > fiveMinFromNow) {
    return decrypt(connection.accessTokenEnc);
  }

  // Refresh the token
  const msalClient = getMsalClient();
  const refreshToken = decrypt(connection.refreshTokenEnc);

  const result = await msalClient.acquireTokenByRefreshToken({
    refreshToken,
    scopes: connection.scopes.split(","),
  });

  if (!result) throw new Error("Token refresh failed");

  // Extract new refresh token from MSAL cache (Azure rotates refresh tokens)
  const serializedCache = msalClient.getTokenCache().serialize();
  const cacheData = JSON.parse(serializedCache);
  let newRefreshToken = "";
  if (cacheData.RefreshToken) {
    const entries = Object.values(cacheData.RefreshToken) as Array<{ secret?: string }>;
    if (entries.length > 0 && entries[0].secret) {
      newRefreshToken = entries[0].secret;
    }
  }

  // Update stored tokens (including rotated refresh token)
  const updateData: { accessTokenEnc: string; tokenExpiresAt: Date; refreshTokenEnc?: string } = {
    accessTokenEnc: encrypt(result.accessToken),
    tokenExpiresAt: result.expiresOn || new Date(Date.now() + 3600 * 1000),
  };
  if (newRefreshToken) {
    updateData.refreshTokenEnc = encrypt(newRefreshToken);
  }

  await prisma.m365Connection.update({
    where: { id: connectionId },
    data: updateData,
  });

  return result.accessToken;
}

export async function getGraphClient(connectionId: string): Promise<Client> {
  const accessToken = await refreshTokenIfNeeded(connectionId);

  return Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
}

/**
 * Get an app-level Graph client using client credentials flow.
 * Used for SharePoint access which requires application permissions.
 */
export async function getAppGraphClient(): Promise<Client> {
  const msalClient = getMsalClient();

  const result = await msalClient.acquireTokenByClientCredential({
    scopes: ["https://graph.microsoft.com/.default"],
  });

  if (!result) throw new Error("Client credential token acquisition failed");

  return Client.init({
    authProvider: (done) => {
      done(null, result.accessToken);
    },
  });
}

/**
 * Send an email via Microsoft Graph sendMail API.
 * Requires Mail.Send permission in the M365 connection.
 */
export async function sendEmail(
  connectionId: string,
  to: string,
  subject: string,
  htmlBody: string
) {
  const client = await getGraphClient(connectionId);
  await client.api("/me/sendMail").post({
    message: {
      subject,
      body: { contentType: "HTML", content: htmlBody },
      toRecipients: [{ emailAddress: { address: to } }],
    },
    saveToSentItems: false,
  });
}

export { getMsalClient };
