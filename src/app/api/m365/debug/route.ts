import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  // Show which env vars are set (values masked for security)
  const envCheck = {
    AZURE_AD_CLIENT_ID: process.env.AZURE_AD_CLIENT_ID ? `set (${process.env.AZURE_AD_CLIENT_ID.slice(0, 8)}...)` : "NOT SET",
    AZURE_AD_CLIENT_SECRET: process.env.AZURE_AD_CLIENT_SECRET ? `set (${process.env.AZURE_AD_CLIENT_SECRET.length} chars)` : "NOT SET",
    AZURE_AD_TENANT_ID: process.env.AZURE_AD_TENANT_ID ? `set (${process.env.AZURE_AD_TENANT_ID.slice(0, 8)}...)` : "NOT SET",
    M365_ENCRYPTION_KEY: process.env.M365_ENCRYPTION_KEY ? `set (${process.env.M365_ENCRYPTION_KEY.length} chars)` : "NOT SET",
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? `set (${process.env.ANTHROPIC_API_KEY.length} chars)` : "NOT SET",
    CRON_SECRET: process.env.CRON_SECRET ? "set" : "NOT SET",
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || "NOT SET",
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || "NOT SET",
    NODE_ENV: process.env.NODE_ENV || "NOT SET",
  };

  return NextResponse.json(envCheck);
}
