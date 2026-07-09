import { useMemo, useState } from "react";
import type { SortState } from "../components/staff/ui";

/** Compare two cell values: empty sinks to the bottom; numbers numerically; text Thai-aware. */
function compare(a: unknown, b: unknown): number {
  const ae = a == null || a === "";
  const be = b == null || b === "";
  if (ae && be) return 0;
  if (ae) return 1;
  if (be) return -1;
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  return String(a).localeCompare(String(b), "th");
}

/** Pure sort by the current SortState. `accessor` resolves a row's value for a sort key. */
export function sortRows<T>(rows: T[], sort: SortState, accessor?: (row: T, key: string) => unknown): T[] {
  if (!sort) return rows;
  const { key, dir } = sort;
  const valOf = (r: T) => (accessor ? accessor(r, key) : (r as Record<string, unknown>)[key]);
  return [...rows].sort((x, y) => (dir === "asc" ? compare(valOf(x), valOf(y)) : -compare(valOf(x), valOf(y))));
}

/** Just the sort state + a header-click toggle (asc → desc → asc). For multi-table pages. */
export function useSortState() {
  const [sort, setSort] = useState<SortState>(null);
  const toggleSort = (key: string) =>
    setSort((s) => (s?.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  return { sort, toggleSort };
}

/** State + memoised sorted rows for the common single-table case. */
export function useSort<T>(rows: T[], accessor?: (row: T, key: string) => unknown) {
  const { sort, toggleSort } = useSortState();
  const sorted = useMemo(() => sortRows(rows, sort, accessor), [rows, sort, accessor]);
  return { sort, toggleSort, sorted };
}
