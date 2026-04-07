import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  // Get THIS user's connection
  const connection = await prisma.m365Connection.findFirst({
    where: { connectedBy: session.user.id!, isActive: true },
    include: { connectedByUser: { select: { name: true } } },
  });

  const recentMessages = await prisma.processedMessage.count({
    where: {
      scannedByUserId: session.user.id,
      processedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });

  const pendingSuggestions = await prisma.aISuggestion.count({
    where: {
      status: "pending",
      processedMessage: { scannedByUserId: session.user.id },
    },
  });

  return NextResponse.json({
    connected: !!connection,
    connection: connection
      ? {
          connectedBy: connection.connectedByUser.name,
          connectedAt: connection.createdAt,
          lastPolledAt: connection.lastPolledAt,
          tokenExpiresAt: connection.tokenExpiresAt,
        }
      : null,
    stats: {
      messagesLast24h: recentMessages,
      pendingSuggestions,
    },
  });
}
