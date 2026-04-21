import { prisma } from "@/lib/prisma";
import { EQUIPMENT_TEMPLATE_MAP, TEMPLATES, type TemplateSeed } from "./seed-data";
import { advanceEasternNextDue, endOfEasternDay } from "./eastern-time";

export interface SeedResult {
  templatesUpserted: number;
  itemsInserted: number;
  equipmentUpserted: number;
  schedulesUpserted: number;
  skipped: string[];
}

// Idempotent seed: upsert templates by code (replacing item list each time),
// upsert equipment by serial number, and ensure one MaintenanceSchedule per
// (equipment, template) pair.
export async function seedPmChecklists(): Promise<SeedResult> {
  const result: SeedResult = {
    templatesUpserted: 0,
    itemsInserted: 0,
    equipmentUpserted: 0,
    schedulesUpserted: 0,
    skipped: [],
  };

  // 1. Upsert templates + replace items
  const templatesByCode = new Map<string, { id: string }>();
  for (const tpl of TEMPLATES) {
    const upserted = await upsertTemplate(tpl);
    templatesByCode.set(tpl.code, { id: upserted.id });
    result.templatesUpserted += 1;
    result.itemsInserted += tpl.items.length;
  }

  // 2. Upsert equipment + schedules
  for (const eq of EQUIPMENT_TEMPLATE_MAP) {
    const equipment = await prisma.equipment.upsert({
      where: { serialNumber: eq.serialNumber },
      update: {
        // Don't clobber existing operational data — only ensure classification
        // is correct for checklists.
        criticality: eq.criticality,
        equipmentClass: eq.equipmentClass,
      },
      create: {
        serialNumber: eq.serialNumber,
        name: eq.name,
        type: eq.type,
        location: eq.location,
        criticality: eq.criticality,
        equipmentClass: eq.equipmentClass,
        groupName: eq.groupName,
      },
    });
    result.equipmentUpserted += 1;

    for (const code of eq.templateCodes) {
      const tpl = templatesByCode.get(code);
      if (!tpl) {
        result.skipped.push(`${eq.serialNumber}: template ${code} not found`);
        continue;
      }
      await upsertScheduleForTemplate(equipment.id, tpl.id, code, eq.serialNumber);
      result.schedulesUpserted += 1;
    }
  }

  return result;
}

async function upsertTemplate(tpl: TemplateSeed) {
  const supersedesCodes = tpl.supersedesCodes?.length ? tpl.supersedesCodes.join(",") : null;

  const upserted = await prisma.checklistTemplate.upsert({
    where: { code: tpl.code },
    update: {
      name: tpl.name,
      frequency: tpl.frequency,
      scope: tpl.scope,
      description: tpl.description ?? null,
      supersedesCodes,
      isActive: true,
    },
    create: {
      code: tpl.code,
      name: tpl.name,
      frequency: tpl.frequency,
      scope: tpl.scope,
      description: tpl.description ?? null,
      supersedesCodes,
    },
  });

  // Replace the item list: items don't have stable IDs outside the template,
  // so the safest way to keep the template in sync with the seed file is to
  // delete and reinsert. ChecklistItemResult keeps an FK to the item (RESTRICT),
  // so we only delete items with no results.
  const existing = await prisma.checklistItem.findMany({
    where: { templateId: upserted.id },
    select: { id: true, _count: { select: { results: true } } },
  });
  const deletableIds = existing.filter((i) => i._count.results === 0).map((i) => i.id);
  if (deletableIds.length > 0) {
    await prisma.checklistItem.deleteMany({ where: { id: { in: deletableIds } } });
  }

  // Re-insert items (only if no results reference any existing items — otherwise
  // we leave the old ones in place to preserve history).
  const stillExisting = existing.length - deletableIds.length;
  if (stillExisting === 0) {
    await prisma.checklistItem.createMany({
      data: tpl.items.map((item, idx) => ({
        templateId: upserted.id,
        sortOrder: idx,
        section: item.section ?? null,
        label: item.label,
        details: item.details ?? null,
        inputType: item.inputType ?? "checkbox",
        isCritical: item.isCritical ?? false,
        escalationNote: item.escalationNote ?? null,
      })),
    });
  }

  return upserted;
}

async function upsertScheduleForTemplate(
  equipmentId: string,
  templateId: string,
  templateCode: string,
  equipmentSerial: string,
) {
  const template = await prisma.checklistTemplate.findUniqueOrThrow({
    where: { id: templateId },
  });

  // One schedule per (equipment, template) pair. Match on both + any existing.
  const existing = await prisma.maintenanceSchedule.findFirst({
    where: { equipmentId, checklistTemplateId: templateId },
  });

  const title = `${template.name} — ${equipmentSerial}`;
  const nextDue = computeInitialNextDue(template.frequency);

  if (existing) {
    await prisma.maintenanceSchedule.update({
      where: { id: existing.id },
      data: {
        title,
        description: template.description,
        frequency: template.frequency,
        // Don't reset nextDue if the schedule already has a projected date —
        // only backfill when missing.
      },
    });
  } else {
    await prisma.maintenanceSchedule.create({
      data: {
        equipmentId,
        checklistTemplateId: templateId,
        title,
        description: template.description,
        frequency: template.frequency,
        nextDue,
      },
    });
  }
}

function computeInitialNextDue(frequency: string): Date {
  const now = new Date();
  // Initial nextDue is end-of-day Eastern for dailies (so today's completion
  // still counts as on-time), and one full period out for the rest.
  if (frequency === "daily") return endOfEasternDay(now);
  return advanceEasternNextDue(frequency, now);
}
