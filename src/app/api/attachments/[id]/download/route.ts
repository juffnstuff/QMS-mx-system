import { NextRequest, NextResponse } from "next/server";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveStoragePath } from "@/lib/attachments";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const attachment = await prisma.attachment.findUnique({ where: { id } });
  if (!attachment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const fullPath = resolveStoragePath(attachment.storageKey);
  try {
    await stat(fullPath);
  } catch {
    return NextResponse.json({ error: "File missing on disk" }, { status: 410 });
  }

  const disposition = req.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline";
  const encodedFilename = encodeURIComponent(attachment.filename);

  const nodeStream = createReadStream(fullPath);
  const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;

  return new NextResponse(webStream, {
    status: 200,
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Length": String(attachment.sizeBytes),
      "Content-Disposition": `${disposition}; filename*=UTF-8''${encodedFilename}`,
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
