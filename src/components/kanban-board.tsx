"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  rectIntersection,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { useRouter } from "next/navigation";
import { KanbanColumn } from "./kanban-column";
import { KanbanCard, KanbanCardData, EntityType } from "./kanban-card";

const COLUMNS = [
  { id: "backlog", title: "Backlog" },
  { id: "in_progress", title: "In Progress" },
  { id: "needs_parts", title: "Needs Parts" },
  { id: "scheduled", title: "Scheduled" },
  { id: "done", title: "Done" },
] as const;

type ColumnId = (typeof COLUMNS)[number]["id"];

interface KanbanBoardProps {
  initialCards: KanbanCardData[];
  initialColumns: Record<ColumnId, string[]>; // column id → array of "entityType::id" keys
  isAdmin?: boolean;
  allUsers?: { id: string; name: string }[];
}

const TYPE_FILTERS: { key: EntityType; label: string }[] = [
  { key: "workOrder", label: "Work Orders" },
  { key: "maintenanceSchedule", label: "Maintenance" },
  { key: "nonConformance", label: "NCRs" },
  { key: "capa", label: "CAPAs" },
  { key: "project", label: "Projects" },
];

function parseCardKey(key: string): { entityType: EntityType; id: string } | null {
  const [entityType, id] = key.split("::");
  if (!entityType || !id) return null;
  return { entityType: entityType as EntityType, id };
}

// Moving a work order or maintenance schedule to "done" creates a MaintenanceLog;
// prompt the user for completion details before committing.
function shouldPromptForCompletion(entityType: EntityType, targetCol: ColumnId): boolean {
  return (
    targetCol === "done" &&
    (entityType === "workOrder" || entityType === "maintenanceSchedule")
  );
}

type PendingCompletion = {
  cardKey: string;
  targetCol: ColumnId;
  entityType: EntityType;
  cardTitle: string;
};

export function KanbanBoard({
  initialCards,
  initialColumns,
  isAdmin = false,
  allUsers = [],
}: KanbanBoardProps) {
  const router = useRouter();
  const [columns, setColumns] = useState<Record<ColumnId, string[]>>(initialColumns);
  const [cardMap] = useState<Map<string, KanbanCardData>>(() => {
    const map = new Map<string, KanbanCardData>();
    initialCards.forEach((c) => map.set(`${c.entityType}::${c.id}`, c));
    return map;
  });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<ColumnId>("backlog");
  const [expandedCols, setExpandedCols] = useState<Set<string>>(new Set(["backlog", "in_progress"]));
  // Snapshot of column state captured before a move that may need to be reverted.
  const [pendingSnapshot, setPendingSnapshot] = useState<Record<ColumnId, string[]> | null>(null);
  const [pendingCompletion, setPendingCompletion] = useState<PendingCompletion | null>(null);

  // Filters — empty typeFilter means "show all types". assigneeFilter is
  // admin-only; empty means "any assignee". Filters affect what renders but
  // don't mutate the underlying columns state.
  const [typeFilter, setTypeFilter] = useState<Set<EntityType>>(new Set());
  const [assigneeFilter, setAssigneeFilter] = useState<string>("");

  const toggleTypeFilter = useCallback((t: EntityType) => {
    setTypeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }, []);

  const matchesFilters = useCallback(
    (cardKey: string) => {
      const card = cardMap.get(cardKey);
      if (!card) return false;
      if (typeFilter.size > 0 && !typeFilter.has(card.entityType)) return false;
      if (assigneeFilter && !(card.assigneeIds ?? []).includes(assigneeFilter)) return false;
      return true;
    },
    [cardMap, typeFilter, assigneeFilter],
  );

  const visibleColumns = useMemo(() => {
    const filtered: Record<ColumnId, string[]> = {
      backlog: [],
      in_progress: [],
      needs_parts: [],
      scheduled: [],
      done: [],
    };
    for (const colId of Object.keys(columns) as ColumnId[]) {
      filtered[colId] = columns[colId].filter(matchesFilters);
    }
    return filtered;
  }, [columns, matchesFilters]);

  const filtersActive = typeFilter.size > 0 || assigneeFilter !== "";

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 8 } })
  );

  const findColumn = useCallback(
    (cardKey: string): ColumnId | null => {
      for (const [colId, keys] of Object.entries(columns)) {
        if (keys.includes(cardKey)) return colId as ColumnId;
      }
      return null;
    },
    [columns]
  );

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  // Send the move to the API. Optionally carries completion notes/parts when
  // transitioning to "done" for workOrder/maintenanceSchedule.
  const commitMove = useCallback(
    async (
      cardKey: string,
      targetCol: ColumnId,
      completion?: { completionNotes?: string; partsUsed?: string },
      snapshotForRevert?: Record<ColumnId, string[]>,
    ) => {
      const parsed = parseCardKey(cardKey);
      if (!parsed) return;

      try {
        const res = await fetch("/api/kanban", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entityType: parsed.entityType,
            entityId: parsed.id,
            boardStatus: targetCol,
            ...(completion?.completionNotes ? { completionNotes: completion.completionNotes } : {}),
            ...(completion?.partsUsed ? { partsUsed: completion.partsUsed } : {}),
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Update failed");
        }

        const card = cardMap.get(cardKey);
        const colLabel = COLUMNS.find((c) => c.id === targetCol)?.title || targetCol;
        const loggedSuffix =
          targetCol === "done" &&
          (parsed.entityType === "workOrder" || parsed.entityType === "maintenanceSchedule")
            ? " · maintenance logged"
            : "";
        showToast(`${card?.title || "Item"} moved to ${colLabel}${loggedSuffix}`);
        router.refresh();
      } catch (error) {
        showToast(`Failed to update: ${error instanceof Error ? error.message : "Unknown error"}`);
        if (snapshotForRevert) setColumns(snapshotForRevert);
      }
    },
    [cardMap, router, showToast]
  );

  // Shared move-card logic used by tap-to-move (mobile) and by performMove fallback
  const performMove = useCallback(
    async (cardKey: string, targetCol: ColumnId) => {
      const parsed = parseCardKey(cardKey);
      if (!parsed) return;

      const sourceCol = findColumn(cardKey);
      if (!sourceCol || sourceCol === targetCol) return;

      const snapshot = columns;

      // Optimistic update
      setColumns((prev) => {
        const source = prev[sourceCol].filter((k) => k !== cardKey);
        const target = [...prev[targetCol], cardKey];
        return { ...prev, [sourceCol]: source, [targetCol]: target };
      });

      if (shouldPromptForCompletion(parsed.entityType, targetCol)) {
        const card = cardMap.get(cardKey);
        setPendingSnapshot(snapshot);
        setPendingCompletion({
          cardKey,
          targetCol,
          entityType: parsed.entityType,
          cardTitle: card?.title || "this item",
        });
        return;
      }

      await commitMove(cardKey, targetCol, undefined, snapshot);
    },
    [columns, findColumn, cardMap, commitMove]
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      setActiveId(event.active.id as string);
      setPendingSnapshot(columns);
    },
    [columns]
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over) return;

      const activeKey = active.id as string;
      const overId = over.id as string;

      const sourceCol = findColumn(activeKey);
      let targetCol = COLUMNS.find((c) => c.id === overId)?.id || findColumn(overId);

      if (!sourceCol || !targetCol || sourceCol === targetCol) return;

      setColumns((prev) => {
        const sourceItems = prev[sourceCol].filter((k) => k !== activeKey);
        const targetItems = [...prev[targetCol as ColumnId]];

        const overIndex = targetItems.indexOf(overId);
        if (overIndex >= 0) {
          targetItems.splice(overIndex, 0, activeKey);
        } else {
          targetItems.push(activeKey);
        }

        return { ...prev, [sourceCol]: sourceItems, [targetCol as ColumnId]: targetItems };
      });
    },
    [findColumn]
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (!over) {
        setPendingSnapshot(null);
        return;
      }

      const activeKey = active.id as string;
      const overId = over.id as string;
      const targetCol = findColumn(activeKey);

      if (!targetCol) {
        setPendingSnapshot(null);
        return;
      }

      // Handle reorder within same column
      if (columns[targetCol].includes(overId) && activeKey !== overId) {
        setColumns((prev) => {
          const items = [...prev[targetCol]];
          const oldIndex = items.indexOf(activeKey);
          const newIndex = items.indexOf(overId);
          return { ...prev, [targetCol]: arrayMove(items, oldIndex, newIndex) };
        });
      }

      const parsed = parseCardKey(activeKey);
      if (!parsed) {
        setPendingSnapshot(null);
        return;
      }

      const snapshot = pendingSnapshot;
      const originalCol = Object.entries(snapshot ?? initialColumns).find(([, keys]) =>
        keys.includes(activeKey)
      )?.[0];

      if (originalCol !== targetCol) {
        if (shouldPromptForCompletion(parsed.entityType, targetCol)) {
          const card = cardMap.get(activeKey);
          setPendingCompletion({
            cardKey: activeKey,
            targetCol,
            entityType: parsed.entityType,
            cardTitle: card?.title || "this item",
          });
          // keep pendingSnapshot so cancel can revert
          return;
        }

        await commitMove(activeKey, targetCol, undefined, snapshot ?? initialColumns);
      }

      setPendingSnapshot(null);
    },
    [columns, findColumn, initialColumns, cardMap, commitMove, pendingSnapshot]
  );

  const handleCompletionConfirm = useCallback(
    async (notes: string, parts: string) => {
      if (!pendingCompletion) return;
      const { cardKey, targetCol } = pendingCompletion;
      const snapshot = pendingSnapshot ?? initialColumns;
      setPendingCompletion(null);
      setPendingSnapshot(null);
      await commitMove(
        cardKey,
        targetCol,
        { completionNotes: notes.trim() || undefined, partsUsed: parts.trim() || undefined },
        snapshot,
      );
    },
    [pendingCompletion, pendingSnapshot, initialColumns, commitMove]
  );

  const handleCompletionCancel = useCallback(() => {
    if (pendingSnapshot) setColumns(pendingSnapshot);
    setPendingCompletion(null);
    setPendingSnapshot(null);
  }, [pendingSnapshot]);

  const activeCard = activeId ? cardMap.get(activeId) || null : null;

  const toggleCol = (colId: string) => {
    setExpandedCols((prev) => {
      const next = new Set(prev);
      if (next.has(colId)) next.delete(colId);
      else next.add(colId);
      return next;
    });
  };

  return (
    <div className="relative">
      {/* Filters: type (everyone) + assignee (admins only) */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-4">
        <div className="flex items-center gap-1.5 flex-wrap">
          {TYPE_FILTERS.map((f) => {
            const active = typeFilter.has(f.key);
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => toggleTypeFilter(f.key)}
                className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                  active
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {f.label}
              </button>
            );
          })}
          {typeFilter.size > 0 && (
            <button
              type="button"
              onClick={() => setTypeFilter(new Set())}
              className="text-xs text-gray-500 hover:text-gray-800 px-2"
            >
              Clear types
            </button>
          )}
        </div>
        {isAdmin && allUsers.length > 0 && (
          <div className="flex items-center gap-2 sm:ml-auto">
            <label htmlFor="assignee-filter" className="text-xs text-gray-500">
              Assignee
            </label>
            <select
              id="assignee-filter"
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="text-sm text-gray-900 border border-gray-300 rounded-md px-2 py-1 bg-white"
            >
              <option value="">Anyone</option>
              {allUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {filtersActive && (
          <button
            type="button"
            onClick={() => {
              setTypeFilter(new Set());
              setAssigneeFilter("");
            }}
            className="text-xs text-gray-500 hover:text-gray-800 underline"
          >
            Reset
          </button>
        )}
      </div>

      {/* ===== DESKTOP: Horizontal drag-and-drop columns ===== */}
      <div className="hidden sm:block">
        <DndContext
          sensors={sensors}
          collisionDetection={rectIntersection}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2">
            {COLUMNS.map((col) => (
              <KanbanColumn
                key={col.id}
                id={col.id}
                title={col.title}
                cards={(visibleColumns[col.id] || [])
                  .map((key) => cardMap.get(key))
                  .filter((c): c is KanbanCardData => c !== undefined)}
                onMoveCard={(cardKey, targetCol) => performMove(cardKey, targetCol as ColumnId)}
              />
            ))}
          </div>

          <DragOverlay>
            {activeCard && (
              <div className="rotate-2 scale-105">
                <KanbanCard card={activeCard} />
              </div>
            )}
          </DragOverlay>
        </DndContext>

        <p className="text-center text-xs text-gray-400 mt-2">
          Drag a card between columns, or tap the <span className="inline-block align-middle">⇄</span> icon to pick a status &middot; Click a card to open the record
        </p>
      </div>

      {/* ===== MOBILE: Stacked accordion columns with tap-to-move ===== */}
      <div className="sm:hidden space-y-3">
        {/* Mobile tab selector */}
        <div className="flex gap-1 overflow-x-auto pb-2 -mx-1 px-1">
          {COLUMNS.map((col) => {
            const count = (visibleColumns[col.id] || []).length;
            return (
              <button
                key={col.id}
                onClick={() => setMobileTab(col.id)}
                className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  mobileTab === col.id
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 active:bg-gray-200"
                }`}
              >
                {col.title}
                <span
                  className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${
                    mobileTab === col.id ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Active column cards */}
        <div className="space-y-2">
          {(visibleColumns[mobileTab] || []).map((key) => {
            const card = cardMap.get(key);
            if (!card) return null;
            return (
              <KanbanCard
                key={key}
                card={card}
                currentColumn={mobileTab}
                onMoveCard={(cardKey, targetCol) => performMove(cardKey, targetCol as ColumnId)}
              />
            );
          })}
          {(visibleColumns[mobileTab] || []).length === 0 && (
            <div className="text-center py-8 text-sm text-gray-400">
              No items in {COLUMNS.find((c) => c.id === mobileTab)?.title}
              {filtersActive && " (matching your filters)"}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400">
          Tap <span className="inline-flex items-center gap-0.5 text-gray-500 font-medium">↔</span> on a card to move it &middot; Tap title to open
        </p>
      </div>

      {/* Completion prompt — shown when a card moves to Done and needs a maintenance log */}
      {pendingCompletion && (
        <CompletionDialog
          entityType={pendingCompletion.entityType}
          cardTitle={pendingCompletion.cardTitle}
          onConfirm={handleCompletionConfirm}
          onCancel={handleCompletionCancel}
        />
      )}

      {/* Toast notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 left-6 sm:left-auto z-50 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg text-sm animate-fade-in max-w-sm mx-auto sm:mx-0">
          {toastMessage}
        </div>
      )}
    </div>
  );
}

function CompletionDialog({
  entityType,
  cardTitle,
  onConfirm,
  onCancel,
}: {
  entityType: EntityType;
  cardTitle: string;
  onConfirm: (notes: string, parts: string) => void;
  onCancel: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [parts, setParts] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Mount-on-client guard so createPortal doesn't run during SSR.
  useEffect(() => setMounted(true), []);

  const label = entityType === "workOrder" ? "Work order" : "Maintenance";

  // Portal to document.body so the overlay escapes the dashboard's
  // overflow-auto <main>. iOS Safari treats `position: fixed` inside a
  // scrolling ancestor differently than desktop browsers — portaling
  // sidesteps that quirk so the dialog reliably appears over the kanban.
  if (!mounted) return null;

  const dialog = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[calc(100vh-2rem)] flex flex-col">
        <div className="p-5 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Complete {label}</h3>
          <p className="text-sm text-gray-500 mt-1 line-clamp-2">{cardTitle}</p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitting(true);
            onConfirm(notes, parts);
          }}
          className="p-5 space-y-4 overflow-y-auto"
        >
          <div>
            <label htmlFor="completion-notes" className="block text-sm font-medium text-gray-700 mb-1">
              What was done?
            </label>
            <textarea
              id="completion-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-base sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Brief description of the work performed (optional)"
              autoFocus
            />
            <p className="text-xs text-gray-400 mt-1">
              Appended to the maintenance log entry.
            </p>
          </div>
          <div>
            <label htmlFor="completion-parts" className="block text-sm font-medium text-gray-700 mb-1">
              Parts used
            </label>
            <input
              id="completion-parts"
              type="text"
              value={parts}
              onChange={(e) => setParts(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-base sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., 2x bearings, 1 gallon hydraulic fluid"
            />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setSubmitting(true);
                const tag = "Completed by vendor";
                const trimmed = notes.trim();
                const finalNotes = trimmed ? `${tag} — ${trimmed}` : tag;
                onConfirm(finalNotes, parts);
              }}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              Vendor Completed
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "Logging..." : "Log & Complete"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
