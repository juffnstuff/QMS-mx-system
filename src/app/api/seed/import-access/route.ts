import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { accessNCRs } from "@/data/access-import/ncrs";

// ── Equipment enrichment: criticality + groupName by serialNumber ──────────

const equipmentEnrichments: Record<string, { criticality: string; groupName: string }> = {
  // Presses
  "RF-EQ-001": { criticality: "A", groupName: "Compression Molding" },
  "RF-EQ-002": { criticality: "A", groupName: "Compression Molding" },
  "RF-EQ-003": { criticality: "A", groupName: "Compression Molding" },
  "RF-EQ-004": { criticality: "A", groupName: "Compression Molding" },
  "RF-EQ-005": { criticality: "A", groupName: "Compression Molding" },
  "RF-EQ-046": { criticality: "A", groupName: "Compression Molding" },
  // Boilers
  "RF-EQ-006": { criticality: "A", groupName: "Utilities" },
  "RF-EQ-021": { criticality: "A", groupName: "Utilities" },
  // Furnace
  "RF-EQ-007": { criticality: "A", groupName: "Compression Molding" },
  // Forklifts
  "RF-EQ-008": { criticality: "B", groupName: "Material Handling" },
  "RF-EQ-009": { criticality: "B", groupName: "Material Handling" },
  "RF-EQ-010": { criticality: "B", groupName: "Material Handling" },
  "RF-EQ-011": { criticality: "B", groupName: "Material Handling" },
  "RF-EQ-012": { criticality: "B", groupName: "Material Handling" },
  // Compressors
  "RF-EQ-013": { criticality: "A", groupName: "Utilities" },
  "RF-EQ-014": { criticality: "A", groupName: "Utilities" },
  // HVAC / Heating
  "RF-EQ-015": { criticality: "B", groupName: "HVAC" },
  "RF-EQ-016": { criticality: "B", groupName: "HVAC" },
  "RF-EQ-017": { criticality: "B", groupName: "HVAC" },
  "RF-EQ-018": { criticality: "B", groupName: "HVAC" },
  "RF-EQ-019": { criticality: "B", groupName: "HVAC" },
  "RF-EQ-020": { criticality: "B", groupName: "HVAC" },
  "RF-EQ-022": { criticality: "C", groupName: "HVAC" },
  "RF-EQ-023": { criticality: "C", groupName: "HVAC" },
  "RF-EQ-024": { criticality: "C", groupName: "HVAC" },
  // Power Tools
  "RF-EQ-025": { criticality: "C", groupName: "Fabrication" },
  "RF-EQ-026": { criticality: "C", groupName: "Fabrication" },
  "RF-EQ-027": { criticality: "C", groupName: "Fabrication" },
  "RF-EQ-053": { criticality: "C", groupName: "Fabrication" },
  "RF-EQ-054": { criticality: "C", groupName: "Fabrication" },
  "RF-EQ-055": { criticality: "C", groupName: "Fabrication" },
  "RF-EQ-056": { criticality: "C", groupName: "Fabrication" },
  "RF-EQ-057": { criticality: "C", groupName: "Fabrication" },
  "RF-EQ-058": { criticality: "C", groupName: "Fabrication" },
  "RF-EQ-059": { criticality: "C", groupName: "Fabrication" },
  "RF-EQ-060": { criticality: "C", groupName: "Fabrication" },
  // Welders
  "RF-EQ-028": { criticality: "C", groupName: "Fabrication" },
  "RF-EQ-061": { criticality: "C", groupName: "Fabrication" },
  // Material Handling
  "RF-EQ-029": { criticality: "C", groupName: "Material Handling" },
  "RF-EQ-063": { criticality: "B", groupName: "Material Handling" },
  // Reserved
  "RF-EQ-030": { criticality: "C", groupName: "Other" },
  // Extruders
  "RF-EQ-031": { criticality: "A", groupName: "Extrusion" },
  "RF-EQ-035": { criticality: "A", groupName: "Extrusion" },
  // Extrusion Aux
  "RF-EQ-032": { criticality: "A", groupName: "Extrusion" },
  "RF-EQ-033": { criticality: "B", groupName: "Extrusion" },
  "RF-EQ-034": { criticality: "B", groupName: "Extrusion" },
  "RF-EQ-036": { criticality: "A", groupName: "Extrusion" },
  "RF-EQ-037": { criticality: "B", groupName: "Extrusion" },
  "RF-EQ-038": { criticality: "B", groupName: "Extrusion" },
  "RF-EQ-048": { criticality: "B", groupName: "Extrusion" },
  "RF-EQ-049": { criticality: "B", groupName: "Extrusion" },
  // Mixers
  "RF-EQ-039": { criticality: "A", groupName: "Mixing" },
  "RF-EQ-040": { criticality: "A", groupName: "Mixing" },
  "RF-EQ-041": { criticality: "A", groupName: "Mixing" },
  // Feed Systems
  "RF-EQ-042": { criticality: "A", groupName: "Mixing" },
  "RF-EQ-043": { criticality: "A", groupName: "Mixing" },
  "RF-EQ-044": { criticality: "A", groupName: "Mixing" },
  "RF-EQ-045": { criticality: "A", groupName: "Mixing" },
  // Specialty Machines
  "RF-EQ-047": { criticality: "A", groupName: "Specialty" },
  "RF-EQ-050": { criticality: "B", groupName: "Specialty" },
  "RF-EQ-051": { criticality: "B", groupName: "Specialty" },
  "RF-EQ-052": { criticality: "B", groupName: "Specialty" },
  // Machine Tool
  "RF-EQ-062": { criticality: "C", groupName: "Fabrication" },
  // Packaging
  "RF-EQ-064": { criticality: "C", groupName: "Shipping" },
  "RF-EQ-066": { criticality: "C", groupName: "Shipping" },
  // Measurement
  "RF-EQ-065": { criticality: "C", groupName: "Shipping" },
  // Peripheral
  "RF-EQ-067": { criticality: "C", groupName: "Fabrication" },
  // Facility
  "RF-EQ-068": { criticality: "B", groupName: "Shipping" },
  // Vehicle
  "RF-EQ-069": { criticality: "B", groupName: "Other" },
};

// ── POST handler ───────────────────────────────────────────────────────────

export async function POST() {
  try {
    const session = await auth();
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const adminId = session.user.id;
    const results = { equipment: 0, ncrs: 0 };

    // 1) Equipment enrichments
    for (const [serial, data] of Object.entries(equipmentEnrichments)) {
      const updated = await prisma.equipment.updateMany({
        where: { serialNumber: serial },
        data: { criticality: data.criticality, groupName: data.groupName },
      });
      results.equipment += updated.count;
    }

    // 2) NCRs — skip duplicates by ncrNumber
    const existingNCRs = await prisma.nonConformance.findMany({
      select: { ncrNumber: true },
    });
    const existingNumbers = new Set(existingNCRs.map((n: { ncrNumber: string }) => n.ncrNumber));

    const ncrTypeMap: Record<string, string> = {
      Dimensional: "dimensional", Quality: "quality", Function: "function",
      Aesthetic: "aesthetic", Asthetic: "aesthetic", Safety: "safety", Compliance: "compliance",
    };
    const dispositionMap: Record<string, string> = {
      "Use as is": "use_as_is", "In-House Rework": "rework",
      Scrap: "scrap", "Return to Vendor": "return_to_vendor",
    };

    for (const ncr of accessNCRs) {
      if (existingNumbers.has(ncr.ncrNumber)) continue;

      await prisma.nonConformance.create({
        data: {
          ncrNumber: ncr.ncrNumber,
          submittedById: adminId,
          date: ncr.initiatedDate ? new Date(ncr.initiatedDate) : new Date(),
          partNumber: ncr.partNumber || null,
          drawingNumber: ncr.drawingNumber || null,
          drawingRevision: ncr.drawingRevision || null,
          quantityAffected: ncr.quantityAffected || null,
          vendor: ncr.vendor || null,
          otherInfo: ncr.description || null,
          ncrType: ncrTypeMap[ncr.ncrType] || "quality",
          requirementDescription: ncr.requirements || "(imported — no description)",
          nonConformanceDescription: ncr.actual || ncr.description || "(imported)",
          disposition: dispositionMap[ncr.disposition] || null,
          immediateAction: ncr.immediateAction || null,
          ncrTagNumber: ncr.ncrTagNumber || null,
          plantLocation: ncr.department || null,
          status: ncr.status === "Open" ? "open" : "closed",
        },
      });
      results.ncrs++;
    }

    return NextResponse.json({
      ok: true,
      imported: results,
      message: `Enriched ${results.equipment} equipment, created ${results.ncrs} NCRs`,
    });
  } catch (error) {
    console.error("[import-access]", error);
    return NextResponse.json(
      { error: "Import failed", details: String(error) },
      { status: 500 }
    );
  }
}
