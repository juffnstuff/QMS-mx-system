import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const status = req.nextUrl.searchParams.get("status"); // pending, approved, rejected, auto_applied
  const page = parseInt(req.nextUrl.searchParams.get("page") || "1");
  const limit = 20;

  const where = status ? { status } : {};

  const [suggestions, total] = await Promise.all([
    prisma.aISuggestion.findMany({
      where,
      include: {
        processedMessage: true,
        reviewer: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.aISuggestion.count({ where }),
  ]);

  return NextResponse.json({
    suggestions,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}
