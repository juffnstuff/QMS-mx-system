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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
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
      // Determine target column: if over ID is a column name, use it; otherwise find the column of the card hovered over
      let targetCol = COLUMNS.find((c) => c.id === overId)?.id || findColumn(overId);

      if (!sourceCol || !targetCol || sourceCol === targetCol) return;

      setColumns((prev) => {
        const sourceItems = prev[sourceCol].filter((k) => k !== activeKey);
        const targetItems = [...prev[targetCol as ColumnId]];

        // Find insertion index if hovering over a card
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

      // Determine original column from initial data
      const parsed = parseCardKey(activeKey);
      if (!parsed) return;

      // Find the card's original board status from initial data
      const originalCol = Object.entries(initialColumns).find(([, keys]) =>
        keys.includes(activeKey)
      )?.[0];

      // If column changed, fire API call
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
          // Revert on failure
          showToast(`Failed to update status: ${error instanceof Error ? error.message : "Unknown error"}`);
          setColumns(initialColumns);
        }
      }
    },
    [columns, findColumn, initialColumns, cardMap, router, showToast]
  );

  const activeCard = activeId ? cardMap.get(activeId) || null : null;

  return (
    <div className="relative">
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

      {/* Drag hint */}
      <p className="text-center text-xs text-gray-400 mt-2">
        Drag any card between columns to update status &middot; Click a card to open the record
      </p>

      {/* Toast notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg text-sm animate-fade-in max-w-sm">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
