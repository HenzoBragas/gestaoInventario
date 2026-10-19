import { useCallback, useEffect, useState } from "react";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeftRight, ArrowRight, Download, Loader2, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { MovementTypeBadge } from "@/components/common/Badges";
import { DataTable, type Column } from "@/components/common/DataTable";
import { PageHeader } from "@/components/common/PageHeader";
import { Pagination } from "@/components/common/Pagination";
import { EmptyState, ErrorState } from "@/components/common/States";
import { useMovementDialog } from "@/features/movements/MovementDialog";
import { useLocations, useMovement, useMovements, useProduct } from "@/lib/api/hooks";
import { toApiError } from "@/lib/api/client";
import { movementsApi } from "@/lib/api/services";
import type { Movement, MovementQuery, MovementType } from "@/lib/api/types";
import { useAuth } from "@/lib/auth-provider";
import { can, locationsOf, MOVEMENT_LABEL } from "@/lib/domain";
import { useFormatters, type Formatters } from "@/lib/format";
import { usePersistedSearch, type MovementsSearch } from "@/lib/search";
import { cn } from "@/lib/utils";

const route = getRouteApi("/_app/movements");
const ALL = "__all__";

/** Datas do filtro (AAAA-MM-DD) para instantes: inicio do dia "de" ate o fim do dia "ate". */
function toRange(from?: string, to?: string) {
  const start = from ? new Date(`${from}T00:00:00`) : undefined;
  const end = to ? new Date(`${to}T00:00:00`) : undefined;
  if (end) end.setDate(end.getDate() + 1);
  return { from: start?.toISOString(), to: end?.toISOString() };
}

export function MovementsPage() {
  const search = route.useSearch();
  const navigate = useNavigate({ from: "/movements" });
  const f = useFormatters();
  const { role } = useAuth();
  const { openMovement } = useMovementDialog();
  const { data: locations } = useLocations();
  const { data: product } = useProduct(search.productId);
  const [text, setText] = useState(search.q ?? "");
  const [exporting, setExporting] = useState(false);

  const { movementId, ...filters } = search;
  const setSearch = useCallback(
    (patch: Partial<MovementsSearch>) => navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true }),
    [navigate],
  );
  usePersistedSearch("movements", filters, (saved) => setSearch(saved));

  useEffect(() => setText(search.q ?? ""), [search.q]);
  useEffect(() => {
    const value = text.trim() || undefined;
    if (value === search.q) return;
    const timer = window.setTimeout(() => setSearch({ q: value, page: 0 }), 300);
    return () => window.clearTimeout(timer);
  }, [text, search.q, setSearch]);

  const query: MovementQuery = {
    type: search.type,
    productId: search.productId,
    locationId: search.locationId,
    q: search.q,
    ...toRange(search.from, search.to),
    page: search.page ?? 0,
    size: search.size ?? 25,
  };
  const { data, isLoading, isError, error, refetch, isPlaceholderData } = useMovements(query);
  const hasFilters = Object.entries(filters).some(([k, v]) => v !== undefined && k !== "page" && k !== "size");

  async function exportCsv() {
    setExporting(true);
    try {
      const { page: _p, size: _s, ...rest } = query;
      toast.success(`Exportação concluída: ${await movementsApi.exportCsv(rest)}`);
    } catch (e) {
      toast.error(toApiError(e).message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Movimentações"
        description="Histórico auditável de entradas, saídas, transferências e ajustes. Registros não podem ser editados nem excluídos."
        actions={
          <>
            <Button variant="outline" onClick={exportCsv} disabled={exporting || !data?.totalItems}>
              {exporting ? <Loader2 className="animate-spin" /> : <Download />} Exportar CSV
            </Button>
            {can(role, "movement:create") && (
              <Button onClick={() => openMovement({ productId: search.productId })}>
                <Plus /> Nova movimentação
              </Button>
            )}
          </>
        }
      />

      <div className="space-y-3">
        <div className="flex flex-col gap-2 2xl:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              type="search"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Buscar por produto, SKU, referência ou usuário"
              aria-label="Buscar movimentações"
              className="pl-9"
            />
          </div>
          {/* Grade de 2 colunas ate telas largas: com a sidebar aberta, 4 campos fixos nao cabem em tablets. */}
          <div className="grid grid-cols-2 gap-2 2xl:flex">
            <Select value={search.type ?? ALL} onValueChange={(v) => setSearch({ type: v === ALL ? undefined : (v as MovementType), page: 0 })}>
              <SelectTrigger className="w-full 2xl:w-40" aria-label="Filtrar por tipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos os tipos</SelectItem>
                {(Object.keys(MOVEMENT_LABEL) as MovementType[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {MOVEMENT_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={search.locationId ? String(search.locationId) : ALL} onValueChange={(v) => setSearch({ locationId: v === ALL ? undefined : Number(v), page: 0 })}>
              <SelectTrigger className="w-full 2xl:w-48" aria-label="Filtrar por localização">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas as localizações</SelectItem>
                {(locations ?? []).map((l) => (
                  <SelectItem key={l.id} value={String(l.id)}>
                    {l.code} · {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={search.from ?? ""}
              max={search.to}
              onChange={(e) => setSearch({ from: e.target.value || undefined, page: 0 })}
              aria-label="Data inicial"
              className="w-full 2xl:w-40"
            />
            <Input
              type="date"
              value={search.to ?? ""}
              min={search.from}
              onChange={(e) => setSearch({ to: e.target.value || undefined, page: 0 })}
              aria-label="Data final"
              className="w-full 2xl:w-40"
            />
          </div>
        </div>
        {(search.productId || hasFilters) && (
          <div className="flex flex-wrap items-center gap-2">
            {search.productId && (
              <button
                type="button"
                onClick={() => setSearch({ productId: undefined, page: 0 })}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-primary bg-primary/10 px-3 text-xs font-medium text-primary"
              >
                Produto: {product ? `${product.sku} · ${product.name}` : `#${search.productId}`}
                <X className="h-3 w-3" aria-label="Remover filtro de produto" />
              </button>
            )}
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setSearch({ q: undefined, type: undefined, productId: undefined, locationId: undefined, from: undefined, to: undefined, page: 0 })}
              >
                <X /> Limpar filtros
              </Button>
            )}
          </div>
        )}
      </div>

      <section className="rounded-xl border glass" aria-label="Movimentações">
        <div className="border-b px-4 py-3 text-sm text-muted-foreground">{data ? `${f.number(data.totalItems)} movimentação(ões)` : "Carregando…"}</div>
        {isError ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : (
          <DataTable
            caption="Histórico de movimentações"
            columns={movementColumns(f)}
            rows={data?.items ?? []}
            rowKey={(m) => m.id}
            rowLabel={(m) => `movimentação ${m.id}`}
            loading={isLoading}
            refreshing={isPlaceholderData}
            onRowClick={(m) => setSearch({ movementId: m.id })}
            empty={
              <EmptyState
                icon={ArrowLeftRight}
                title={hasFilters ? "Nenhuma movimentação com esses filtros" : "Nenhuma movimentação registrada"}
                description={hasFilters ? "Amplie o período ou remova filtros." : "Registre a primeira entrada para começar o histórico."}
              />
            }
          />
        )}
        {data && data.totalItems > 0 && (
          <Pagination
            page={data.page}
            size={data.size}
            totalItems={data.totalItems}
            totalPages={data.totalPages}
            onPageChange={(page) => setSearch({ page })}
            onSizeChange={(size) => setSearch({ size, page: 0 })}
          />
        )}
      </section>

      <MovementDetailSheet id={movementId} onClose={() => setSearch({ movementId: undefined })} />
    </div>
  );
}

function movementColumns(f: Formatters): Column<Movement>[] {
  return [
    { id: "id", header: "ID", cell: (m) => <span className="font-mono text-xs text-muted-foreground">#{m.id}</span> },
    { id: "date", header: "Data e hora", cell: (m) => <span className="whitespace-nowrap text-xs">{f.dateTime(m.createdAt)}</span> },
    { id: "type", header: "Tipo", cell: (m) => <MovementTypeBadge type={m.type} /> },
    {
      id: "product",
      header: "Produto",
      className: "min-w-52 max-w-72",
      cell: (m) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{m.productName}</p>
          <p className="font-mono text-xs text-muted-foreground">{m.productSku}</p>
        </div>
      ),
    },
    {
      id: "quantity",
      header: "Quantidade",
      align: "right",
      cell: (m) => (
        <span className={cn("whitespace-nowrap font-semibold", m.delta > 0 && "text-viz-in", m.delta < 0 && "text-viz-out")}>
          {m.delta > 0 ? "+" : m.delta < 0 ? "−" : ""}
          {f.number(m.quantity)} <span className="text-xs font-normal text-muted-foreground">{m.unit}</span>
        </span>
      ),
    },
    { id: "location", header: "Localização", cell: (m) => <span className="whitespace-nowrap font-mono text-xs">{locationsOf(m)}</span> },
    {
      id: "balance",
      header: "Saldo total",
      align: "right",
      cell: (m) => (
        <span className="whitespace-nowrap text-xs">
          {f.number(m.totalBefore)} → <span className="font-semibold">{f.number(m.totalAfter)}</span>
        </span>
      ),
    },
    { id: "reason", header: "Motivo", cell: (m) => <span className="block max-w-44 truncate">{m.reason}</span> },
    { id: "user", header: "Usuário", cell: (m) => <span className="block max-w-40 truncate text-xs">{m.userDisplayName ?? m.username}</span> },
  ];
}

function MovementDetailSheet({ id, onClose }: { id?: number; onClose: () => void }) {
  const { data: m, isLoading, isError, error } = useMovement(id);
  const f = useFormatters();

  const balanceRow = (label: string, before: number | null, after: number | null) =>
    before === null || after === null ? null : (
      <div className="flex items-center justify-between py-2 text-sm">
        <dt className="text-muted-foreground">{label}</dt>
        <dd className="tabular flex items-center gap-2 font-medium">
          {f.number(before)} <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-label="para" /> {f.number(after)}
        </dd>
      </div>
    );

  return (
    <Sheet open={Boolean(id)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="text-left">
          <SheetTitle>Movimentação #{id}</SheetTitle>
          <SheetDescription>Registro de auditoria (somente leitura).</SheetDescription>
        </SheetHeader>
        {isLoading ? (
          <div className="mt-6 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState error={error} />
        ) : m ? (
          <div className="mt-6 space-y-6">
            <div className="flex items-center justify-between gap-3">
              <MovementTypeBadge type={m.type} />
              <span className={cn("tabular text-2xl font-semibold", m.delta > 0 && "text-viz-in", m.delta < 0 && "text-viz-out")}>
                {m.delta > 0 ? "+" : m.delta < 0 ? "−" : ""}
                {f.number(m.quantity)} <span className="text-sm font-normal text-muted-foreground">{m.unit}</span>
              </span>
            </div>
            <Link
              to="/products/$productId"
              params={{ productId: String(m.productId) }}
              className="block rounded-lg border p-3 transition-colors hover:border-primary/40"
            >
              <p className="font-medium">{m.productName}</p>
              <p className="font-mono text-xs text-muted-foreground">{m.productSku}</p>
            </Link>
            <section>
              <h3 className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Saldos</h3>
              <dl className="divide-y">
                {balanceRow(`Origem${m.fromLocationCode ? ` · ${m.fromLocationCode}` : ""}`, m.fromBefore, m.fromAfter)}
                {balanceRow(`Destino${m.toLocationCode ? ` · ${m.toLocationCode}` : ""}`, m.toBefore, m.toAfter)}
                {balanceRow("Total do produto", m.totalBefore, m.totalAfter)}
              </dl>
            </section>
            <section>
              <h3 className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Registro</h3>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Data e hora</dt>
                <dd className="text-right">{f.dateTime(m.createdAt)}</dd>
                <dt className="text-muted-foreground">Responsável</dt>
                <dd className="text-right">
                  {m.userDisplayName ?? m.username} <span className="text-xs text-muted-foreground">({m.username})</span>
                </dd>
                <dt className="text-muted-foreground">Origem</dt>
                <dd className="text-right">{m.fromLocationName ?? "—"}</dd>
                <dt className="text-muted-foreground">Destino</dt>
                <dd className="text-right">{m.toLocationName ?? "—"}</dd>
                <dt className="text-muted-foreground">Motivo</dt>
                <dd className="text-right">{m.reason}</dd>
                <dt className="text-muted-foreground">Referência</dt>
                <dd className="text-right">{m.reference ?? "—"}</dd>
              </dl>
              {m.notes && <p className="mt-3 whitespace-pre-line rounded-lg bg-muted p-3 text-sm">{m.notes}</p>}
            </section>
            <p className="text-xs text-muted-foreground">
              {MOVEMENT_LABEL[m.type]} registrada de forma imutável. Para corrigir, registre um ajuste de inventário.
            </p>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
