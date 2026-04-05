import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getMsalClient } from "@/lib/m365/graph-client";

const SCOPES = [
  "Mail.Read",
  "ChannelMessage.Read.All",
  "Team.ReadBasic.All",
  "Channel.ReadBasic.All",
  "User.Read",
  "offline_access",
];

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const msalClient = getMsalClient();
  const redirectUri = `${process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL}/api/m365/callback`;

  const authUrl = await msalClient.getAuthCodeUrl({
    scopes: SCOPES,
    redirectUri,
    responseMode: "query",
    prompt: "consent",
  });

  return NextResponse.redirect(authUrl);
}
