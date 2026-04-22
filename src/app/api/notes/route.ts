import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isValidRecordType } from "@/lib/attachments";

// GET /api/notes?recordType=&recordId= — list notes for a record (newest first).
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const recordType = req.nextUrl.searchParams.get("recordType");
  const recordId = req.nextUrl.searchParams.get("recordId");
  if (!recordType || !recordId) {
    return NextResponse.json(
      { error: "recordType and recordId are required" },
      { status: 400 },
    );
  }
  if (!isValidRecordType(recordType)) {
    return NextResponse.json({ error: "Invalid recordType" }, { status: 400 });
  }

  const notes = await prisma.note.findMany({
    where: { recordType, recordId },
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { id: true, name: true } } },
  });
  return NextResponse.json(notes);
}

// POST /api/notes — create a note. Any authenticated user.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { recordType, recordId, body: noteBody } = body ?? {};

  if (typeof recordType !== "string" || typeof recordId !== "string") {
    return NextResponse.json(
      { error: "recordType and recordId are required" },
      { status: 400 },
    );
  }
  if (!isValidRecordType(recordType)) {
    return NextResponse.json({ error: "Invalid recordType" }, { status: 400 });
  }
  if (typeof noteBody !== "string" || !noteBody.trim()) {
    return NextResponse.json({ error: "Note body is required" }, { status: 400 });
  }

  const note = await prisma.note.create({
    data: {
      recordType,
      recordId,
      body: noteBody.trim(),
      createdById: session.user.id,
    },
    include: { createdBy: { select: { id: true, name: true } } },
  });
  return NextResponse.json(note, { status: 201 });
}
