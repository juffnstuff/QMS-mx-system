import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        phone: true,
        carrier: true,
        notifyEmail: true,
        notifySMS: true,
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error("Failed to fetch preferences:", error);
    return NextResponse.json({ error: "Failed to fetch preferences" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { phone, carrier, notifyEmail, notifySMS } = body;

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        phone: phone || null,
        carrier: carrier || null,
        notifyEmail: notifyEmail ?? true,
        notifySMS: notifySMS ?? false,
      },
      select: {
        phone: true,
        carrier: true,
        notifyEmail: true,
        notifySMS: true,
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error("Failed to update preferences:", error);
    return NextResponse.json({ error: "Failed to update preferences" }, { status: 500 });
  }
}
