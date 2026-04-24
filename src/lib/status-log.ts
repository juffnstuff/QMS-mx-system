import { prisma } from "@/lib/prisma";

export type StatusEntityType =
  | "workOrder"
  | "nonConformance"
  | "capa"
  | "project"
  | "maintenanceSchedule";

interface LogArgs {
  entityType: StatusEntityType;
  entityId: string;
  field: "status" | "boardStatus";
  fromValue: string | null | undefined;
  toValue: string | null | undefined;
  changedById: string;
  note?: string;
}

/**
 * Append a row to StatusChangeLog when a status-ish field actually changes.
 * Silently noops when toValue is missing or equals fromValue. Failures are
 * logged but never thrown — an audit log shouldn't block a status update.
 */
export async function logStatusChange(args: LogArgs): Promise<void> {
  const { entityType, entityId, field, fromValue, toValue, changedById, note } = args;
  if (!toValue) return;
  if ((fromValue ?? null) === toValue) return;

  try {
    await prisma.statusChangeLog.create({
      data: {
        entityType,
        entityId,
        field,
        fromValue: fromValue ?? null,
        toValue,
        note: note ?? null,
        changedById,
      },
    });
  } catch (err) {
    console.error("[StatusChangeLog] Failed to write entry:", err);
  }
}
