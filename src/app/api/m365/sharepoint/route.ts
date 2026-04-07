import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAppGraphClient } from "@/lib/m365/graph-client";
import { syncSharePointSites, scanAllSharePointSites } from "@/lib/m365/sharepoint-scanner";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const sites = await prisma.m365SharePointSite.findMany({
    orderBy: { siteName: "asc" },
  });

  const recentDocs = await prisma.sharePointDocument.findMany({
    orderBy: { processedAt: "desc" },
    take: 20,
  });

  return NextResponse.json({ sites, recentDocs });
}

export async function POST() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const appClient = await getAppGraphClient();
    const sitesSynced = await syncSharePointSites(appClient);
    const docsScanned = await scanAllSharePointSites(appClient);

    return NextResponse.json({
      success: true,
      sitesSynced,
      docsScanned,
    });
  } catch (error) {
    console.error("[SharePoint API] Scan failed:", error);
    return NextResponse.json(
      { error: "SharePoint scan failed", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
