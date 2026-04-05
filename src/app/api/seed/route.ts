import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET(req: Request) {
  // Simple secret check to prevent unauthorized seeding
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  if (key !== "rubberform-setup-2026") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const adminPassword = await bcrypt.hash("admin123", 10);
    const operatorPassword = await bcrypt.hash("operator123", 10);

    const admin = await prisma.user.upsert({
      where: { email: "admin@rubberform.com" },
      update: {},
      create: {
        email: "admin@rubberform.com",
        name: "Plant Manager",
        passwordHash: adminPassword,
        role: "admin",
      },
    });

    const operator1 = await prisma.user.upsert({
      where: { email: "mike@rubberform.com" },
      update: {},
      create: {
        email: "mike@rubberform.com",
        name: "Mike Johnson",
        passwordHash: operatorPassword,
        role: "operator",
      },
    });

    const operator2 = await prisma.user.upsert({
      where: { email: "sarah@rubberform.com" },
      update: {},
      create: {
        email: "sarah@rubberform.com",
        name: "Sarah Martinez",
        passwordHash: operatorPassword,
        role: "operator",
      },
    });

    const now = new Date();
    const pastDate = (days: number) => new Date(now.getTime() - days * 86400000);
    const futureDate = (days: number) => new Date(now.getTime() + days * 86400000);

    const granulator = await prisma.equipment.upsert({
      where: { serialNumber: "GRN-2019-001" },
      update: {},
      create: {
        name: "Granulator #1",
        type: "Granulator",
        location: "Plant Floor - Bay 1",
        serialNumber: "GRN-2019-001",
        status: "operational",
        notes: "Primary granulator for tire rubber processing",
      },
    });

    const mixer = await prisma.equipment.upsert({
      where: { serialNumber: "MIX-2020-002" },
      update: {},
      create: {
        name: "Banbury Mixer",
        type: "Mixer",
        location: "Plant Floor - Bay 2",
        serialNumber: "MIX-2020-002",
        status: "needs_service",
        notes: "Internal mixer for rubber compound blending",
      },
    });

    const press1 = await prisma.equipment.upsert({
      where: { serialNumber: "PRS-2018-003" },
      update: {},
      create: {
        name: "Hydraulic Press #1",
        type: "Press",
        location: "Plant Floor - Bay 3",
        serialNumber: "PRS-2018-003",
        status: "operational",
      },
    });

    const press2 = await prisma.equipment.upsert({
      where: { serialNumber: "PRS-2021-004" },
      update: {},
      create: {
        name: "Hydraulic Press #2",
        type: "Press",
        location: "Plant Floor - Bay 3",
        serialNumber: "PRS-2021-004",
        status: "down",
        notes: "Hydraulic cylinder leak - awaiting parts",
      },
    });

    const conveyor = await prisma.equipment.upsert({
      where: { serialNumber: "CNV-2022-005" },
      update: {},
      create: {
        name: "Belt Conveyor System",
        type: "Conveyor",
        location: "Plant Floor - Main Line",
        serialNumber: "CNV-2022-005",
        status: "operational",
      },
    });

    const forklift = await prisma.equipment.upsert({
      where: { serialNumber: "FLT-2023-006" },
      update: {},
      create: {
        name: "Forklift - Toyota 8FGU25",
        type: "Forklift",
        location: "Warehouse",
        serialNumber: "FLT-2023-006",
        status: "operational",
      },
    });

    // Clean existing related data
    await prisma.maintenanceSchedule.deleteMany();
    await prisma.maintenanceLog.deleteMany();
    await prisma.workOrder.deleteMany();

    await prisma.maintenanceSchedule.createMany({
      data: [
        { equipmentId: granulator.id, title: "Blade inspection and sharpening", frequency: "weekly", nextDue: futureDate(3), lastDone: pastDate(4) },
        { equipmentId: granulator.id, title: "Full bearing replacement check", frequency: "annual", nextDue: futureDate(60), lastDone: pastDate(305) },
        { equipmentId: mixer.id, title: "Rotor seal inspection", frequency: "monthly", nextDue: pastDate(5), lastDone: pastDate(35) },
        { equipmentId: press1.id, title: "Hydraulic fluid level check", frequency: "weekly", nextDue: futureDate(2), lastDone: pastDate(5) },
        { equipmentId: press1.id, title: "Platen alignment verification", frequency: "quarterly", nextDue: futureDate(45), lastDone: pastDate(45) },
        { equipmentId: conveyor.id, title: "Belt tension and tracking adjustment", frequency: "monthly", nextDue: futureDate(12), lastDone: pastDate(18) },
        { equipmentId: forklift.id, title: "Daily safety inspection", frequency: "daily", nextDue: futureDate(1), lastDone: now },
      ],
    });

    await prisma.maintenanceLog.createMany({
      data: [
        { equipmentId: granulator.id, userId: operator1.id, description: "Replaced dulled granulator blades. Set #4 installed.", partsUsed: "Blade set #4 (6x cutting blades)", performedAt: pastDate(4) },
        { equipmentId: press1.id, userId: operator1.id, description: "Topped off hydraulic fluid. Level was slightly low.", partsUsed: "2 gallons AW-46 hydraulic fluid", performedAt: pastDate(5) },
        { equipmentId: conveyor.id, userId: operator2.id, description: "Adjusted belt tracking. Replaced worn idler roller on return side.", partsUsed: "1x idler roller", performedAt: pastDate(18) },
        { equipmentId: forklift.id, userId: operator2.id, description: "Daily pre-shift inspection completed. All systems normal.", performedAt: now },
        { equipmentId: mixer.id, userId: operator1.id, description: "Noticed minor seal wear on rotor. Scheduled for follow-up service.", performedAt: pastDate(10) },
      ],
    });

    await prisma.workOrder.createMany({
      data: [
        { equipmentId: press2.id, assignedToId: operator1.id, createdById: admin.id, title: "Replace hydraulic cylinder seals", description: "Press #2 has a hydraulic cylinder leak.", priority: "critical", status: "open", dueDate: futureDate(3) },
        { equipmentId: mixer.id, assignedToId: operator2.id, createdById: admin.id, title: "Rotor seal replacement", description: "Replace worn rotor seals identified during last inspection.", priority: "high", status: "in_progress", dueDate: futureDate(7) },
        { equipmentId: granulator.id, assignedToId: operator1.id, createdById: admin.id, title: "Install vibration monitoring sensor", description: "Install new vibration sensor on main bearing housing.", priority: "medium", status: "open", dueDate: futureDate(14) },
        { equipmentId: conveyor.id, createdById: admin.id, title: "Replace drive belt", description: "Drive belt showing signs of cracking.", priority: "low", status: "open", dueDate: futureDate(30) },
      ],
    });

    return NextResponse.json({
      success: true,
      message: "Database seeded! You can now login.",
      credentials: {
        admin: "admin@rubberform.com / admin123",
        operator1: "mike@rubberform.com / operator123",
        operator2: "sarah@rubberform.com / operator123",
      },
    });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { error: "Seed failed", details: String(error) },
      { status: 500 }
    );
  }
}
