import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeftRight,
  Boxes,
  CircleDollarSign,
  CircleSlash,
  Download,
  FileSpreadsheet,
  Flame,
  History,
  Loader2,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { MovementTypeBadge, StatusBadge } from "@/components/common/Badges";
import { DataTableView } from "@/components/common/ChartCard";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState } from "@/components/common/States";
import { useCategories, useLocations, useSuppliers } from "@/lib/api/hooks";
import { toApiError } from "@/lib/api/client";
import { analyticsApi, movementsApi, productsApi } from "@/lib/api/services";
import type { MovementType, StockStatus } from "@/lib/api/types";
import { locationsOf, MOVEMENT_LABEL } from "@/lib/domain";
import { useFormatters } from "@/lib/format";
import { cn } from "@/lib/utils";

type ReportId = "position" | "low" | "out" | "movements" | "period" | "valuation" | "top";

const REPORTS: { id: ReportId; title: string; description: string; icon: LucideIcon }[] = [
  { id: "position", title: "Posição do inventário", description: "Saldo, custo e valor de cada produto.", icon: Boxes },
  { id: "low", title: "Abaixo do mínimo", description: "Produtos com saldo no limite ou abaixo do mínimo.", icon: TriangleAlert },
  { id: "out", title: "Sem estoque", description: "Produtos ativos com saldo zerado.", icon: CircleSlash },
  { id: "movements", title: "Histórico de movimentações", description: "Registros detalhados no período.", icon: History },
  { id: "period", title: "Entradas e saídas por período", description: "Totais por dia, semana ou mês.", icon: ArrowLeftRight },
  { id: "valuation", title: "Valor do inventário", description: "Distribuição por categoria ou localização.", icon: CircleDollarSign },
  { id: "top", title: "Maior movimentação", description: "Produtos com maior volume no período.", icon: Flame },
];

const ALL = "__all__";

function daysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function ReportsPage() {
  const [report, setReport] = useState<ReportId>("position");
  const current = REPORTS.find((r) => r.id === report)!;

  return (
    <div className="space-y-6">
      <PageHeader title="Relatórios" description="Prévia na tela e exportação em CSV (abre no Excel). A exportação respeita os filtros aplicados." />
      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <nav aria-label="Relatórios disponíveis" className="min-w-0">
          <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-1">
            {REPORTS.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setReport(r.id)}
                  aria-current={r.id === report ? "page" : undefined}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    r.id === report ? "bg-primary/10" : "hover:bg-muted",
                  )}
                >
                  <r.icon className={cn("mt-0.5 h-4 w-4 shrink-0", r.id === report ? "text-primary" : "text-muted-foreground")} aria-hidden="true" />
                  <span>
                    <span className={cn("block text-sm font-medium", r.id === report && "text-primary")}>{r.title}</span>
                    <span className="block text-xs text-muted-foreground">{r.description}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <section className="min-w-0 rounded-xl border glass" aria-label={current.title}>
          <header className="border-b px-5 py-4">
            <h2 className="font-semibold">{current.title}</h2>
            <p className="text-sm text-muted-foreground">{current.description}</p>
          </header>
          {/* key: cada relatorio tem seus proprios filtros. */}
          <div key={report} className="p-5">
            {report === "position" && <ProductReport />}
            {report === "low" && <ProductReport status="LOW_STOCK" />}
            {report === "out" && <ProductReport status="OUT_OF_STOCK" />}
            {report === "movements" && <MovementsReport />}
            {report === "period" && <PeriodReport />}
            {report === "valuation" && <ValuationReport />}
            {report === "top" && <TopReport />}
          </div>
        </section>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ blocos comuns

function FilterBar({ children }: { children: ReactNode }) {
  return <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div>;
}

function FilterField({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function IdSelect({ id, value, onChange, options, allLabel }: { id: string; value?: number; onChange: (v?: number) => void; options: { value: number; label: string }[]; allLabel: string }) {
  return (
    <Select value={value ? String(value) : ALL} onValueChange={(v) => onChange(v === ALL ? undefined : Number(v))}>
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={String(o.value)}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function PeriodFields({ from, to, onChange }: { from: string; to: string; onChange: (from: string, to: string) => void }) {
  return (
    <>
      <FilterField label="De" id="rep-from">
        <Input id="rep-from" type="date" value={from} max={to} onChange={(e) => onChange(e.target.value, to)} />
      </FilterField>
      <FilterField label="Até" id="rep-to">
        <Input id="rep-to" type="date" value={to} min={from} onChange={(e) => onChange(from, e.target.value)} />
      </FilterField>
    </>
  );
}

function range(from: string, to: string) {
  const end = new Date(`${to}T00:00:00`);
  end.setDate(end.getDate() + 1);
  return { from: new Date(`${from}T00:00:00`).toISOString(), to: end.toISOString() };
}

function ExportBar({ summary, onExport, disabled }: { summary: ReactNode; onExport: () => Promise<string>; disabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      toast.success(`Relatório exportado: ${await onExport()}`);
    } catch (e) {
      toast.error(toApiError(e).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-sunken px-4 py-3">
      <p className="text-sm text-muted-foreground">{summary}</p>
      <Button onClick={run} disabled={busy || disabled}>
        {busy ? <Loader2 className="animate-spin" /> : <Download />} Exportar CSV
      </Button>
    </div>
  );
}

function Preview({ loading, error, empty, children }: { loading: boolean; error: Error | null; empty: boolean; children: ReactNode }) {
  if (loading) return <Skeleton className="h-64 w-full" />;
  if (error) return <ErrorState error={error} />;
  if (empty) return <EmptyState icon={FileSpreadsheet} title="Nenhum dado para os filtros escolhidos" />;
  return <>{children}</>;
}

// ------------------------------------------------------------------ relatorios

function ProductReport({ status }: { status?: StockStatus }) {
  const f = useFormatters();
  const { data: categories } = useCategories();
  const { data: locations } = useLocations();
  const { data: suppliers } = useSuppliers();
  const [filters, setFilters] = useState<{ categoryId?: number; locationId?: number; supplierId?: number }>({});
  const params = { ...filters, status: status ? [status] : undefined, sort: status === "LOW_STOCK" ? "stock" : "name", direction: "asc" as const };
  const { data, isLoading, error } = useQuery({
    queryKey: ["data", "report", "products", params],
    queryFn: () => productsApi.list({ ...params, size: 15 }),
  });

  return (
    <>
      <FilterBar>
        <FilterField label="Categoria" id="rep-cat">
          <IdSelect id="rep-cat" value={filters.categoryId} onChange={(categoryId) => setFilters((s) => ({ ...s, categoryId }))} options={(categories ?? []).map((c) => ({ value: c.seq, label: c.name }))} allLabel="Todas" />
        </FilterField>
        <FilterField label="Localização" id="rep-loc">
          <IdSelect id="rep-loc" value={filters.locationId} onChange={(locationId) => setFilters((s) => ({ ...s, locationId }))} options={(locations ?? []).map((l) => ({ value: l.id, label: `${l.code} · ${l.name}` }))} allLabel="Todas" />
        </FilterField>
        <FilterField label="Fornecedor" id="rep-sup">
          <IdSelect id="rep-sup" value={filters.supplierId} onChange={(supplierId) => setFilters((s) => ({ ...s, supplierId }))} options={(suppliers ?? []).map((s) => ({ value: s.id, label: s.name }))} allLabel="Todos" />
        </FilterField>
      </FilterBar>
      <ExportBar
        summary={data ? `${f.number(data.totalItems)} produto(s) no relatório. Prévia dos primeiros ${Math.min(15, data.totalItems)}.` : "Carregando…"}
        onExport={() => productsApi.exportCsv(params)}
        disabled={!data?.totalItems}
      />
      <Preview loading={isLoading} error={error} empty={!data?.items.length}>
        <DataTableView
          columns={["Produto", "Disponível", "Mínimo", "Valor", "Status"]}
          rows={(data?.items ?? []).map((p) => [
            <span key="n" className="block max-w-72 truncate">
              <span className="font-mono text-xs text-muted-foreground">{p.sku}</span> {p.name}
            </span>,
            `${f.number(p.stock)} ${p.unit}`,
            f.number(p.minStock),
            f.money(p.stockValue),
            <StatusBadge key="s" status={p.status} />,
          ])}
        />
      </Preview>
    </>
  );
}

function MovementsReport() {
  const f = useFormatters();
  const { data: locations } = useLocations();
  const [period, setPeriod] = useState({ from: daysAgo(30), to: daysAgo(0) });
  const [type, setType] = useState<MovementType | undefined>();
  const [locationId, setLocationId] = useState<number | undefined>();
  const params = { ...range(period.from, period.to), type, locationId };
  const { data, isLoading, error } = useQuery({
    queryKey: ["data", "report", "movements", params],
    queryFn: () => movementsApi.list({ ...params, size: 15 }),
  });

  return (
    <>
      <FilterBar>
        <PeriodFields from={period.from} to={period.to} onChange={(from, to) => setPeriod({ from, to })} />
        <FilterField label="Tipo" id="rep-type">
          <Select value={type ?? ALL} onValueChange={(v) => setType(v === ALL ? undefined : (v as MovementType))}>
            <SelectTrigger id="rep-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos</SelectItem>
              {(Object.keys(MOVEMENT_LABEL) as MovementType[]).map((t) => (
                <SelectItem key={t} value={t}>
                  {MOVEMENT_LABEL[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="Localização" id="rep-mloc">
          <IdSelect id="rep-mloc" value={locationId} onChange={setLocationId} options={(locations ?? []).map((l) => ({ value: l.id, label: `${l.code} · ${l.name}` }))} allLabel="Todas" />
        </FilterField>
      </FilterBar>
      <ExportBar
        summary={data ? `${f.number(data.totalItems)} movimentação(ões) no período.` : "Carregando…"}
        onExport={() => movementsApi.exportCsv(params)}
        disabled={!data?.totalItems}
      />
      <Preview loading={isLoading} error={error} empty={!data?.items.length}>
        <DataTableView
          columns={["Data", "Tipo", "Produto", "Qtd.", "Local", "Usuário"]}
          rows={(data?.items ?? []).map((m) => [
            f.dateTime(m.createdAt),
            <MovementTypeBadge key="t" type={m.type} />,
            <span key="p" className="block max-w-56 truncate">
              {m.productName}
            </span>,
            `${m.delta > 0 ? "+" : m.delta < 0 ? "−" : ""}${f.number(m.quantity)}`,
            locationsOf(m),
            m.userDisplayName ?? m.username,
          ])}
        />
      </Preview>
    </>
  );
}

function PeriodReport() {
  const f = useFormatters();
  const [period, setPeriod] = useState({ from: daysAgo(90), to: daysAgo(0) });
  const [groupBy, setGroupBy] = useState("week");
  const params = { ...range(period.from, period.to), groupBy };
  const { data, isLoading, error } = useQuery({
    queryKey: ["data", "report", "period", params],
    queryFn: () => analyticsApi.periodSummary(params),
  });
  const totals = (data ?? []).reduce((acc, r) => ({ in: acc.in + r.inUnits, out: acc.out + r.outUnits }), { in: 0, out: 0 });

  return (
    <>
      <FilterBar>
        <PeriodFields from={period.from} to={period.to} onChange={(from, to) => setPeriod({ from, to })} />
        <FilterField label="Agrupar por" id="rep-group">
          <Select value={groupBy} onValueChange={setGroupBy}>
            <SelectTrigger id="rep-group">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Dia</SelectItem>
              <SelectItem value="week">Semana</SelectItem>
              <SelectItem value="month">Mês</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
      </FilterBar>
      <ExportBar
        summary={data ? `Entradas: ${f.number(totals.in)} un. · Saídas: ${f.number(totals.out)} un. · Saldo: ${f.number(totals.in - totals.out)} un.` : "Carregando…"}
        onExport={() => analyticsApi.exportPeriodSummary(params)}
        disabled={!data?.length}
      />
      <Preview loading={isLoading} error={error} empty={!data?.length}>
        <DataTableView
          columns={["Período", "Entradas (un.)", "Saídas (un.)", "Ajustes", "Transferências", "Movimentações"]}
          rows={(data ?? []).map((r) => [r.period, f.number(r.inUnits), f.number(r.outUnits), f.number(r.adjustments), f.number(r.transfers), f.number(r.movements)])}
        />
      </Preview>
    </>
  );
}

function ValuationReport() {
  const f = useFormatters();
  const [groupBy, setGroupBy] = useState<"category" | "location">("location");
  const { data, isLoading, error } = useQuery({
    queryKey: ["data", "report", "valuation", groupBy],
    queryFn: () => analyticsApi.valuation(groupBy),
  });
  const total = (data ?? []).reduce((sum, g) => sum + g.value, 0);

  return (
    <>
      <FilterBar>
        <FilterField label="Agrupar por" id="rep-val">
          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as typeof groupBy)}>
            <SelectTrigger id="rep-val">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="location">Localização</SelectItem>
              <SelectItem value="category">Categoria</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
      </FilterBar>
      <ExportBar summary={data ? `Valor total: ${f.money(total)} (saldo × custo unitário atual).` : "Carregando…"} onExport={() => analyticsApi.exportValuation(groupBy)} disabled={!data?.length} />
      <Preview loading={isLoading} error={error} empty={!data?.length}>
        <DataTableView
          columns={[groupBy === "location" ? "Localização" : "Categoria", "Produtos", "Unidades", "Valor", "Participação"]}
          rows={(data ?? []).map((g) => [g.label, f.number(g.products), f.number(g.units), f.money(g.value), total ? f.ratio(g.value / total) : "—"])}
        />
      </Preview>
    </>
  );
}

function TopReport() {
  const f = useFormatters();
  const [period, setPeriod] = useState({ from: daysAgo(30), to: daysAgo(0) });
  const params = { ...range(period.from, period.to), limit: 20 };
  const { data, isLoading, error } = useQuery({
    queryKey: ["data", "report", "top", params],
    queryFn: () => analyticsApi.topProducts(params),
  });

  return (
    <>
      <FilterBar>
        <PeriodFields from={period.from} to={period.to} onChange={(from, to) => setPeriod({ from, to })} />
      </FilterBar>
      <ExportBar summary="Ranking por volume total movimentado (entradas + saídas + transferências + ajustes)." onExport={() => analyticsApi.exportTopProducts({ ...params, limit: 100 })} disabled={!data?.length} />
      <Preview loading={isLoading} error={error} empty={!data?.length}>
        <DataTableView
          columns={["#", "Produto", "Entradas", "Saídas", "Volume"]}
          rows={(data ?? []).map((t, i) => [
            i + 1,
            <span key="n" className="block max-w-72 truncate">
              {t.name}
            </span>,
            f.number(t.inUnits),
            f.number(t.outUnits),
            f.number(t.total),
          ])}
        />
      </Preview>
    </>
  );
}
