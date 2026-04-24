"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { KanbanCard, KanbanCardData } from "./kanban-card";

interface KanbanColumnProps {
  id: string;
  title: string;
  cards: KanbanCardData[];
  onMoveCard?: (cardKey: string, targetColumn: string) => void;
  defaultCollapsed?: boolean;
}

export function KanbanColumn({ id, title, cards, onMoveCard, defaultCollapsed }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  const sortableIds = cards.map((c) => `${c.entityType}::${c.id}`);

  return (
    <div className="flex flex-col sm:min-w-[272px] sm:w-[272px] sm:shrink-0">
      {/* Column header */}
      <div className="flex items-center gap-2 px-3 py-2 mb-2">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          {title}
        </h3>
        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-gray-200 text-xs font-medium text-gray-600">
          {cards.length}
        </span>
      </div>

      {/* Droppable area */}
      <div
        ref={setNodeRef}
        className={`flex-1 rounded-lg p-2 space-y-2 sm:overflow-y-auto sm:min-h-[200px] transition-colors ${
          isOver ? "bg-blue-50 ring-2 ring-blue-200" : "bg-gray-50"
        }`}
      >
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <KanbanCard
              key={`${card.entityType}::${card.id}`}
              card={card}
              currentColumn={id}
              onMoveCard={onMoveCard}
            />
          ))}
        </SortableContext>

        {cards.length === 0 && (
          <div className="hidden sm:flex items-center justify-center h-20 text-xs text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
            Drop items here
          </div>
        )}
      </div>
    </div>
  );
}
