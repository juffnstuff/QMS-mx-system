import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const monitors = await prisma.m365MonitorConfig.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(monitors);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await req.json();
  const { sourceType, sourceId, displayName } = body;

  if (!sourceType || !sourceId || !displayName) {
    return NextResponse.json(
      { error: "sourceType, sourceId, and displayName are required" },
      { status: 400 }
    );
  }

  if (!["mailbox", "teams_channel"].includes(sourceType)) {
    return NextResponse.json(
      { error: "sourceType must be 'mailbox' or 'teams_channel'" },
      { status: 400 }
    );
  }

  const monitor = await prisma.m365MonitorConfig.create({
    data: { sourceType, sourceId, displayName },
  });

  return NextResponse.json(monitor, { status: 201 });
}
