import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getMsalClient } from "@/lib/m365/graph-client";
import { encrypt } from "@/lib/m365/encryption";
import { prisma } from "@/lib/prisma";
import { publicUrl } from "@/lib/url";

const SCOPES = [
  "Mail.Read",
  "Mail.Send",
  "User.Read",
  "Team.ReadBasic.All",
  "ChannelMessage.Read.All",
  "Sites.Read.All",
  "Files.Read.All",
  "offline_access",
];

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(publicUrl("/login"));
  }

  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");
  const errorDescription = req.nextUrl.searchParams.get("error_description");

  if (error) {
    console.error("[M365 Callback] OAuth error:", error, errorDescription);
    return NextResponse.redirect(
      publicUrl(`/settings/m365?error=${encodeURIComponent(error + ": " + (errorDescription || "Unknown error"))}`)
    );
  }

  if (!code) {
    return NextResponse.redirect(publicUrl("/settings/m365?error=no_code"));
  }

  try {
    const msalClient = getMsalClient();
    const redirectUri = publicUrl("/api/m365/callback");

    const result = await msalClient.acquireTokenByCode({
      code,
      scopes: SCOPES,
      redirectUri,
    });

    // Deactivate any existing connections FOR THIS USER
    await prisma.m365Connection.updateMany({
      where: { connectedBy: session.user.id!, isActive: true },
      data: { isActive: false },
    });

    // Extract refresh token from MSAL's internal token cache
    // MSAL v5 stores tokens internally; they're not on the AuthenticationResult
    const serializedCache = msalClient.getTokenCache().serialize();
    const cacheData = JSON.parse(serializedCache);
    let refreshToken = "";
    if (cacheData.RefreshToken) {
      const entries = Object.values(cacheData.RefreshToken) as Array<{ secret?: string }>;
      if (entries.length > 0 && entries[0].secret) {
        refreshToken = entries[0].secret;
      }
    }

    if (!refreshToken) {
      console.warn("[M365 Callback] No refresh token found in MSAL cache — offline_access may not have been granted");
    }

    // Store new connection with encrypted tokens for this user
    await prisma.m365Connection.create({
      data: {
        tenantId: process.env.AZURE_AD_TENANT_ID!,
        clientId: process.env.AZURE_AD_CLIENT_ID!,
        accessTokenEnc: encrypt(result.accessToken),
        refreshTokenEnc: encrypt(refreshToken),
        tokenExpiresAt: result.expiresOn || new Date(Date.now() + 3600 * 1000),
        scopes: SCOPES.join(","),
        connectedBy: session.user.id!,
      },
    });

    return NextResponse.redirect(publicUrl("/settings/m365?success=connected"));
  } catch (err) {
    console.error("[M365 Callback] Token exchange error:", err);
    return NextResponse.redirect(
      publicUrl(`/settings/m365?error=${encodeURIComponent("MS365 authentication failed")}`)
    );
  }
}
