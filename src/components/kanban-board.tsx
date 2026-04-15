"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  closestCorners,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { useRouter } from "next/navigation";
import { KanbanColumn } from "./kanban-column";
import { KanbanCard, KanbanCardData, EntityType } from "./kanban-card";
import { ChevronDown } from "lucide-react";

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
}

function parseCardKey(key: string): { entityType: EntityType; id: string } | null {
  const [entityType, id] = key.split("::");
  if (!entityType || !id) return null;
  return { entityType: entityType as EntityType, id };
}

export function KanbanBoard({ initialCards, initialColumns }: KanbanBoardProps) {
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

  // Shared move-card logic used by both drag-and-drop AND tap-to-move
  const performMove = useCallback(
    async (cardKey: string, targetCol: ColumnId) => {
      const parsed = parseCardKey(cardKey);
      if (!parsed) return;

      const sourceCol = findColumn(cardKey);
      if (!sourceCol || sourceCol === targetCol) return;

      // Optimistic update
      setColumns((prev) => {
        const source = prev[sourceCol].filter((k) => k !== cardKey);
        const target = [...prev[targetCol], cardKey];
        return { ...prev, [sourceCol]: source, [targetCol]: target };
      });

      try {
        const res = await fetch("/api/kanban", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entityType: parsed.entityType,
            entityId: parsed.id,
            boardStatus: targetCol,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Update failed");
        }

        const card = cardMap.get(cardKey);
        const colLabel = COLUMNS.find((c) => c.id === targetCol)?.title || targetCol;
        showToast(`${card?.title || "Item"} moved to ${colLabel}`);
        router.refresh();
      } catch (error) {
        showToast(`Failed to update: ${error instanceof Error ? error.message : "Unknown error"}`);
        setColumns(initialColumns);
      }
    },
    [findColumn, initialColumns, cardMap, router, showToast]
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

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

      if (!over) return;

      const activeKey = active.id as string;
      const overId = over.id as string;
      const targetCol = findColumn(activeKey);

      if (!targetCol) return;

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
      if (!parsed) return;

      const originalCol = Object.entries(initialColumns).find(([, keys]) =>
        keys.includes(activeKey)
      )?.[0];

      if (originalCol !== targetCol) {
        try {
          const res = await fetch("/api/kanban", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              entityType: parsed.entityType,
              entityId: parsed.id,
              boardStatus: targetCol,
            }),
          });

          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || "Update failed");
          }

          const card = cardMap.get(activeKey);
          const colLabel = COLUMNS.find((c) => c.id === targetCol)?.title || targetCol;
          showToast(`${card?.title || "Item"} moved to ${colLabel}`);
          router.refresh();
        } catch (error) {
          showToast(`Failed to update: ${error instanceof Error ? error.message : "Unknown error"}`);
          setColumns(initialColumns);
        }
      }
    },
    [columns, findColumn, initialColumns, cardMap, router, showToast]
  );

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
      {/* ===== DESKTOP: Horizontal drag-and-drop columns ===== */}
      <div className="hidden sm:block">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
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
                cards={(columns[col.id] || [])
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
          Drag any card between columns to update status &middot; Click a card to open the record
        </p>
      </div>

      {/* ===== MOBILE: Stacked accordion columns with tap-to-move ===== */}
      <div className="sm:hidden space-y-3">
        {/* Mobile tab selector */}
        <div className="flex gap-1 overflow-x-auto pb-2 -mx-1 px-1">
          {COLUMNS.map((col) => {
            const count = (columns[col.id] || []).length;
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
          {(columns[mobileTab] || []).map((key) => {
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
          {(columns[mobileTab] || []).length === 0 && (
            <div className="text-center py-8 text-sm text-gray-400">
              No items in {COLUMNS.find((c) => c.id === mobileTab)?.title}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400">
          Tap <span className="inline-flex items-center gap-0.5 text-gray-500 font-medium">↔</span> on a card to move it &middot; Tap title to open
        </p>
      </div>

      {/* Toast notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 left-6 sm:left-auto z-50 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg text-sm animate-fade-in max-w-sm mx-auto sm:mx-0">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
