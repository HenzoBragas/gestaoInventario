import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  Boxes,
  CalendarClock,
  CircleDollarSign,
  CircleSlash,
  Package,
  Plus,
  RotateCw,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MovementTypeIcon } from "@/components/common/Badges";
import { ChartCard, DataTableView } from "@/components/common/ChartCard";
import { KpiCard } from "@/components/common/KpiCard";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState } from "@/components/common/States";
import { bucketize } from "@/features/dashboard/bucketize";
import { FlowChart, GroupBars, TopProductsBars, ValueChart } from "@/features/dashboard/charts";
import { useMovementDialog } from "@/features/movements/MovementDialog";
import { useDashboard } from "@/lib/api/hooks";
import type { AlertItem, Dashboard, Movement } from "@/lib/api/types";
import { useAuth } from "@/lib/auth-provider";
import { can, locationsOf, MOVEMENT_LABEL } from "@/lib/domain";
import { change, useFormatters, type Formatters } from "@/lib/format";
import { cn } from "@/lib/utils";

const PERIODS = [7, 30, 90, 180] as const;

export function DashboardPage() {
  const [days, setDays] = useState<number>(30);
  const { data, isLoading, isError, error, refetch, isFetching } = useDashboard(days);
  const { role } = useAuth();
  const { openMovement } = useMovementDialog();
  const f = useFormatters();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={
          data ? (
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
              Visão operacional do inventário · atualizado {f.relative(data.generatedAt)}
            </span>
          ) : (
            "Visão operacional do inventário."
          )
        }
        actions={
          <>
            <Tabs value={String(days)} onValueChange={(v) => setDays(Number(v))}>
              <TabsList aria-label="Período">
                {PERIODS.map((p) => (
                  <TabsTrigger key={p} value={String(p)} className="tabular px-3">
                    {p}d
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <Button variant="outline" size="icon" onClick={() => refetch()} aria-label="Atualizar dados" disabled={isFetching}>
              <RotateCw className={cn(isFetching && "animate-spin")} />
            </Button>
            {can(role, "movement:create") && (
              <Button onClick={() => openMovement()}>
                <Plus /> Movimentação
              </Button>
            )}
          </>
        }
      />

      {isError ? (
        <div className="rounded-xl border glass">
          <ErrorState error={error} onRetry={() => refetch()} />
        </div>
      ) : (
        <DashboardContent data={data} loading={isLoading} days={days} f={f} />
      )}
    </div>
  );
}

function DashboardContent({ data, loading, days, f }: { data?: Dashboard; loading: boolean; days: number; f: Formatters }) {
  const navigate = useNavigate();
  const buckets = useMemo(() => (data ? bucketize(data.series, f) : []), [data, f]);
  const weekly = (data?.series.length ?? 0) > 31;
  const k = data?.kpis;
  const periodLabel = `vs ${days} dias anteriores`;

  return (
    <>
      <section aria-label="Indicadores" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <KpiCard
          label="Produtos ativos"
          icon={Package}
          loading={loading}
          value={k && f.number(k.activeProducts)}
          hint={k && `SKUs distintos · ${f.number(k.inactiveProducts)} inativo(s)`}
          to="/products"
        />
        <KpiCard
          label="Unidades em estoque"
          icon={Boxes}
          loading={loading}
          value={k && f.number(k.totalUnits)}
          hint="Soma dos saldos em todas as localizações"
          to="/inventory"
        />
        <KpiCard
          label="Valor estimado"
          icon={CircleDollarSign}
          loading={loading}
          value={k && f.money(k.inventoryValue)}
          hint="Saldo × custo unitário atual"
          to="/reports"
        />
        <KpiCard
          label="Estoque baixo"
          icon={TriangleAlert}
          tone="warning"
          loading={loading}
          value={k && f.number(k.lowStock)}
          hint="No limite ou abaixo do mínimo"
          to="/inventory"
          search={{ status: "LOW_STOCK" }}
        />
        <KpiCard
          label="Sem estoque"
          icon={CircleSlash}
          tone="critical"
          loading={loading}
          value={k && f.number(k.outOfStock)}
          hint="Produtos ativos com saldo zero"
          to="/inventory"
          search={{ status: "OUT_OF_STOCK" }}
        />
        <KpiCard
          label={`Movimentações · ${days}d`}
          icon={ArrowLeftRight}
          loading={loading}
          value={k && f.number(k.movementCount)}
          delta={k ? { value: change(k.movementCount, k.previousMovementCount), label: periodLabel, positiveIsGood: null } : undefined}
          to="/movements"
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title="Entradas e saídas"
          description={weekly ? "Unidades por semana no período" : "Unidades por dia no período"}
          table={
            <DataTableView
              columns={[weekly ? "Semana" : "Dia", "Entradas", "Saídas"]}
              rows={buckets.map((b) => [b.label, f.number(b.inUnits), f.number(b.outUnits)])}
            />
          }
        >
          {loading ? <Skeleton className="h-64 w-full" /> : <FlowChart data={buckets} f={f} weekly={weekly} />}
        </ChartCard>

        <ChartCard title="Entradas × saídas" description={`Totais do período ${periodLabel}`}>
          {loading || !k ? <Skeleton className="h-64 w-full" /> : <FlowComparison k={k} f={f} periodLabel={periodLabel} />}
        </ChartCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title="Evolução do valor do estoque"
          description="Valor ao fim de cada dia, reconstruído a partir das movimentações e do custo unitário atual"
          table={
            <DataTableView columns={[weekly ? "Semana" : "Dia", "Valor"]} rows={buckets.map((b) => [b.label, f.money(b.inventoryValue)])} />
          }
        >
          {loading ? <Skeleton className="h-56 w-full" /> : <ValueChart data={buckets} f={f} />}
        </ChartCard>

        <Distribution data={data} loading={loading} f={f} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard title="Produtos mais movimentados" description="Volume de entradas e saídas no período">
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : data?.topProducts.length ? (
            <TopProductsBars data={data.topProducts} f={f} onSelect={(id) => navigate({ to: "/products/$productId", params: { productId: String(id) } })} />
          ) : (
            <EmptyState icon={ArrowLeftRight} title="Sem movimentações no período" className="py-8" />
          )}
        </ChartCard>

        <Alerts data={data} loading={loading} />
        <RecentActivity movements={data?.recentMovements} loading={loading} f={f} />
      </div>
    </>
  );
}

function FlowComparison({ k, f, periodLabel }: { k: Dashboard["kpis"]; f: Formatters; periodLabel: string }) {
  const max = Math.max(k.inUnits, k.outUnits, k.previousInUnits, k.previousOutUnits, 1);
  const net = k.inUnits - k.outUnits;
  const rows = [
    { label: "Entradas", current: k.inUnits, previous: k.previousInUnits, color: "bg-viz-in" },
    { label: "Saídas", current: k.outUnits, previous: k.previousOutUnits, color: "bg-viz-out" },
  ];
  return (
    <div className="flex h-full flex-col justify-between gap-6">
      <div className="space-y-5">
        {rows.map((r) => {
          const delta = change(r.current, r.previous);
          return (
            <div key={r.label}>
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-sm">{r.label}</span>
                <span className="tabular text-lg font-semibold">{f.number(r.current)} un.</span>
              </div>
              <div className="h-2.5 rounded-full bg-muted" aria-hidden="true">
                <div className={cn("h-2.5 rounded-full transition-[width] duration-700", r.color)} style={{ width: `${(r.current / max) * 100}%` }} />
              </div>
              <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="h-1 rounded-full bg-muted-foreground/40" style={{ width: `${Math.max(4, (r.previous / max) * 100)}%` }} aria-hidden="true" />
                <span className="tabular shrink-0">
                  Período anterior: {f.number(r.previous)}
                  {delta !== null && ` (${f.percent(delta)})`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="rounded-lg bg-surface-sunken p-3">
        <p className="text-xs text-muted-foreground">Saldo líquido do período</p>
        <p className={cn("tabular text-xl font-semibold", net < 0 ? "text-viz-out" : "text-viz-in")}>
          {net > 0 ? "+" : ""}
          {f.number(net)} un.
        </p>
        <p className="text-xs text-muted-foreground">
          {net < 0 ? "Saíram mais unidades do que entraram" : "Entraram mais unidades do que saíram"} · {periodLabel}
        </p>
      </div>
    </div>
  );
}

function Distribution({ data, loading, f }: { data?: Dashboard; loading: boolean; f: Formatters }) {
  const [by, setBy] = useState<"category" | "location">("location");
  const groups = by === "category" ? data?.byCategory : data?.byLocation;
  return (
    <ChartCard
      title="Distribuição do inventário"
      description="Valor em estoque a custo"
      actions={
        <Tabs value={by} onValueChange={(v) => setBy(v as typeof by)}>
          <TabsList className="h-8">
            <TabsTrigger value="location" className="text-xs">
              Localização
            </TabsTrigger>
            <TabsTrigger value="category" className="text-xs">
              Categoria
            </TabsTrigger>
          </TabsList>
        </Tabs>
      }
    >
      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : !groups?.length ? (
        <EmptyState icon={Boxes} title="Sem saldo para distribuir" className="py-8" />
      ) : groups.length === 1 ? (
        // Uma unica barra nao compara nada: mostra o numero.
        <div className="py-4">
          <p className="tabular text-2xl font-semibold">{f.money(groups[0].value)}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Todo o estoque está em <span className="font-medium text-foreground">{groups[0].label}</span> ({f.number(groups[0].products)}{" "}
            produtos, {f.number(groups[0].units)} un.).
          </p>
          {by === "category" && (
            <p className="mt-3 text-xs text-muted-foreground">
              Organize os produtos em mais categorias para comparar a distribuição.{" "}
              <Link to="/categories" className="font-medium text-primary hover:underline">
                Gerenciar categorias
              </Link>
            </p>
          )}
        </div>
      ) : (
        <GroupBars data={groups} f={f} metric="value" />
      )}
    </ChartCard>
  );
}

function Alerts({ data, loading }: { data?: Dashboard; loading: boolean }) {
  return (
    <section className="flex min-w-0 flex-col rounded-xl border glass" aria-label="Alertas operacionais">
      <header className="px-5 pt-4">
        <h2 className="text-sm font-semibold">Alertas operacionais</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">Itens que exigem atenção</p>
      </header>
      <div className="flex-1 px-5 pb-4 pt-3">
        {loading || !data ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <AlertGroup
              title="Sem estoque"
              tone="critical"
              total={data.kpis.outOfStock}
              items={data.outOfStockItems}
              status="OUT_OF_STOCK"
            />
            <AlertGroup title="Estoque baixo" tone="warning" total={data.kpis.lowStock} items={data.lowStockItems} status="LOW_STOCK" />
            <div className="space-y-1.5 border-t pt-3 text-xs text-muted-foreground">
              {data.kpis.productsWithoutCost > 0 && (
                <Link
                  to="/inventory"
                  search={{ missingCost: true } as never}
                  className="flex items-center gap-1.5 font-medium text-foreground hover:text-primary"
                >
                  <CircleDollarSign className="h-3.5 w-3.5 text-warning-foreground dark:text-warning" aria-hidden="true" />
                  {data.kpis.productsWithoutCost} produto(s) sem custo cadastrado (fora da valorização)
                </Link>
              )}
              <p>Controle de validade não habilitado: alertas de vencimento não se aplicam.</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function AlertGroup({
  title,
  tone,
  total,
  items,
  status,
}: {
  title: string;
  tone: "warning" | "critical";
  total: number;
  items: AlertItem[];
  status: "LOW_STOCK" | "OUT_OF_STOCK";
}) {
  const Icon = tone === "critical" ? CircleSlash : TriangleAlert;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <p className={cn("flex items-center gap-1.5 text-xs font-semibold", tone === "critical" ? "text-destructive" : "text-warning-foreground dark:text-warning")}>
          <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {title} ({total})
        </p>
        {total > 0 && (
          <Link to="/inventory" search={{ status } as never} className="text-xs font-medium text-primary hover:underline">
            Ver todos
          </Link>
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum produto nesta situação.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {items.slice(0, 4).map((item) => (
            <li key={item.productId}>
              <Link
                to="/products/$productId"
                params={{ productId: String(item.productId) }}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm transition-colors hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-none"
              >
                <span className="min-w-0">
                  <span className="block truncate">{item.name}</span>
                  <span className="block font-mono text-[11px] text-muted-foreground">{item.sku}</span>
                </span>
                <span className="tabular shrink-0 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{item.stock}</span> / mín. {item.minStock}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RecentActivity({ movements, loading, f }: { movements?: Movement[]; loading: boolean; f: Formatters }) {
  return (
    <section className="flex min-w-0 flex-col rounded-xl border glass" aria-label="Atividade recente">
      <header className="flex items-start justify-between gap-3 px-5 pt-4">
        <div>
          <h2 className="text-sm font-semibold">Atividade recente</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Últimas movimentações registradas</p>
        </div>
        <Link to="/movements" className="text-xs font-medium text-primary hover:underline">
          Histórico completo
        </Link>
      </header>
      <div className="flex-1 px-2 pb-2 pt-2">
        {loading ? (
          <div className="space-y-2 px-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        ) : !movements?.length ? (
          <EmptyState icon={ArrowLeftRight} title="Nenhuma movimentação ainda" className="py-8" />
        ) : (
          <ol className="space-y-0.5">
            {movements.map((m) => (
              <li key={m.id}>
                <Link
                  to="/movements"
                  search={{ movementId: m.id } as never}
                  className="flex items-start gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-none"
                >
                  <MovementTypeIcon type={m.type} className="mt-0.5 h-7 w-7" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[13px] font-medium">{m.productName}</span>
                      <span className={cn("tabular shrink-0 text-[13px] font-semibold", m.delta > 0 && "text-viz-in", m.delta < 0 && "text-viz-out")}>
                        {m.delta > 0 ? "+" : m.delta < 0 ? "−" : ""}
                        {f.number(m.quantity)} {m.unit}
                      </span>
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {MOVEMENT_LABEL[m.type]} · {locationsOf(m)} · {m.userDisplayName ?? m.username} · {f.dateTime(m.createdAt)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
