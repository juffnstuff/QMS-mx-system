import { StatsSkeleton, KanbanSkeleton } from "@/components/loading-skeleton";

export default function DashboardLoading() {
  return (
    <div>
      <div className="h-8 bg-gray-200 rounded w-64 mb-6 animate-pulse" />
      <StatsSkeleton />
      <KanbanSkeleton />
    </div>
  );
}
