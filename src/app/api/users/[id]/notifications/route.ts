import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Admin (or the user themselves) may update notification preferences for the
// target user. Separate from /api/users/me/notifications, which only ever
// edits the current user's own prefs.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const isSelf = id === session.user.id;
  const isAdmin = session.user.role === "admin";
  if (!isSelf && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { phone, carrier, notifyEmail, notifySMS } = body;

  try {
    const user = await prisma.user.update({
      where: { id },
      data: {
        phone: phone === undefined ? undefined : (phone || null),
        carrier: carrier === undefined ? undefined : (carrier || null),
        notifyEmail: notifyEmail === undefined ? undefined : !!notifyEmail,
        notifySMS: notifySMS === undefined ? undefined : !!notifySMS,
      },
      select: {
        id: true,
        phone: true,
        carrier: true,
        notifyEmail: true,
        notifySMS: true,
      },
    });
    return NextResponse.json(user);
  } catch (err) {
    console.error("[User notifications PUT]", err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
