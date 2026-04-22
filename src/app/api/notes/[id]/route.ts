import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/notes/[id] — edit note body. Allowed for author or admin.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const note = await prisma.note.findUnique({ where: { id } });
  if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin = session.user.role === "admin";
  const isAuthor = note.createdById === session.user.id;
  if (!isAdmin && !isAuthor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const newBody = typeof body.body === "string" ? body.body.trim() : "";
  if (!newBody) {
    return NextResponse.json({ error: "Note body is required" }, { status: 400 });
  }

  const updated = await prisma.note.update({
    where: { id },
    data: { body: newBody },
    include: { createdBy: { select: { id: true, name: true } } },
  });
  return NextResponse.json(updated);
}

// DELETE /api/notes/[id] — delete note. Allowed for author or admin.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const note = await prisma.note.findUnique({ where: { id } });
  if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin = session.user.role === "admin";
  const isAuthor = note.createdById === session.user.id;
  if (!isAdmin && !isAuthor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.note.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
