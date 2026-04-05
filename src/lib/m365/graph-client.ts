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

  // Update stored tokens
  await prisma.m365Connection.update({
    where: { id: connectionId },
    data: {
      accessTokenEnc: encrypt(result.accessToken),
      tokenExpiresAt: result.expiresOn || new Date(Date.now() + 3600 * 1000),
      // MSAL may return a new refresh token
      ...(result.account ? {} : {}),
    },
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

export { getMsalClient };
