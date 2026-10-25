import { useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  CircleCheck,
  CircleOff,
  History,
  ImageOff,
  PackageX,
  Pencil,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { MovementTypeBadge, StatusBadge } from "@/components/common/Badges";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Pagination } from "@/components/common/Pagination";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common/States";
import { useMovementDialog } from "@/features/movements/MovementDialog";
import { ProductInvoicesCard } from "@/features/invoices/InvoicesPage";
import { ProductFormSheet } from "@/features/products/ProductFormSheet";
import { useApiMutation, useLocations, useProduct, useProductMovements } from "@/lib/api/hooks";
import { productsApi } from "@/lib/api/services";
import type { Product } from "@/lib/api/types";
import { useAuth } from "@/lib/auth-provider";
import { can, locationsOf } from "@/lib/domain";
import { useFormatters, type Formatters } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ProductDetailPage() {
  const { productId } = useParams({ from: "/_app/products/$productId" });
  const id = Number(productId);
  const { data: product, isLoading, isError, error, refetch } = useProduct(id);
  const f = useFormatters();
  const { role } = useAuth();
  const { openMovement } = useMovementDialog();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState(false);

  const status = useApiMutation((active: boolean) => productsApi.setActive(id, active), {
    success: (p) => (p.active ? "Produto reativado." : "Produto desativado."),
  });

  if (isError) {
    return (
      <div className="rounded-xl border glass">
        {error?.status === 404 ? (
          <EmptyState
            icon={PackageX}
            title="Produto não encontrado"
            description="O produto pode ter sido excluído."
            action={
              <Button asChild variant="outline" size="sm">
                <Link to="/products">Voltar para produtos</Link>
              </Button>
            }
          />
        ) : (
          <ErrorState error={error} onRetry={() => refetch()} />
        )}
      </div>
    );
  }

  const canMove = can(role, "movement:create") && product?.active;
  const canWrite = can(role, "catalog:write");

  return (
    <div className="space-y-6">
      <div>
        <Link to="/inventory" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Inventário
        </Link>
        {isLoading || !product ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-80" />
            <Skeleton className="h-4 w-48" />
          </div>
        ) : (
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>
                <StatusBadge status={product.status} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                <span className="font-mono">{product.sku}</span>
                {product.model !== "Sem modelo" && ` · ${product.model}`} · {product.categoryName}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 lg:shrink-0 lg:flex-nowrap">
              {canWrite && (
                <>
                  <Button variant="outline" onClick={() => setConfirmStatus(true)}>
                    {product.active ? <CircleOff /> : <CircleCheck />} {product.active ? "Desativar" : "Reativar"}
                  </Button>
                  <Button variant="outline" onClick={() => setEditOpen(true)}>
                    <Pencil /> Editar cadastro
                  </Button>
                </>
              )}
              {canMove && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button>
                      Movimentar <ChevronDown />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem onSelect={() => openMovement({ type: "IN", productId: id })}>
                      <ArrowDownLeft /> Entrada
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => openMovement({ type: "OUT", productId: id })} disabled={!product.stock}>
                      <ArrowUpRight /> Saída
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => openMovement({ type: "TRANSFER", productId: id })} disabled={!product.stock}>
                      <ArrowLeftRight /> Transferência
                    </DropdownMenuItem>
                    {can(role, "movement:adjust") && (
                      <DropdownMenuItem onSelect={() => openMovement({ type: "ADJUSTMENT", productId: id })}>
                        <SlidersHorizontal /> Ajuste de inventário
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        )}
      </div>

      {product && !product.active && (
        <p className="rounded-lg border border-border bg-muted px-4 py-3 text-sm text-muted-foreground" role="status">
          Este produto está inativo: o saldo e o histórico são preservados, mas ele não aceita novas movimentações.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Disponível" loading={!product} value={product && `${f.number(product.stock)} ${product.unit}`} hint={product && `Mínimo: ${f.number(product.minStock)} ${product.unit}`} />
        <Stat label="Valor em estoque" loading={!product} value={product && f.money(product.stockValue)} hint="Saldo × custo unitário" />
        <Stat label="Custo unitário" loading={!product} value={product && f.money(product.unitCost)} hint={product && marginHint(product, f)} />
        <Stat label="Localizações com saldo" loading={!product} value={product && f.number(product.locations.filter((l) => l.quantity > 0).length)} hint={product?.defaultLocationName ? `Padrão: ${product.defaultLocationName}` : "Sem localização padrão"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4">
          <BalancesCard product={product} f={f} canMove={Boolean(canMove)} onTransfer={(locationId) => openMovement({ type: "TRANSFER", productId: id, locationId })} />
          <DetailsCard product={product} f={f} />
          <ProductInvoicesCard productId={id} canWrite={can(role, "catalog:write")} f={f} />
        </div>
        <HistoryCard productId={id} f={f} />
      </div>

      {product && <ProductFormSheet open={editOpen} onOpenChange={setEditOpen} product={product} />}
      <ConfirmDialog
        open={confirmStatus}
        onOpenChange={setConfirmStatus}
        title={product?.active ? "Desativar produto?" : "Reativar produto?"}
        description={
          product?.active
            ? "O produto deixará de aceitar movimentações. Saldo e histórico são preservados."
            : "O produto voltará a aceitar movimentações."
        }
        confirmLabel={product?.active ? "Desativar" : "Reativar"}
        destructive={product?.active}
        onConfirm={() => status.mutateAsync(!product?.active)}
      />
    </div>
  );
}

function marginHint(p: Product, f: Formatters) {
  if (p.salePrice == null) return "Sem preço de venda";
  if (!p.unitCost) return `Venda: ${f.money(p.salePrice)}`;
  return `Venda: ${f.money(p.salePrice)} · margem ${f.ratio((p.salePrice - p.unitCost) / p.salePrice)}`;
}

function Stat({ label, value, hint, loading }: { label: string; value?: string | null | false; hint?: string | null | false; loading: boolean }) {
  return (
    <div className="rounded-xl border glass p-4">
      <p className="text-[13px] text-muted-foreground">{label}</p>
      {loading ? <Skeleton className="mt-2 h-7 w-28" /> : <p className="tabular mt-1 text-xl font-semibold">{value}</p>}
      {!loading && hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function BalancesCard({ product, f, canMove, onTransfer }: { product?: Product; f: Formatters; canMove: boolean; onTransfer: (locationId: number) => void }) {
  const { data: locations } = useLocations();
  return (
    <section className="rounded-xl border glass" aria-label="Saldos por localização">
      <header className="border-b px-5 py-3.5">
        <h2 className="text-sm font-semibold">Saldos por localização</h2>
      </header>
      {!product ? (
        <div className="space-y-2 p-5">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
        </div>
      ) : product.locations.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted-foreground">Ainda não há saldo registrado em nenhuma localização.</p>
      ) : (
        <ul className="divide-y">
          {product.locations.map((l) => {
            const share = product.stock ? l.quantity / product.stock : 0;
            const inactive = locations?.find((x) => x.id === l.locationId)?.active === false;
            return (
              <li key={l.locationId} className="px-5 py-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0">
                    <span className="font-mono text-xs">{l.code}</span> <span className="text-muted-foreground">· {l.name}</span>
                    {inactive && <span className="ml-1 text-xs text-muted-foreground">(inativa)</span>}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="tabular font-semibold">
                      {f.number(l.quantity)} <span className="text-xs font-normal text-muted-foreground">{product.unit}</span>
                    </span>
                    {canMove && l.quantity > 0 && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onTransfer(l.locationId)} aria-label={`Transferir de ${l.code}`}>
                        <ArrowLeftRight className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-muted" aria-hidden="true">
                  <div className="h-1.5 rounded-full bg-viz-value" style={{ width: `${share * 100}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function DetailsCard({ product, f }: { product?: Product; f: Formatters }) {
  const [imageFailed, setImageFailed] = useState(false);
  const rows: [string, string | null | undefined][] = product
    ? [
        ["Fornecedor", product.supplierName],
        ["Unidade", product.unit],
        ["Código de barras", product.barcode],
        ["Preço de venda", product.salePrice != null ? f.money(product.salePrice) : null],
        ["Cadastrado em", f.date(product.createdAt)],
        ["Última atualização", f.dateTime(product.updatedAt)],
      ]
    : [];
  return (
    <section className="rounded-xl border glass" aria-label="Dados do cadastro">
      <header className="border-b px-5 py-3.5">
        <h2 className="text-sm font-semibold">Dados do cadastro</h2>
      </header>
      <div className="space-y-4 p-5">
        {product?.imageUrl && (
          <div className="grid aspect-video place-items-center overflow-hidden rounded-lg border bg-muted">
            {imageFailed ? (
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <ImageOff className="h-4 w-4" /> Imagem indisponível
              </span>
            ) : (
              <img src={product.imageUrl} alt={product.name} className="h-full w-full object-contain" loading="lazy" onError={() => setImageFailed(true)} />
            )}
          </div>
        )}
        {!product ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            {rows.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="min-w-0 truncate text-right">{value || "—"}</dd>
              </div>
            ))}
          </dl>
        )}
        {product?.description && <p className="whitespace-pre-line border-t pt-3 text-sm text-muted-foreground">{product.description}</p>}
      </div>
    </section>
  );
}

function HistoryCard({ productId, f }: { productId: number; f: Formatters }) {
  const [page, setPage] = useState(0);
  const { data, isLoading, isError, error, refetch, isPlaceholderData } = useProductMovements(productId, page);
  return (
    <section className="rounded-xl border glass xl:col-span-2" aria-label="Histórico de movimentações">
      <header className="flex items-center justify-between border-b px-5 py-3.5">
        <h2 className="text-sm font-semibold">Histórico de movimentações</h2>
        <Link to="/movements" search={{ productId } as never} className="text-xs font-medium text-primary hover:underline">
          Abrir em Movimentações
        </Link>
      </header>
      {isLoading ? (
        <TableSkeleton rows={6} columns={5} />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : !data?.items.length ? (
        <EmptyState icon={History} title="Sem movimentações" description="Entradas, saídas, transferências e ajustes deste produto aparecerão aqui." />
      ) : (
        <>
          <div className={cn("overflow-x-auto", isPlaceholderData && "opacity-60")}>
            <table className="w-full text-sm">
              <caption className="sr-only">Movimentações do produto</caption>
              <thead>
                <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                  <th scope="col" className="px-4 py-2.5 text-left font-medium">Data</th>
                  <th scope="col" className="px-4 py-2.5 text-left font-medium">Tipo</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Qtd.</th>
                  <th scope="col" className="px-4 py-2.5 text-left font-medium">Local</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Saldo total</th>
                  <th scope="col" className="px-4 py-2.5 text-left font-medium">Motivo · usuário</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.items.map((m) => (
                  <tr key={m.id}>
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">{f.dateTime(m.createdAt)}</td>
                    <td className="px-4 py-2.5">
                      <MovementTypeBadge type={m.type} />
                    </td>
                    <td className={cn("tabular px-4 py-2.5 text-right font-semibold", m.delta > 0 && "text-viz-in", m.delta < 0 && "text-viz-out")}>
                      {m.delta > 0 ? "+" : m.delta < 0 ? "−" : ""}
                      {f.number(m.quantity)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs">{locationsOf(m)}</td>
                    <td className="tabular whitespace-nowrap px-4 py-2.5 text-right text-xs">
                      {f.number(m.totalBefore)} <ArrowRight className="inline h-3 w-3 text-muted-foreground" aria-label="para" /> <span className="font-semibold">{f.number(m.totalAfter)}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="max-w-56 truncate text-[13px]">{m.reason}</p>
                      <p className="max-w-56 truncate text-xs text-muted-foreground">
                        {m.userDisplayName ?? m.username}
                        {m.reference && ` · ${m.reference}`}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} size={data.size} totalItems={data.totalItems} totalPages={data.totalPages} onPageChange={setPage} />
        </>
      )}
    </section>
  );
}
