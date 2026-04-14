import { TableSkeleton } from "@/components/loading-skeleton";

export default function EquipmentLoading() {
  return (
    <div>
      <div className="flex justify-between mb-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-48" />
        <div className="h-10 bg-gray-200 rounded w-36" />
      </div>
      <div className="flex gap-1 mb-4 animate-pulse">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-9 bg-gray-200 rounded-lg w-32" />
        ))}
      </div>
      <TableSkeleton rows={8} cols={7} />
    </div>
  );
}
