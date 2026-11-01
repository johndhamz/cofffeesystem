"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ArrowUpDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SearchIcon,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  sortable?: boolean;
  className?: string;
  hideOnMobile?: boolean;
  align?: "left" | "right";
  cell: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  rowHref?: (row: T) => string;
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  testId?: string;
}

/**
 * Server-driven DataTable. Sorting, paging and search are encoded in the URL so the
 * server component re-queries; this component only renders and updates search params.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  rowHref,
  page,
  pageCount,
  total,
  pageSize,
  emptyTitle = "Nothing here yet",
  emptyDescription,
  emptyAction,
  testId = "data-table",
}: DataTableProps<T>) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const currentSort = params.get("sort");
  const currentDir = params.get("dir") === "desc" ? "desc" : "asc";

  function navigate(mutate: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(params.toString());
    mutate(next);
    router.push(`${pathname}?${next.toString()}`);
  }

  function toggleSort(key: string) {
    navigate((next) => {
      if (currentSort === key) {
        next.set("dir", currentDir === "asc" ? "desc" : "asc");
      } else {
        next.set("sort", key);
        next.set("dir", "asc");
      }
      next.delete("page");
    });
  }

  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;
  }

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <div className="space-y-3" data-testid={testId}>
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={cn(
                    col.hideOnMobile && "hidden md:table-cell",
                    col.align === "right" && "text-right",
                    col.className,
                  )}
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className="hover:text-foreground inline-flex items-center gap-1"
                      data-testid={`sort-${col.key}`}
                    >
                      {col.header}
                      {currentSort === col.key ? (
                        currentDir === "asc" ? (
                          <ArrowUpIcon className="size-3.5" />
                        ) : (
                          <ArrowDownIcon className="size-3.5" />
                        )
                      ) : (
                        <ArrowUpDownIcon className="size-3.5 opacity-40" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const href = rowHref?.(row);
              return (
                <TableRow
                  key={rowKey(row)}
                  data-testid="data-row"
                  data-row-id={rowKey(row)}
                  className={cn(href && "cursor-pointer")}
                  onClick={href ? () => router.push(href) : undefined}
                >
                  {columns.map((col) => (
                    <TableCell
                      key={col.key}
                      className={cn(
                        col.hideOnMobile && "hidden md:table-cell",
                        col.align === "right" && "text-right",
                        col.className,
                      )}
                      data-column={col.key}
                      onClick={(e) => {
                        // let interactive children (buttons/links/menus) handle their own clicks
                        if (
                          (e.target as HTMLElement).closest(
                            "button, a, [role=menuitem], input, select",
                          )
                        )
                          e.stopPropagation();
                      }}
                    >
                      {col.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <div className="text-muted-foreground flex flex-col items-center justify-between gap-2 text-sm sm:flex-row">
        <span data-testid="table-summary">
          Showing {first}–{last} of {total}
        </span>
        <div className="flex items-center gap-2">
          <NativeSelect
            aria-label="Rows per page"
            value={String(pageSize)}
            onChange={(e) =>
              navigate((next) => {
                next.set("pageSize", e.target.value);
                next.delete("page");
              })
            }
            className="w-24"
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </NativeSelect>
          <Button
            variant="outline"
            size="icon"
            disabled={page <= 1}
            onClick={() => navigate((next) => next.set("page", String(page - 1)))}
            aria-label="Previous page"
          >
            <ChevronLeftIcon />
          </Button>
          <span className="tabular-nums">
            {page} / {pageCount}
          </span>
          <Button
            variant="outline"
            size="icon"
            disabled={page >= pageCount}
            onClick={() => navigate((next) => next.set("page", String(page + 1)))}
            aria-label="Next page"
          >
            <ChevronRightIcon />
          </Button>
        </div>
      </div>
      {rowHref ? (
        <span className="sr-only">
          {rows.map((row) => (
            <Link key={rowKey(row)} href={rowHref(row)}>
              open
            </Link>
          ))}
        </span>
      ) : null}
    </div>
  );
}

/** Search box bound to ?q= (submits on Enter or after a short pause). */
export function SearchInput({
  placeholder = "Search…",
  paramKey = "q",
}: {
  placeholder?: string;
  paramKey?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function submit(value: string) {
    const next = new URLSearchParams(params.toString());
    if (value.trim()) next.set(paramKey, value.trim());
    else next.delete(paramKey);
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <form
      className="relative w-full sm:max-w-xs"
      onSubmit={(e) => {
        e.preventDefault();
        const input = e.currentTarget.elements.namedItem(paramKey) as HTMLInputElement;
        submit(input.value);
      }}
    >
      <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
      <Input
        name={paramKey}
        defaultValue={params.get(paramKey) ?? ""}
        placeholder={placeholder}
        className="pl-8"
        data-testid="search-input"
        onBlur={(e) => {
          if (e.target.value.trim() !== (params.get(paramKey) ?? "")) submit(e.target.value);
        }}
      />
    </form>
  );
}

/** Generic select bound to a URL search param. */
export function ParamSelect({
  paramKey,
  options,
  label,
  defaultValue = "",
}: {
  paramKey: string;
  options: { value: string; label: string }[];
  label: string;
  defaultValue?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <NativeSelect
      aria-label={label}
      data-testid={`filter-${paramKey}`}
      value={params.get(paramKey) ?? defaultValue}
      onChange={(e) => {
        const next = new URLSearchParams(params.toString());
        if (e.target.value && e.target.value !== defaultValue) next.set(paramKey, e.target.value);
        else next.delete(paramKey);
        next.delete("page");
        router.push(`${pathname}?${next.toString()}`);
      }}
      className="w-auto min-w-36"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </NativeSelect>
  );
}
