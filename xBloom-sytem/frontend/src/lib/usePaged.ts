import { useEffect, useState } from "react";

/**
 * Client-side pagination. Returns the current page slice plus controls.
 * pageSize 0 = show all. Resets to page 1 when the result set or size changes.
 */
export function usePaged<T>(items: T[], initialSize = 25) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialSize);

  const total = items.length;
  const pageCount = pageSize === 0 ? 1 : Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pageCount);
  const start = pageSize === 0 ? 0 : (current - 1) * pageSize;
  const pageItems = pageSize === 0 ? items : items.slice(start, start + pageSize);

  // Snap back to the first page whenever the data set or page size changes
  // (e.g. after a filter/search), so the user never lands on an empty page.
  useEffect(() => {
    setPage(1);
  }, [total, pageSize]);

  return { pageItems, page: current, pageCount, pageSize, setPage, setPageSize, total, start };
}
