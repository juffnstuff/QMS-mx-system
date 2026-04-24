import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  const data: { excluded?: boolean; userEditedText?: string | null } = {};
  if (typeof body.excluded === "boolean") data.excluded = body.excluded;
  if (typeof body.userEditedText === "string") {
    data.userEditedText = body.userEditedText;
  } else if (body.userEditedText === null) {
    data.userEditedText = null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No changes provided" }, { status: 400 });
  }

  try {
    const updated = await prisma.messageAttachment.update({
      where: { id },
      data,
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("[Attachment PUT]", err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
