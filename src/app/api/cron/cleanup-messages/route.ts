import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Retention windows in days. Tune via env without a redeploy.
const DEFAULTS = {
  pre_filtered: 14,
  ignored: 60,
  rejected_suggestion: 90,
};

function daysAgo(days: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

function readWindow(envName: string, fallback: number): number {
  const raw = process.env[envName];
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export async function GET(req: NextRequest) {
  const cronSecret = req.headers.get("x-cron-secret");
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const preFilteredDays = readWindow("MESSAGE_RETENTION_PRE_FILTERED_DAYS", DEFAULTS.pre_filtered);
  const ignoredDays = readWindow("MESSAGE_RETENTION_IGNORED_DAYS", DEFAULTS.ignored);
  const rejectedDays = readWindow("MESSAGE_RETENTION_REJECTED_DAYS", DEFAULTS.rejected_suggestion);

  // ProcessedMessage cascades to AISuggestion + MessageAttachment on delete.
  const preFilteredDeleted = await prisma.processedMessage.deleteMany({
    where: {
      actionTaken: "pre_filtered",
      processedAt: { lt: daysAgo(preFilteredDays) },
    },
  });

  const ignoredDeleted = await prisma.processedMessage.deleteMany({
    where: {
      actionTaken: "ignored",
      processedAt: { lt: daysAgo(ignoredDays) },
    },
  });

  // Rejected suggestions older than N days — keep parent ProcessedMessage
  // so its activity row still shows "rejected" context if the user scrolls.
  // Fall back to createdAt when reviewedAt is null (shouldn't happen for rejected,
  // but protects against legacy data).
  const rejectedCutoff = daysAgo(rejectedDays);
  const rejectedDeleted = await prisma.aISuggestion.deleteMany({
    where: {
      status: "rejected",
      OR: [
        { reviewedAt: { lt: rejectedCutoff } },
        { AND: [{ reviewedAt: null }, { createdAt: { lt: rejectedCutoff } }] },
      ],
    },
  });

  const result = {
    success: true,
    windows: {
      preFilteredDays,
      ignoredDays,
      rejectedDays,
    },
    deleted: {
      preFilteredMessages: preFilteredDeleted.count,
      ignoredMessages: ignoredDeleted.count,
      rejectedSuggestions: rejectedDeleted.count,
    },
  };

  console.log("[Cron] cleanup-messages:", JSON.stringify(result));
  return NextResponse.json(result);
}
