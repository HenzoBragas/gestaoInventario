import { useState, type ReactNode } from "react";
import { BarChart3, Table2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChartCardProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  /** Visao alternativa em tabela (acessibilidade e leitura precisa dos valores). */
  table?: ReactNode;
  children: ReactNode;
}

export function ChartCard({ title, description, actions, className, table, children }: ChartCardProps) {
  const [view, setView] = useState<"chart" | "table">("chart");
  return (
    <section className={cn("flex min-w-0 flex-col rounded-xl border bg-card shadow-xs", className)} aria-label={title}>
      <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        <div className="flex items-center gap-2">
          {actions}
          {table && (
            <div className="flex rounded-lg border p-0.5" role="group" aria-label="Modo de visualização">
              <ViewButton active={view === "chart"} onClick={() => setView("chart")} label="Gráfico">
                <BarChart3 className="h-3.5 w-3.5" />
              </ViewButton>
              <ViewButton active={view === "table"} onClick={() => setView("table")} label="Tabela">
                <Table2 className="h-3.5 w-3.5" />
              </ViewButton>
            </div>
          )}
        </div>
      </header>
      <div className="min-w-0 flex-1 px-5 pb-4 pt-3">{view === "table" && table ? table : children}</div>
    </section>
  );
}

function ViewButton({ active, onClick, label, children }: { active: boolean; onClick: () => void; label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={cn(
        "grid h-6 w-7 place-items-center rounded-md text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active && "bg-muted text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/** Tabela compacta para a visao alternativa dos graficos. */
export function DataTableView({ columns, rows }: { columns: string[]; rows: ReactNode[][] }) {
  return (
    <div className="max-h-72 overflow-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-muted/80 backdrop-blur">
          <tr>
            {columns.map((c, i) => (
              <th key={c} scope="col" className={cn("px-3 py-2 text-xs font-medium text-muted-foreground", i === 0 ? "text-left" : "text-right")}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, i) => (
                <td key={i} className={cn("tabular px-3 py-1.5", i === 0 ? "text-left" : "text-right")}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
