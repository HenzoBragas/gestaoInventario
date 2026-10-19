import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { TableSkeleton } from "@/components/common/States";
import { cn } from "@/lib/utils";

export interface Column<T> {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Chave de ordenacao enviada ao servidor. */
  sortKey?: string;
  align?: "left" | "right";
  className?: string;
  /** Coluna que nao pode ser ocultada pelo usuario. */
  fixed?: boolean;
}

export interface Sort {
  key: string;
  direction: "asc" | "desc";
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => number | string;
  loading?: boolean;
  /** Enquanto busca a proxima pagina com dados antigos na tela. */
  refreshing?: boolean;
  sort?: Sort;
  onSort?: (sort: Sort) => void;
  hiddenColumns?: string[];
  selectable?: boolean;
  selected?: Set<number | string>;
  onSelectedChange?: (selected: Set<number | string>) => void;
  onRowClick?: (row: T) => void;
  rowLabel?: (row: T) => string;
  empty?: ReactNode;
  caption: string;
}

/** Tabela de dados com ordenacao no servidor, selecao multipla e linhas navegaveis por teclado. */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  refreshing,
  sort,
  onSort,
  hiddenColumns = [],
  selectable,
  selected = new Set(),
  onSelectedChange,
  onRowClick,
  rowLabel,
  empty,
  caption,
}: DataTableProps<T>) {
  const visible = columns.filter((c) => !hiddenColumns.includes(c.id));
  const pageKeys = rows.map(rowKey);
  const allSelected = pageKeys.length > 0 && pageKeys.every((k) => selected.has(k));
  const someSelected = pageKeys.some((k) => selected.has(k));

  function toggleAll() {
    const next = new Set(selected);
    if (allSelected) pageKeys.forEach((k) => next.delete(k));
    else pageKeys.forEach((k) => next.add(k));
    onSelectedChange?.(next);
  }

  function toggle(key: number | string) {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onSelectedChange?.(next);
  }

  if (loading) {
    return <TableSkeleton columns={Math.min(visible.length, 7)} />;
  }
  if (rows.length === 0) {
    return <>{empty}</>;
  }

  return (
    <div className={cn("relative overflow-x-auto transition-opacity", refreshing && "opacity-60")}>
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b bg-muted/40">
            {selectable && (
              <th scope="col" className="w-10 px-3 py-2.5">
                <Checkbox
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={toggleAll}
                  aria-label="Selecionar todos desta página"
                />
              </th>
            )}
            {visible.map((column) => {
              const active = sort && column.sortKey === sort.key;
              const ariaSort = active ? (sort.direction === "asc" ? "ascending" : "descending") : undefined;
              return (
                <th
                  key={column.id}
                  scope="col"
                  aria-sort={ariaSort}
                  className={cn(
                    "whitespace-nowrap px-3 py-2.5 text-xs font-medium text-muted-foreground",
                    column.align === "right" ? "text-right" : "text-left",
                    column.className,
                  )}
                >
                  {column.sortKey && onSort ? (
                    <button
                      type="button"
                      onClick={() =>
                        onSort({ key: column.sortKey!, direction: active && sort.direction === "asc" ? "desc" : "asc" })
                      }
                      className={cn(
                        "-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        active && "text-foreground",
                        column.align === "right" && "flex-row-reverse",
                      )}
                    >
                      {column.header}
                      {active ? (
                        sort.direction === "asc" ? (
                          <ArrowUp className="h-3 w-3" aria-hidden="true" />
                        ) : (
                          <ArrowDown className="h-3 w-3" aria-hidden="true" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-40" aria-hidden="true" />
                      )}
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => {
            const key = rowKey(row);
            const isSelected = selected.has(key);
            return (
              <tr
                key={key}
                className={cn(
                  "group transition-colors",
                  onRowClick && "cursor-pointer hover:bg-muted/50",
                  isSelected && "bg-primary/[0.04] hover:bg-primary/[0.07]",
                )}
                onClick={(event) => {
                  // Cliques em controles internos (botoes, menus, checkbox) nao abrem o detalhe.
                  if ((event.target as HTMLElement).closest("button,a,input,[role=menuitem],[role=checkbox]")) return;
                  onRowClick?.(row);
                }}
              >
                {selectable && (
                  <td className="w-10 px-3 py-2.5">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggle(key)}
                      aria-label={`Selecionar ${rowLabel?.(row) ?? key}`}
                    />
                  </td>
                )}
                {visible.map((column, index) => (
                  <td
                    key={column.id}
                    className={cn("px-3 py-2.5 align-middle", column.align === "right" && "tabular text-right", column.className)}
                  >
                    {index === 0 && onRowClick ? (
                      <RowLink label={rowLabel?.(row) ?? String(key)} onActivate={() => onRowClick(row)}>
                        {column.cell(row)}
                      </RowLink>
                    ) : (
                      column.cell(row)
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Torna a primeira celula focavel e acionavel por teclado (Enter/Espaco abrem o detalhe). */
function RowLink({ children, label, onActivate }: { children: ReactNode; label: string; onActivate: () => void }) {
  return (
    <span
      role="link"
      tabIndex={0}
      aria-label={`Abrir ${label}`}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onActivate();
        }
      }}
      className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </span>
  );
}
