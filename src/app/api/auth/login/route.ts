import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  const rateCheck = checkRateLimit(ip);
  if (!rateCheck.allowed) {
    const retryMinutes = Math.ceil((rateCheck.retryAfterMs || 0) / 60000);
    return NextResponse.json(
      { error: `Too many login attempts. Try again in ${retryMinutes} minutes.` },
      { status: 429 }
    );
  }

  const body = await req.json();
  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    // Don't reveal whether email exists
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  // Successful auth — reset rate limit for this IP
  resetRateLimit(ip);

  return NextResponse.json({ success: true });
}
