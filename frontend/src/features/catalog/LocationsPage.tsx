import { useEffect, useMemo, useState } from "react";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, CircleCheck, CircleOff, Loader2, MapPin, MoreHorizontal, Pencil, Plus, Search, Store, Trash2, Warehouse, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ActiveBadge } from "@/components/common/Badges";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Field } from "@/components/common/Field";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState } from "@/components/common/States";
import { useApiMutation, useLocationBalances, useLocations } from "@/lib/api/hooks";
import { locationsApi } from "@/lib/api/services";
import type { LocationInput, LocationType, StockLocation } from "@/lib/api/types";
import { useAuth } from "@/lib/auth-provider";
import { can, LOCATION_TYPE_LABEL } from "@/lib/domain";
import { useFormatters } from "@/lib/format";
import { cn } from "@/lib/utils";

const route = getRouteApi("/_app/locations");

const TYPE_ICON: Record<LocationType, LucideIcon> = {
  WAREHOUSE: Warehouse,
  DEPOT: Building2,
  STORE: Store,
  INTERNAL_AREA: MapPin,
};

export function LocationsPage() {
  const search = route.useSearch();
  const navigate = useNavigate({ from: "/locations" });
  const { data, isLoading, isError, error, refetch } = useLocations();
  const { role } = useAuth();
  const canWrite = can(role, "catalog:write");
  const f = useFormatters();
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<{ open: boolean; location: StockLocation | null }>({ open: false, location: null });
  const [toDelete, setToDelete] = useState<StockLocation | null>(null);

  const remove = useApiMutation((l: StockLocation) => locationsApi.remove(l.id), { success: (_, l) => `Localização ${l.code} excluída.` });
  const toggle = useApiMutation(
    (l: StockLocation) => locationsApi.update(l.id, { code: l.code, name: l.name, type: l.type, description: l.description, active: !l.active }),
    { success: (l) => (l.active ? `${l.code} reativada.` : `${l.code} desativada.`) },
  );

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (data ?? []).filter((l) => !term || l.code.toLowerCase().includes(term) || l.name.toLowerCase().includes(term));
  }, [data, query]);
  const totalValue = (data ?? []).reduce((sum, l) => sum + l.totalValue, 0);
  const detail = data?.find((l) => l.id === search.id) ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Localizações e armazéns"
        description="O saldo é controlado por produto em cada localização. Transferências movem saldo entre elas."
        actions={canWrite && <Button onClick={() => setForm({ open: true, location: null })}><Plus /> Nova localização</Button>}
      />
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por código ou nome" aria-label="Buscar localizações" className="pl-9" />
      </div>

      {isError ? (
        <div className="rounded-xl border glass">
          <ErrorState error={error} onRetry={() => refetch()} />
        </div>
      ) : isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border glass">
          <EmptyState icon={MapPin} title={query ? "Nenhuma localização encontrada" : "Nenhuma localização cadastrada"} />
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((l) => {
            const Icon = TYPE_ICON[l.type];
            const share = totalValue ? l.totalValue / totalValue : 0;
            return (
              <li key={l.id} className={cn("group relative flex flex-col rounded-xl border glass glass-interactive p-5", !l.active && "opacity-70")}>
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => navigate({ search: { id: l.id }, replace: true })}
                    className="flex min-w-0 items-start gap-3 text-left after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
                    aria-label={`Ver saldos de ${l.code} ${l.name}`}
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-mono text-xs text-muted-foreground">{l.code}</span>
                      <span className="line-clamp-2 font-semibold">{l.name}</span>
                      <span className="text-xs text-muted-foreground">{LOCATION_TYPE_LABEL[l.type]}</span>
                    </span>
                  </button>
                  <div className="relative z-10 flex items-center gap-1">
                    <ActiveBadge active={l.active} />
                    {canWrite && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Ações para ${l.code}`}>
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onSelect={() => setForm({ open: true, location: l })}>
                            <Pencil /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => toggle.mutate(l)}>
                            {l.active ? <CircleOff /> : <CircleCheck />} {l.active ? "Desativar" : "Reativar"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => setToDelete(l)} className="text-destructive focus:text-destructive">
                            <Trash2 /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
                <dl className="mt-5 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Produtos</dt>
                    <dd className="tabular font-semibold">{f.number(l.productCount)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Unidades</dt>
                    <dd className="tabular font-semibold">{f.number(l.totalUnits)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Valor</dt>
                    <dd className="tabular font-semibold">{f.moneyCompact(l.totalValue)}</dd>
                  </div>
                </dl>
                <div className="mt-4 h-1.5 rounded-full bg-muted" aria-hidden="true">
                  <div className="h-1.5 rounded-full bg-viz-value" style={{ width: `${share * 100}%` }} />
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">{f.ratio(share)} do valor total em estoque</p>
              </li>
            );
          })}
        </ul>
      )}

      <LocationDetailSheet location={detail} onClose={() => navigate({ search: {}, replace: true })} />
      <LocationFormDialog open={form.open} location={form.location} onOpenChange={(open) => setForm((s) => ({ ...s, open }))} />
      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Excluir localização?"
        description="Só é possível excluir localizações sem saldo, sem histórico de movimentações e sem produtos vinculados. Caso contrário, desative-a."
        confirmLabel="Excluir"
        destructive
        onConfirm={() => (toDelete ? remove.mutateAsync(toDelete) : undefined)}
      />
    </div>
  );
}

function LocationDetailSheet({ location, onClose }: { location: StockLocation | null; onClose: () => void }) {
  const { data, isLoading, isError, error } = useLocationBalances(location?.id);
  const f = useFormatters();
  const [filter, setFilter] = useState("");
  const rows = (data ?? []).filter((b) => !filter || `${b.sku} ${b.productName}`.toLowerCase().includes(filter.toLowerCase()));

  return (
    <Sheet open={Boolean(location)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex w-full flex-col sm:max-w-xl">
        {location && (
          <>
            <SheetHeader className="text-left">
              <SheetTitle>
                <span className="font-mono text-sm text-muted-foreground">{location.code}</span> {location.name}
              </SheetTitle>
              <SheetDescription>
                {LOCATION_TYPE_LABEL[location.type]} · {f.number(location.productCount)} produtos · {f.number(location.totalUnits)} un. · {f.money(location.totalValue)}
              </SheetDescription>
            </SheetHeader>
            {location.description && <p className="text-sm text-muted-foreground">{location.description}</p>}
            <div className="flex items-center justify-between gap-2">
              <Input type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrar produtos" aria-label="Filtrar produtos da localização" className="h-9" />
              <Button asChild variant="outline" size="sm" className="shrink-0">
                <Link to="/inventory" search={{ locationId: location.id } as never}>
                  Abrir no inventário
                </Link>
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border">
              {isLoading ? (
                <div className="space-y-2 p-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : isError ? (
                <ErrorState error={error} />
              ) : rows.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">Sem saldo nesta localização.</p>
              ) : (
                <table className="w-full text-sm">
                  <caption className="sr-only">Saldos da localização</caption>
                  <thead className="sticky top-0 bg-muted/90 text-xs text-muted-foreground backdrop-blur">
                    <tr>
                      <th scope="col" className="px-3 py-2 text-left font-medium">Produto</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">Qtd.</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map((b) => (
                      <tr key={b.productId} className="hover:bg-muted/50">
                        <td className="max-w-0 px-3 py-2">
                          <Link to="/products/$productId" params={{ productId: String(b.productId) }} className="block truncate hover:text-primary hover:underline">
                            {b.productName}
                          </Link>
                          <span className="font-mono text-[11px] text-muted-foreground">{b.sku}</span>
                        </td>
                        <td className="tabular whitespace-nowrap px-3 py-2 text-right">
                          {f.number(b.quantity)} <span className="text-xs text-muted-foreground">{b.unit}</span>
                        </td>
                        <td className="tabular whitespace-nowrap px-3 py-2 text-right">{f.money(b.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

const locationSchema = z.object({
  code: z.string().trim().min(1, "Informe o código.").max(20, "Máximo de 20 caracteres.").regex(/^[A-Za-z0-9\-_.]+$/, "Use letras, números, hífen, ponto ou sublinhado."),
  name: z.string().trim().min(1, "Informe o nome.").max(100, "Máximo de 100 caracteres."),
  type: z.enum(["WAREHOUSE", "DEPOT", "STORE", "INTERNAL_AREA"]),
  description: z.string().max(255, "Máximo de 255 caracteres."),
  active: z.boolean(),
});
type LocationForm = z.infer<typeof locationSchema>;

function LocationFormDialog({ open, location, onOpenChange }: { open: boolean; location: StockLocation | null; onOpenChange: (open: boolean) => void }) {
  const { register, control, handleSubmit, reset, setError, formState } = useForm<LocationForm>({ resolver: zodResolver(locationSchema), mode: "onTouched" });
  const errors = formState.errors;
  useEffect(() => {
    if (open)
      reset({
        code: location?.code ?? "",
        name: location?.name ?? "",
        type: location?.type ?? "WAREHOUSE",
        description: location?.description ?? "",
        active: location?.active ?? true,
      });
  }, [open, location, reset]);

  const save = useApiMutation((body: LocationInput) => (location ? locationsApi.update(location.id, body) : locationsApi.create(body)), {
    silentFieldErrors: true,
    success: (l) => (location ? `Localização ${l.code} atualizada.` : `Localização ${l.code} criada.`),
    onSuccess: () => onOpenChange(false),
  });

  const onSubmit = handleSubmit((v) =>
    save.mutate(
      { code: v.code.trim().toUpperCase(), name: v.name.trim(), type: v.type, description: v.description.trim() || null, active: v.active },
      {
        onError: (e) => {
          for (const [field, message] of Object.entries(e.fieldErrors)) {
            if (field in v) setError(field as keyof LocationForm, { message });
          }
        },
      },
    ),
  );

  return (
    <Dialog open={open} onOpenChange={(next) => !save.isPending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{location ? "Editar localização" : "Nova localização"}</DialogTitle>
          <DialogDescription>Armazéns, depósitos, lojas ou áreas internas que guardam estoque.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
            <Field label="Código" error={errors.code?.message} required>
              <Input className="font-mono uppercase" disabled={save.isPending} {...register("code")} />
            </Field>
            <Field label="Nome" error={errors.name?.message} required>
              <Input disabled={save.isPending} {...register("name")} />
            </Field>
          </div>
          <Field id="loc-type" label="Tipo" error={errors.type?.message} required>
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={save.isPending}>
                  <SelectTrigger id="loc-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(LOCATION_TYPE_LABEL) as LocationType[]).map((t) => (
                      <SelectItem key={t} value={t}>
                        {LOCATION_TYPE_LABEL[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Endereço ou descrição" error={errors.description?.message}>
            <Textarea rows={2} disabled={save.isPending} {...register("description")} />
          </Field>
          <Controller
            control={control}
            name="active"
            render={({ field }) => (
              <label className="flex items-center justify-between gap-4 rounded-lg border p-3 text-sm">
                <span>
                  <span className="block font-medium">Ativa</span>
                  <span className="text-[13px] text-muted-foreground">Só é possível desativar localizações sem saldo.</span>
                </span>
                <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Localização ativa" />
              </label>
            )}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
