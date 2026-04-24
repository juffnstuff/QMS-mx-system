"use client";

interface CategoryOption {
  id: string;
  label: string;
  count: number;
}

export function MobileCategorySelect({
  categories,
  activeCategory,
  searchQuery,
  statusFilter,
}: {
  categories: CategoryOption[];
  activeCategory: string;
  searchQuery?: string;
  statusFilter?: string;
}) {
  return (
    <form>
      {searchQuery && <input type="hidden" name="search" value={searchQuery} />}
      {statusFilter && statusFilter !== "all" && <input type="hidden" name="status" value={statusFilter} />}
      <select
        name="category"
        defaultValue={activeCategory}
        onChange={(e) => {
          const form = e.target.closest("form");
          if (form) form.submit();
        }}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {categories.map((cat) => (
          <option key={cat.id} value={cat.id}>
            {cat.label} ({cat.count})
          </option>
        ))}
      </select>
    </form>
  );
}
