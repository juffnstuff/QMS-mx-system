import { CardSkeleton } from "@/components/loading-skeleton";

export default function WorkOrdersLoading() {
  return (
    <div>
      <div className="flex justify-between mb-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-40" />
        <div className="h-10 bg-gray-200 rounded w-40" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <CardSkeleton key={i} rows={2} />
        ))}
      </div>
    </div>
  );
}
