import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/equipment/migrate-criticality
 * Scans equipment notes for criticality annotations and updates the criticality field.
 * Only updates equipment that currently has the default "C" criticality.
 *
 * Patterns matched:
 *   "Criticality A", "Criticality B", "Criticality C"
 *   "Class A", "Class B", "Class C"
 */
export async function POST() {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Find all equipment with notes that might contain criticality info
  const equipment = await prisma.equipment.findMany({
    where: { notes: { not: null } },
    select: { id: true, name: true, notes: true, criticality: true },
  });

  const updates: { id: string; name: string; from: string; to: string; match: string }[] = [];
  const skipped: { id: string; name: string; reason: string }[] = [];

  for (const item of equipment) {
    if (!item.notes) continue;

    const notes = item.notes;

    // Try to parse criticality from notes
    let parsedCriticality: string | null = null;
    let matchText = "";

    // Match patterns like "Criticality A", "Criticality B", "Criticality C"
    const critMatch = notes.match(/Criticality\s+([ABC])/i);
    if (critMatch) {
      parsedCriticality = critMatch[1].toUpperCase();
      matchText = critMatch[0];
    }

    // Match patterns like "Class A", "Class B", "Class C"
    if (!parsedCriticality) {
      const classMatch = notes.match(/Class\s+([ABC])\b/i);
      if (classMatch) {
        parsedCriticality = classMatch[1].toUpperCase();
        matchText = classMatch[0];
      }
    }

    if (!parsedCriticality) continue;

    // Only update if current criticality differs from parsed
    if (item.criticality === parsedCriticality) {
      skipped.push({ id: item.id, name: item.name, reason: `Already ${parsedCriticality}` });
      continue;
    }

    // Perform the update
    await prisma.equipment.update({
      where: { id: item.id },
      data: { criticality: parsedCriticality },
    });

    updates.push({
      id: item.id,
      name: item.name,
      from: item.criticality,
      to: parsedCriticality,
      match: matchText,
    });
  }

  return NextResponse.json({
    success: true,
    updated: updates.length,
    skipped: skipped.length,
    details: updates,
    skippedDetails: skipped,
  });
}
