import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const config = await prisma.m365ScanConfig.findUnique({
    where: { id: "default" },
  });

  const mailboxCount = await prisma.m365UserMailbox.count({ where: { isActive: true } });
  const totalMailboxes = await prisma.m365UserMailbox.count();
  const sharePointSites = await prisma.m365SharePointSite.count({ where: { isActive: true } });

  return NextResponse.json({
    config: config || {
      scanAllMailboxes: true,
      excludedMailboxes: "[]",
      scanSharePoint: false,
      lastUserSyncAt: null,
    },
    stats: { activeMailboxes: mailboxCount, totalMailboxes, sharePointSites },
  });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await req.json();
  const { scanAllMailboxes, excludedMailboxes, scanSharePoint } = body;

  const config = await prisma.m365ScanConfig.upsert({
    where: { id: "default" },
    update: {
      ...(scanAllMailboxes !== undefined && { scanAllMailboxes }),
      ...(excludedMailboxes !== undefined && {
        excludedMailboxes: JSON.stringify(excludedMailboxes),
      }),
      ...(scanSharePoint !== undefined && { scanSharePoint }),
    },
    create: {
      id: "default",
      scanAllMailboxes: scanAllMailboxes ?? true,
      excludedMailboxes: excludedMailboxes ? JSON.stringify(excludedMailboxes) : "[]",
      scanSharePoint: scanSharePoint ?? false,
    },
  });

  return NextResponse.json(config);
}
