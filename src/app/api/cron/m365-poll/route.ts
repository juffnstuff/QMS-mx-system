import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runUserScan } from "@/lib/m365/scan-orchestrator";

export async function GET(req: NextRequest) {
  // Verify cron secret (supports x-cron-secret header or Authorization: Bearer)
  const cronSecret = req.headers.get("x-cron-secret") || req.headers.get("authorization")?.replace("Bearer ", "");
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find all users with active M365 connections
  const connections = await prisma.m365Connection.findMany({
    where: { isActive: true },
    select: { connectedBy: true },
  });

  // Deduplicate user IDs
  const userIds = [...new Set(connections.map((c) => c.connectedBy))];

  if (userIds.length === 0) {
    return NextResponse.json({ message: "No active M365 connections" });
  }

  const results: Record<string, unknown> = {};
  for (const userId of userIds) {
    try {
      results[userId] = await runUserScan(userId);
    } catch (error) {
      console.error(`[Cron] Scan failed for user ${userId}:`, error);
      results[userId] = { error: error instanceof Error ? error.message : String(error) };
    }
  }

  return NextResponse.json({ success: true, usersScanned: userIds.length, results });
}
