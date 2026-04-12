import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET(req: NextRequest) {
  // Protect with CRON_SECRET
  const secret = req.headers.get("x-cron-secret") || req.nextUrl.searchParams.get("key");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const adminPassword = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD || "changeme", 12);
    const operatorPassword = await bcrypt.hash(process.env.SEED_OPERATOR_PASSWORD || "changeme", 12);

    // Reset admin password and ensure account exists
    const admin = await prisma.user.upsert({
      where: { email: "admin@rubberform.com" },
      update: { passwordHash: adminPassword, role: "admin" },
      create: {
        email: "admin@rubberform.com",
        name: "Plant Manager",
        passwordHash: adminPassword,
        role: "admin",
      },
    });

    // Ensure Anthony exists
    await prisma.user.upsert({
      where: { email: "anthony@rubberform.com" },
      update: { passwordHash: operatorPassword },
      create: {
        email: "anthony@rubberform.com",
        name: "Anthony",
        passwordHash: operatorPassword,
        role: "operator",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Passwords reset. Admin: admin@rubberform.com, Operator: anthony@rubberform.com",
    });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json({ error: "Seed failed" }, { status: 500 });
  }
}
