import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getMsalClient } from "@/lib/m365/graph-client";

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

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Login required" }, { status: 401 });
    }

    // Check required env vars
    const missing = [];
    if (!process.env.AZURE_AD_CLIENT_ID) missing.push("AZURE_AD_CLIENT_ID");
    if (!process.env.AZURE_AD_CLIENT_SECRET) missing.push("AZURE_AD_CLIENT_SECRET");
    if (!process.env.AZURE_AD_TENANT_ID) missing.push("AZURE_AD_TENANT_ID");
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing environment variables: ${missing.join(", ")}. Add them in Railway.` },
        { status: 500 }
      );
    }

    const appUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
      return NextResponse.json(
        { error: "Missing NEXT_PUBLIC_APP_URL environment variable. Add it in Railway." },
        { status: 500 }
      );
    }

    const msalClient = getMsalClient();
    const redirectUri = `${appUrl}/api/m365/callback`;

    const authUrl = await msalClient.getAuthCodeUrl({
      scopes: SCOPES,
      redirectUri,
      responseMode: "query",
      prompt: "consent",
    });

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("[M365 Auth] Error:", error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "MS365 auth failed", details: errorMsg },
      { status: 500 }
    );
  }
}
