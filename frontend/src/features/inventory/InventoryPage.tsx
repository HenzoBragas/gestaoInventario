import { useCallback, useMemo, useState } from "react";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Boxes, Columns3, Download, Eye, Loader2, MoreHorizontal, Plus, SlidersHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { StatusBadge } from "@/components/common/Badges";
import { DataTable, type Column } from "@/components/common/DataTable";
import { useHiddenColumns } from "@/hooks/use-hidden-columns";
import { PageHeader } from "@/components/common/PageHeader";
import { Pagination } from "@/components/common/Pagination";
import { EmptyState, ErrorState } from "@/components/common/States";
import { ProductFilters } from "@/features/inventory/ProductFilters";
import { useMovementDialog } from "@/features/movements/MovementDialog";
import { useProducts } from "@/lib/api/hooks";
import { productsApi } from "@/lib/api/services";
import type { Product } from "@/lib/api/types";
import { useAuth } from "@/lib/auth-provider";
import { csvDecimal, downloadCsv } from "@/lib/csv";
import { can, STATUS_LABEL } from "@/lib/domain";
import { useFormatters, type Formatters } from "@/lib/format";
import { toProductQuery, usePersistedSearch, type InventorySearch } from "@/lib/search";

const route = getRouteApi("/_app/inventory");

export function InventoryPage() {
  const search = route.useSearch();
  const navigate = useNavigate({ from: "/inventory" });
  const f = useFormatters();
  const { role } = useAuth();
  const { openMovement } = useMovementDialog();
  const query = toProductQuery(search);
  const { data, isLoading, isError, error, refetch, isPlaceholderData } = useProducts(query);
  const [selected, setSelected] = useState<Set<number | string>>(new Set());
  const [hidden, setHidden] = useHiddenColumns("inventory", ["minStock", "unitCost", "updatedAt"]);
  const [exporting, setExporting] = useState(false);

  const setSearch = useCallback(
    (patch: Partial<InventorySearch>) => navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true }),
    [navigate],
  );
  usePersistedSearch("inventory", search, (saved) => setSearch(saved));

  const canMove = can(role, "movement:create");
  const columns = useMemo(() => inventoryColumns(f, canMove, can(role, "movement:adjust"), openMovement, (id) => navigate({ to: "/products/$productId", params: { productId: String(id) } })), [f, canMove, role, openMovement, navigate]);

  const rows = data?.items ?? [];
  const selectedRows = rows.filter((r) => selected.has(r.id));

  async function exportFiltered() {
    setExporting(true);
    try {
      const { page: _page, size: _size, ...filters } = query;
      const filename = await productsApi.exportCsv(filters);
      toast.success(`Exportação concluída: ${filename}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setExporting(false);
    }
  }

  function exportSelected() {
    downloadCsv(
      `inventario-selecionados-${new Date().toISOString().slice(0, 10)}.csv`,
      ["SKU", "Produto", "Categoria", "Localizações", "Unidade", "Quantidade", "Estoque mínimo", "Custo unitário", "Valor em estoque", "Status"],
      selectedRows.map((p) => [
        p.sku,
        p.name,
        p.categoryName,
        p.locations.map((l) => `${l.code}: ${l.quantity}`).join(", "),
        p.unit,
        p.stock,
        p.minStock,
        csvDecimal(p.unitCost),
        csvDecimal(p.stockValue),
        STATUS_LABEL[p.status],
      ]),
    );
    toast.success(`${selectedRows.length} item(ns) exportado(s).`);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventário"
        description="Posição de estoque por produto e localização. Valores a custo unitário atual."
        actions={
          <>
            <Button variant="outline" onClick={exportFiltered} disabled={exporting || !data?.totalItems}>
              {exporting ? <Loader2 className="animate-spin" /> : <Download />} Exportar CSV
            </Button>
            {canMove && (
              <Button onClick={() => openMovement()}>
                <Plus /> Movimentação
              </Button>
            )}
          </>
        }
      />

      <ProductFilters search={search} onChange={setSearch} show={{ location: true }} />

      <section className="rounded-xl border glass" aria-label="Itens do inventário">
        <div className="flex min-h-12 flex-wrap items-center justify-between gap-2 border-b px-4 py-2">
          {selected.size > 0 ? (
            <div className="flex flex-wrap items-center gap-2 text-sm" role="status">
              <span className="font-medium">{selected.size} selecionado(s)</span>
              <Button size="sm" variant="outline" className="h-8" onClick={exportSelected} disabled={!selectedRows.length}>
                <Download /> Exportar selecionados
              </Button>
              <Button size="sm" variant="ghost" className="h-8" onClick={() => setSelected(new Set())}>
                <X /> Limpar seleção
              </Button>
              {selectedRows.length < selected.size && (
                <span className="text-xs text-muted-foreground">({selected.size - selectedRows.length} em outras páginas)</span>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {data ? `${f.number(data.totalItems)} produto(s) encontrados` : "Carregando…"}
            </p>
          )}
          <ColumnToggle columns={columns} hidden={hidden} onChange={setHidden} />
        </div>

        {isError ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : (
          <DataTable
            caption="Itens do inventário"
            columns={columns}
            rows={rows}
            rowKey={(p) => p.id}
            rowLabel={(p) => `${p.sku} ${p.name}`}
            loading={isLoading}
            refreshing={isPlaceholderData}
            sort={{ key: query.sort!, direction: query.direction! }}
            onSort={(s) => setSearch({ sort: s.key, dir: s.direction, page: 0 })}
            hiddenColumns={hidden}
            selectable
            selected={selected}
            onSelectedChange={setSelected}
            onRowClick={(p) => navigate({ to: "/products/$productId", params: { productId: String(p.id) } })}
            empty={
              <EmptyState
                icon={Boxes}
                title="Nenhum produto corresponde aos filtros"
                description="Ajuste a busca ou remova filtros para ver mais itens."
                action={
                  <Button variant="outline" size="sm" onClick={() => setSearch({ q: undefined, categoryId: undefined, locationId: undefined, status: undefined, missingCost: undefined, page: 0 })}>
                    Limpar filtros
                  </Button>
                }
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
    </div>
  );
}

function inventoryColumns(
  f: Formatters,
  canMove: boolean,
  canAdjust: boolean,
  openMovement: ReturnType<typeof useMovementDialog>["openMovement"],
  openDetail: (id: number) => void,
): Column<Product>[] {
  return [
    {
      id: "sku",
      header: "SKU",
      sortKey: "sku",
      fixed: true,
      cell: (p) => <span className="font-mono text-xs">{p.sku}</span>,
    },
    {
      id: "name",
      header: "Produto",
      sortKey: "name",
      fixed: true,
      className: "min-w-56 max-w-80",
      cell: (p) => (
        <div className="min-w-0">
          <p className="truncate font-medium" title={p.name}>
            {p.name}
          </p>
          {p.model && p.model !== "Sem modelo" && <p className="truncate text-xs text-muted-foreground">{p.model}</p>}
        </div>
      ),
    },
    { id: "category", header: "Categoria", sortKey: "category", cell: (p) => p.categoryName ?? "—" },
    {
      id: "locations",
      header: "Localização",
      className: "min-w-36",
      cell: (p) =>
        p.locations.length === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {p.locations.slice(0, 2).map((l) => (
              <Tooltip key={l.locationId}>
                <TooltipTrigger asChild>
                  <span className="tabular whitespace-nowrap rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                    {l.code}: {l.quantity}
                  </span>
                </TooltipTrigger>
                <TooltipContent>{l.name}</TooltipContent>
              </Tooltip>
            ))}
            {p.locations.length > 2 && <span className="text-xs text-muted-foreground">+{p.locations.length - 2}</span>}
          </div>
        ),
    },
    {
      id: "stock",
      header: "Disponível",
      sortKey: "stock",
      align: "right",
      cell: (p) => (
        <span className="whitespace-nowrap">
          <span className="font-semibold">{f.number(p.stock)}</span> <span className="text-xs text-muted-foreground">{p.unit}</span>
        </span>
      ),
    },
    { id: "minStock", header: "Mínimo", sortKey: "minStock", align: "right", cell: (p) => f.number(p.minStock) },
    { id: "unitCost", header: "Custo unit.", sortKey: "unitCost", align: "right", cell: (p) => f.money(p.unitCost) },
    { id: "value", header: "Valor total", sortKey: "value", align: "right", cell: (p) => <span className="font-medium">{f.money(p.stockValue)}</span> },
    { id: "status", header: "Status", cell: (p) => <StatusBadge status={p.status} /> },
    { id: "updatedAt", header: "Atualizado", sortKey: "updatedAt", cell: (p) => <span className="whitespace-nowrap text-xs text-muted-foreground">{f.dateTime(p.updatedAt)}</span> },
    {
      id: "actions",
      header: "Ações",
      fixed: true,
      align: "right",
      cell: (p) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Ações para ${p.name}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onSelect={() => openDetail(p.id)}>
              <Eye /> Ver detalhes
            </DropdownMenuItem>
            {canMove && p.active && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => openMovement({ type: "IN", productId: p.id })}>
                  <ArrowDownLeft /> Registrar entrada
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => openMovement({ type: "OUT", productId: p.id })} disabled={p.stock === 0}>
                  <ArrowUpRight /> Registrar saída
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => openMovement({ type: "TRANSFER", productId: p.id })} disabled={p.stock === 0}>
                  <ArrowLeftRight /> Transferir
                </DropdownMenuItem>
                {canAdjust && (
                  <DropdownMenuItem onSelect={() => openMovement({ type: "ADJUSTMENT", productId: p.id })}>
                    <SlidersHorizontal /> Ajustar inventário
                  </DropdownMenuItem>
                )}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];
}

export function ColumnToggle<T>({ columns, hidden, onChange }: { columns: Column<T>[]; hidden: string[]; onChange: (hidden: string[]) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8">
          <Columns3 /> Colunas
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Colunas visíveis</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns
          .filter((c) => !c.fixed)
          .map((c) => (
            <DropdownMenuCheckboxItem
              key={c.id}
              checked={!hidden.includes(c.id)}
              onCheckedChange={(checked) => onChange(checked ? hidden.filter((h) => h !== c.id) : [...hidden, c.id])}
              onSelect={(e) => e.preventDefault()}
            >
              {c.header}
            </DropdownMenuCheckboxItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
