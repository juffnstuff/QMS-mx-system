/**
 * Mapping native record status -> kanban board column.
 * Keep these in sync with BOARD_TO_NATIVE_STATUS in /api/kanban/route.ts.
 * The kanban has 5 columns (backlog, in_progress, needs_parts, scheduled, done)
 * while native statuses are narrower, so this is a many-to-one map.
 */

export type BoardEntityType =
  | "workOrder"
  | "nonConformance"
  | "capa"
  | "project";

type BoardStatus = "backlog" | "in_progress" | "needs_parts" | "scheduled" | "done";

const STATUS_TO_BOARD: Record<BoardEntityType, Record<string, BoardStatus>> = {
  workOrder: {
    open: "backlog",
    in_progress: "in_progress",
    completed: "done",
    cancelled: "done",
  },
  nonConformance: {
    open: "backlog",
    under_review: "in_progress",
    dispositioned: "scheduled",
    closed: "done",
  },
  capa: {
    open: "backlog",
    in_progress: "in_progress",
    pending_verification: "scheduled",
    closed: "done",
  },
  project: {
    planning: "backlog",
    in_progress: "in_progress",
    on_hold: "needs_parts",
    completed: "done",
  },
};

export function statusToBoardStatus(
  entityType: BoardEntityType,
  status: string | null | undefined,
): BoardStatus | null {
  if (!status) return null;
  return STATUS_TO_BOARD[entityType][status] ?? null;
}
