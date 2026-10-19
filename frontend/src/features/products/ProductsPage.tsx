import { useCallback, useEffect, useMemo, useState } from "react";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { CircleCheck, CircleOff, Download, Eye, Loader2, MoreHorizontal, Package, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/common/Badges";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataTable, type Column } from "@/components/common/DataTable";
import { useHiddenColumns } from "@/hooks/use-hidden-columns";
import { PageHeader } from "@/components/common/PageHeader";
import { Pagination } from "@/components/common/Pagination";
import { EmptyState, ErrorState } from "@/components/common/States";
import { ColumnToggle } from "@/features/inventory/InventoryPage";
import { ProductFilters } from "@/features/inventory/ProductFilters";
import { ProductFormSheet } from "@/features/products/ProductFormSheet";
import { keys, useApiMutation, useProducts } from "@/lib/api/hooks";
import { toApiError } from "@/lib/api/client";
import { productsApi } from "@/lib/api/services";
import type { Product } from "@/lib/api/types";
import { useAuth } from "@/lib/auth-provider";
import { csvDecimal, downloadCsv } from "@/lib/csv";
import { can } from "@/lib/domain";
import { useFormatters, type Formatters } from "@/lib/format";
import { toProductQuery, usePersistedSearch, type ProductsSearch } from "@/lib/search";

const route = getRouteApi("/_app/products/");

type Confirm =
  | { kind: "status"; products: Product[]; active: boolean }
  | { kind: "delete"; product: Product }
  | null;

export function ProductsPage() {
  const search = route.useSearch();
  const navigate = useNavigate({ from: "/products/" });
  const queryClient = useQueryClient();
  const f = useFormatters();
  const { role } = useAuth();
  const canWrite = can(role, "catalog:write");
  const query = toProductQuery(search);
  const { data, isLoading, isError, error, refetch, isPlaceholderData } = useProducts(query);
  const [selected, setSelected] = useState<Set<number | string>>(new Set());
  const [hidden, setHidden] = useHiddenColumns("products", ["createdAt"]);
  const [editing, setEditing] = useState<Product | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [exporting, setExporting] = useState(false);

  const { new: openNew, ...filters } = search;
  const setSearch = useCallback(
    (patch: Partial<ProductsSearch>) => navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true }),
    [navigate],
  );
  usePersistedSearch("products", filters, (saved) => setSearch(saved));

  // ?new=true (busca global, atalhos) abre o cadastro.
  useEffect(() => {
    if (openNew && canWrite) {
      setEditing(null);
      setFormOpen(true);
      setSearch({ new: undefined });
    }
  }, [openNew, canWrite, setSearch]);

  const remove = useApiMutation((p: Product) => productsApi.remove(p.id), {
    success: (_, p) => `Produto ${p.sku} excluído.`,
  });

  async function changeStatus(products: Product[], active: boolean) {
    // Sequencial: cada alteracao e auditada individualmente no servidor.
    let ok = 0;
    for (const p of products) {
      try {
        await productsApi.setActive(p.id, active);
        ok++;
      } catch (e) {
        toast.error(`${p.sku}: ${toApiError(e).message}`);
      }
    }
    await queryClient.invalidateQueries({ queryKey: keys.data });
    setSelected(new Set());
    if (ok) toast.success(`${ok} produto(s) ${active ? "reativado(s)" : "desativado(s)"}.`);
  }

  const openDetail = useCallback(
    (id: number) => navigate({ to: "/products/$productId", params: { productId: String(id) } }),
    [navigate],
  );

  const columns = useMemo(
    () =>
      productColumns(f, canWrite, {
        view: (p) => openDetail(p.id),
        edit: (p) => {
          setEditing(p);
          setFormOpen(true);
        },
        status: (p) => setConfirm({ kind: "status", products: [p], active: !p.active }),
        remove: (p) => setConfirm({ kind: "delete", product: p }),
      }),
    [f, canWrite, openDetail],
  );

  const rows = data?.items ?? [];
  const selectedRows = rows.filter((r) => selected.has(r.id));

  async function exportFiltered() {
    setExporting(true);
    try {
      const { page: _p, size: _s, ...rest } = query;
      toast.success(`Exportação concluída: ${await productsApi.exportCsv(rest)}`);
    } catch (e) {
      toast.error(toApiError(e).message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Produtos"
        description="Catálogo de produtos: identificação, classificação, custos e status."
        actions={
          <>
            <Button variant="outline" onClick={exportFiltered} disabled={exporting || !data?.totalItems}>
              {exporting ? <Loader2 className="animate-spin" /> : <Download />} Exportar CSV
            </Button>
            {canWrite && (
              <Button
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <Plus /> Novo produto
              </Button>
            )}
          </>
        }
      />

      <ProductFilters search={filters} onChange={setSearch} show={{ supplier: true }} />

      <section className="rounded-xl border bg-card shadow-xs" aria-label="Produtos">
        <div className="flex min-h-12 flex-wrap items-center justify-between gap-2 border-b px-4 py-2">
          {selected.size > 0 ? (
            <div className="flex flex-wrap items-center gap-2 text-sm" role="status">
              <span className="font-medium">{selected.size} selecionado(s)</span>
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() =>
                  downloadCsv(
                    `produtos-selecionados-${new Date().toISOString().slice(0, 10)}.csv`,
                    ["SKU", "Produto", "Categoria", "Fornecedor", "Unidade", "Custo unitário", "Preço de venda", "Estoque mínimo", "Ativo"],
                    selectedRows.map((p) => [p.sku, p.name, p.categoryName, p.supplierName, p.unit, csvDecimal(p.unitCost), csvDecimal(p.salePrice), p.minStock, p.active ? "Sim" : "Não"]),
                  )
                }
                disabled={!selectedRows.length}
              >
                <Download /> Exportar
              </Button>
              {canWrite && (
                <>
                  <Button size="sm" variant="outline" className="h-8" onClick={() => setConfirm({ kind: "status", products: selectedRows, active: false })} disabled={!selectedRows.some((p) => p.active)}>
                    <CircleOff /> Desativar
                  </Button>
                  <Button size="sm" variant="outline" className="h-8" onClick={() => setConfirm({ kind: "status", products: selectedRows, active: true })} disabled={!selectedRows.some((p) => !p.active)}>
                    <CircleCheck /> Reativar
                  </Button>
                </>
              )}
              <Button size="sm" variant="ghost" className="h-8" onClick={() => setSelected(new Set())}>
                <X /> Limpar
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{data ? `${f.number(data.totalItems)} produto(s)` : "Carregando…"}</p>
          )}
          <ColumnToggle columns={columns} hidden={hidden} onChange={setHidden} />
        </div>

        {isError ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : (
          <DataTable
            caption="Produtos cadastrados"
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
            onRowClick={(p) => openDetail(p.id)}
            empty={
              <EmptyState
                icon={Package}
                title={Object.values(filters).some((v) => v !== undefined) ? "Nenhum produto encontrado" : "Nenhum produto cadastrado"}
                description="Cadastre produtos para começar a controlar o estoque."
                action={
                  canWrite && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setEditing(null);
                        setFormOpen(true);
                      }}
                    >
                      <Plus /> Novo produto
                    </Button>
                  )
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

      <ProductFormSheet open={formOpen} onOpenChange={setFormOpen} product={editing} />

      <ConfirmDialog
        open={confirm?.kind === "status"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={confirm?.kind === "status" && confirm.active ? "Reativar produto(s)?" : "Desativar produto(s)?"}
        description={
          confirm?.kind === "status" &&
          (confirm.active
            ? `${confirm.products.length} produto(s) voltarão a aceitar movimentações.`
            : `${confirm.products.length} produto(s) deixarão de aceitar movimentações. O histórico e o saldo são preservados.`)
        }
        confirmLabel={confirm?.kind === "status" && confirm.active ? "Reativar" : "Desativar"}
        destructive={confirm?.kind === "status" && !confirm.active}
        onConfirm={() => (confirm?.kind === "status" ? changeStatus(confirm.products, confirm.active) : undefined)}
      />
      <ConfirmDialog
        open={confirm?.kind === "delete"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Excluir produto?"
        description={
          confirm?.kind === "delete" && (
            <>
              <p>
                <span className="font-medium text-foreground">{confirm.product.name}</span> será excluído permanentemente.
              </p>
              <p className="mt-2">A exclusão só é permitida para produtos sem saldo e sem movimentações. Caso contrário, desative o produto.</p>
            </>
          )
        }
        confirmLabel="Excluir"
        destructive
        onConfirm={() => (confirm?.kind === "delete" ? remove.mutateAsync(confirm.product) : undefined)}
      />
    </div>
  );
}

function productColumns(
  f: Formatters,
  canWrite: boolean,
  actions: { view: (p: Product) => void; edit: (p: Product) => void; status: (p: Product) => void; remove: (p: Product) => void },
): Column<Product>[] {
  return [
    { id: "sku", header: "SKU", sortKey: "sku", fixed: true, cell: (p) => <span className="font-mono text-xs">{p.sku}</span> },
    {
      id: "name",
      header: "Produto",
      sortKey: "name",
      fixed: true,
      className: "min-w-56 max-w-80",
      cell: (p) => (
        <p className="truncate font-medium" title={p.name}>
          {p.name}
        </p>
      ),
    },
    { id: "category", header: "Categoria", sortKey: "category", cell: (p) => p.categoryName ?? "—" },
    { id: "supplier", header: "Fornecedor", cell: (p) => <span className="block max-w-48 truncate">{p.supplierName ?? "—"}</span> },
    { id: "unit", header: "Unid.", cell: (p) => <span className="font-mono text-xs">{p.unit}</span> },
    { id: "unitCost", header: "Custo", sortKey: "unitCost", align: "right", cell: (p) => f.money(p.unitCost) },
    { id: "salePrice", header: "Preço", align: "right", cell: (p) => (p.salePrice != null ? f.money(p.salePrice) : "—") },
    { id: "minStock", header: "Mín.", sortKey: "minStock", align: "right", cell: (p) => f.number(p.minStock) },
    { id: "status", header: "Status", cell: (p) => <StatusBadge status={p.status} /> },
    { id: "createdAt", header: "Criado em", sortKey: "createdAt", cell: (p) => <span className="text-xs text-muted-foreground">{f.date(p.createdAt)}</span> },
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
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onSelect={() => actions.view(p)}>
              <Eye /> Ver detalhes
            </DropdownMenuItem>
            {canWrite && (
              <>
                <DropdownMenuItem onSelect={() => actions.edit(p)}>
                  <Pencil /> Editar
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => actions.status(p)}>
                  {p.active ? <CircleOff /> : <CircleCheck />} {p.active ? "Desativar" : "Reativar"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => actions.remove(p)} className="text-destructive focus:text-destructive">
                  <Trash2 /> Excluir
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];
}
