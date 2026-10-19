import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useFormatters } from "@/lib/format";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  /** Explica a definicao do indicador (ex.: SKUs distintos x unidades). */
  hint?: ReactNode;
  /**
   * Variacao vs periodo anterior (value null = sem base de comparacao).
   * positiveIsGood null = indicador neutro (sem cor de bom/ruim).
   */
  delta?: { value: number | null; label: string; positiveIsGood?: boolean | null };
  tone?: "default" | "warning" | "critical";
  to?: string;
  search?: Record<string, unknown>;
  loading?: boolean;
}

export function KpiCard({ label, value, icon: Icon, hint, delta, tone = "default", to, search, loading }: KpiCardProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
        <span
          className={cn(
            "grid h-8 w-8 shrink-0 place-items-center rounded-lg",
            tone === "warning" && "bg-warning/15 text-warning-foreground dark:text-warning",
            tone === "critical" && "bg-destructive/10 text-destructive",
            tone === "default" && "bg-primary/10 text-primary",
          )}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-28" />
      ) : (
        <p className="tabular mt-2 text-[1.65rem] font-semibold leading-tight tracking-tight">{value}</p>
      )}
      <div className="mt-2 min-h-5 text-xs text-muted-foreground">
        {loading ? <Skeleton className="h-3 w-36" /> : delta ? <Delta {...delta} /> : hint}
      </div>
    </>
  );

  const className =
    "group block rounded-xl border bg-card p-4 shadow-xs transition-[border-color,box-shadow] duration-200";
  if (to) {
    return (
      <Link
        to={to}
        search={search as never}
        className={cn(className, "hover:border-primary/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}
      >
        {body}
      </Link>
    );
  }
  return <div className={className}>{body}</div>;
}

function Delta({ value, label, positiveIsGood = true }: { value: number | null; label: string; positiveIsGood?: boolean | null }) {
  const f = useFormatters();
  if (value === null) {
    return <span>Sem base de comparação · {label}</span>;
  }
  const up = value > 0;
  const flat = Math.abs(value) < 0.0005;
  const good = flat || positiveIsGood === null ? null : up === positiveIsGood;
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  const formatted = f.percent(value);
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={cn(
          "inline-flex items-center gap-0.5 font-medium",
          good === true && "text-success",
          good === false && "text-destructive",
        )}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {formatted}
      </span>
      {label}
    </span>
  );
}
