export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-1/3 mb-4" />
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4">
            <div className="h-3 bg-gray-200 rounded flex-1" />
            <div className="h-3 bg-gray-200 rounded w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden animate-pulse">
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
        <div className="flex gap-8">
          {Array.from({ length: cols }).map((_, i) => (
            <div key={i} className="h-3 bg-gray-200 rounded w-20" />
          ))}
        </div>
      </div>
      <div className="divide-y divide-gray-100">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="px-4 py-3 flex gap-8">
            {Array.from({ length: cols }).map((_, j) => (
              <div key={j} className="h-3 bg-gray-200 rounded w-24" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function KanbanSkeleton() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4 animate-pulse">
      {Array.from({ length: 5 }).map((_, col) => (
        <div key={col} className="min-w-[272px] w-[272px] shrink-0">
          <div className="flex items-center gap-2 px-3 py-2 mb-2">
            <div className="h-4 bg-gray-200 rounded w-24" />
            <div className="h-5 w-5 bg-gray-200 rounded-full" />
          </div>
          <div className="bg-gray-50 rounded-lg p-2 space-y-2 min-h-[200px]">
            {Array.from({ length: col === 0 ? 3 : col === 4 ? 1 : 2 }).map((_, i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-3">
                <div className="h-3 bg-gray-200 rounded w-16 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-full mb-1" />
                <div className="h-3 bg-gray-200 rounded w-2/3 mb-2" />
                <div className="flex justify-between">
                  <div className="h-3 bg-gray-200 rounded w-16" />
                  <div className="h-3 bg-gray-200 rounded w-12" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6 animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="h-3 bg-gray-200 rounded w-20 mb-2" />
              <div className="h-6 bg-gray-200 rounded w-10" />
            </div>
            <div className="h-10 w-10 bg-gray-200 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}
