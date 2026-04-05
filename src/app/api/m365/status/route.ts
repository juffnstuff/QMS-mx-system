import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const connection = await prisma.m365Connection.findFirst({
    where: { isActive: true },
    include: { connectedByUser: { select: { name: true } } },
  });

  const monitors = await prisma.m365MonitorConfig.findMany({
    orderBy: { createdAt: "desc" },
  });

  const recentMessages = await prisma.processedMessage.count({
    where: { processedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });

  const pendingSuggestions = await prisma.aISuggestion.count({
    where: { status: "pending" },
  });

  return NextResponse.json({
    connected: !!connection,
    connection: connection
      ? {
          connectedBy: connection.connectedByUser.name,
          connectedAt: connection.createdAt,
          tokenExpiresAt: connection.tokenExpiresAt,
        }
      : null,
    monitors,
    stats: {
      messagesLast24h: recentMessages,
      pendingSuggestions,
    },
  });
}
