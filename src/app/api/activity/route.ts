import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const recentMessages = await prisma.processedMessage.findMany({
    include: {
      suggestions: {
        include: { reviewer: { select: { name: true } } },
      },
    },
    orderBy: { processedAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ activity: recentMessages });
}
