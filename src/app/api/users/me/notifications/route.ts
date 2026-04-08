import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
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
}

export async function PUT(req: NextRequest) {
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
}
