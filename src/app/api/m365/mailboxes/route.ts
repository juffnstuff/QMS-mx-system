import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const mailboxes = await prisma.m365UserMailbox.findMany({
    orderBy: { displayName: "asc" },
  });

  return NextResponse.json({ mailboxes });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await req.json();
  const { id, isActive } = body;

  if (!id || typeof isActive !== "boolean") {
    return NextResponse.json({ error: "id and isActive required" }, { status: 400 });
  }

  const mailbox = await prisma.m365UserMailbox.update({
    where: { id },
    data: { isActive },
  });

  return NextResponse.json(mailbox);
}
