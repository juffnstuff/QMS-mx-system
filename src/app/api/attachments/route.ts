import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  buildStorageKey,
  isValidRecordType,
  sanitizeFilename,
  writeAttachmentFile,
} from "@/lib/attachments";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const recordType = req.nextUrl.searchParams.get("recordType");
  const recordId = req.nextUrl.searchParams.get("recordId");
  if (!recordType || !recordId) {
    return NextResponse.json({ error: "recordType and recordId are required" }, { status: 400 });
  }
  if (!isValidRecordType(recordType)) {
    return NextResponse.json({ error: "Invalid recordType" }, { status: 400 });
  }

  const attachments = await prisma.attachment.findMany({
    where: { recordType, recordId },
    orderBy: { createdAt: "desc" },
    include: { uploadedBy: { select: { id: true, name: true } } },
  });

  return NextResponse.json(attachments);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const recordType = form.get("recordType");
  const recordId = form.get("recordId");
  const caption = form.get("caption");
  const files = form.getAll("files").filter((f): f is File => f instanceof File);

  if (typeof recordType !== "string" || typeof recordId !== "string") {
    return NextResponse.json({ error: "recordType and recordId are required" }, { status: 400 });
  }
  if (!isValidRecordType(recordType)) {
    return NextResponse.json({ error: "Invalid recordType" }, { status: 400 });
  }
  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  const created = [];
  for (const file of files) {
    if (file.size === 0) continue;
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File "${file.name}" exceeds 25 MB limit` },
        { status: 400 }
      );
    }
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: `File type "${file.type || "unknown"}" is not allowed` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = sanitizeFilename(file.name);

    const attachment = await prisma.attachment.create({
      data: {
        recordType,
        recordId,
        filename,
        mimeType: file.type,
        sizeBytes: file.size,
        storageKey: "pending",
        caption: typeof caption === "string" && caption ? caption : null,
        uploadedById: session.user.id,
      },
    });

    const storageKey = buildStorageKey(attachment.id, filename);
    try {
      await writeAttachmentFile(storageKey, buffer);
    } catch (err) {
      await prisma.attachment.delete({ where: { id: attachment.id } }).catch(() => {});
      console.error("Failed to write attachment file:", err);
      return NextResponse.json({ error: "Failed to save file" }, { status: 500 });
    }

    const updated = await prisma.attachment.update({
      where: { id: attachment.id },
      data: { storageKey },
      include: { uploadedBy: { select: { id: true, name: true } } },
    });
    created.push(updated);
  }

  return NextResponse.json(created, { status: 201 });
}
