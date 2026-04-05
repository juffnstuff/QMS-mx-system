import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getMsalClient } from "@/lib/m365/graph-client";
import { encrypt } from "@/lib/m365/encryption";
import { prisma } from "@/lib/prisma";

const SCOPES = [
  "Mail.Read",
  "ChannelMessage.Read.All",
  "Team.ReadBasic.All",
  "Channel.ReadBasic.All",
  "User.Read",
  "offline_access",
];

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error) {
    console.error("[M365 Callback] OAuth error:", error);
    return NextResponse.redirect(
      new URL("/settings/m365?error=oauth_denied", req.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/settings/m365?error=no_code", req.url)
    );
  }

  try {
    const msalClient = getMsalClient();
    const redirectUri = `${process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL}/api/m365/callback`;

    const result = await msalClient.acquireTokenByCode({
      code,
      scopes: SCOPES,
      redirectUri,
    });

    // Deactivate any existing connections
    await prisma.m365Connection.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    // Store new connection with encrypted tokens
    await prisma.m365Connection.create({
      data: {
        tenantId: process.env.AZURE_AD_TENANT_ID!,
        clientId: process.env.AZURE_AD_CLIENT_ID!,
        accessTokenEnc: encrypt(result.accessToken),
        refreshTokenEnc: encrypt(
          (result as unknown as { refreshToken?: string }).refreshToken || ""
        ),
        tokenExpiresAt: result.expiresOn || new Date(Date.now() + 3600 * 1000),
        scopes: SCOPES.join(","),
        connectedBy: session.user.id!,
      },
    });

    return NextResponse.redirect(
      new URL("/settings/m365?success=connected", req.url)
    );
  } catch (err) {
    console.error("[M365 Callback] Token exchange error:", err);
    return NextResponse.redirect(
      new URL("/settings/m365?error=token_exchange", req.url)
    );
  }
}
