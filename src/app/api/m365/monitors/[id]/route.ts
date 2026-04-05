import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  const monitor = await prisma.m365MonitorConfig.update({
    where: { id },
    data: {
      ...(typeof body.isActive === "boolean" ? { isActive: body.isActive } : {}),
      ...(body.displayName ? { displayName: body.displayName } : {}),
    },
  });

  return NextResponse.json(monitor);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { id } = await params;
  await prisma.m365MonitorConfig.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
