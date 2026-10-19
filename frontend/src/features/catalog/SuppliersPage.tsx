import { useEffect, useMemo, useState } from "react";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CircleCheck, CircleOff, Loader2, Mail, MoreHorizontal, Pencil, Phone, Plus, Search, Trash2, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ActiveBadge, StatusBadge } from "@/components/common/Badges";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataTable, type Column } from "@/components/common/DataTable";
import { Field } from "@/components/common/Field";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState } from "@/components/common/States";
import { useApiMutation, useProducts, useSuppliers } from "@/lib/api/hooks";
import { suppliersApi } from "@/lib/api/services";
import type { Supplier, SupplierInput } from "@/lib/api/types";
import { useAuth } from "@/lib/auth-provider";
import { can } from "@/lib/domain";
import { useFormatters } from "@/lib/format";

const route = getRouteApi("/_app/suppliers");

export function SuppliersPage() {
  const search = route.useSearch();
  const navigate = useNavigate({ from: "/suppliers" });
  const { data, isLoading, isError, error, refetch } = useSuppliers();
  const { role } = useAuth();
  const canWrite = can(role, "catalog:write");
  const f = useFormatters();
  const [query, setQuery] = useState(search.q ?? "");
  const [form, setForm] = useState<{ open: boolean; supplier: Supplier | null }>({ open: false, supplier: null });
  const [toDelete, setToDelete] = useState<Supplier | null>(null);

  const remove = useApiMutation((s: Supplier) => suppliersApi.remove(s.id), { success: (_, s) => `Fornecedor ${s.name} excluído.` });
  const toggle = useApiMutation((s: Supplier) => suppliersApi.update(s.id, { ...pick(s), active: !s.active }), {
    success: (s) => (s.active ? "Fornecedor reativado." : "Fornecedor desativado."),
  });

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (data ?? []).filter((s) => !term || [s.name, s.taxId, s.email].some((v) => v?.toLowerCase().includes(term)));
  }, [data, query]);
  const detail = data?.find((s) => s.id === search.id) ?? null;

  const columns: Column<Supplier>[] = [
    { id: "name", header: "Fornecedor", cell: (s) => <span className="font-medium">{s.name}</span> },
    { id: "taxId", header: "Documento", cell: (s) => <span className="font-mono text-xs">{s.taxId ?? "—"}</span> },
    {
      id: "contact",
      header: "Contato",
      cell: (s) => (
        <div className="text-xs text-muted-foreground">
          {s.email && <p className="truncate">{s.email}</p>}
          {s.phone && <p>{s.phone}</p>}
          {!s.email && !s.phone && "—"}
        </div>
      ),
    },
    { id: "products", header: "Produtos", align: "right", cell: (s) => f.number(s.productCount) },
    { id: "status", header: "Status", cell: (s) => <ActiveBadge active={s.active} /> },
    {
      id: "actions",
      header: "Ações",
      align: "right",
      cell: (s) =>
        canWrite ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Ações para ${s.name}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onSelect={() => setForm({ open: true, supplier: s })}>
                <Pencil /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => toggle.mutate(s)}>
                {s.active ? <CircleOff /> : <CircleCheck />} {s.active ? "Desativar" : "Reativar"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setToDelete(s)} className="text-destructive focus:text-destructive">
                <Trash2 /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fornecedores"
        description="Cadastro de fornecedores e produtos associados."
        actions={canWrite && <Button onClick={() => setForm({ open: true, supplier: null })}><Plus /> Novo fornecedor</Button>}
      />
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nome, documento ou e-mail" aria-label="Buscar fornecedores" className="pl-9" />
      </div>
      <section className="rounded-xl border bg-card shadow-xs" aria-label="Fornecedores">
        {isError ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : (
          <DataTable
            caption="Fornecedores"
            columns={columns}
            rows={rows}
            rowKey={(s) => s.id}
            rowLabel={(s) => s.name}
            loading={isLoading}
            onRowClick={(s) => navigate({ search: { id: s.id }, replace: true })}
            empty={<EmptyState icon={Truck} title={query ? "Nenhum fornecedor encontrado" : "Nenhum fornecedor cadastrado"} />}
          />
        )}
      </section>

      <SupplierDetailSheet supplier={detail} onClose={() => navigate({ search: {}, replace: true })} />
      <SupplierFormDialog open={form.open} supplier={form.supplier} onOpenChange={(open) => setForm((s) => ({ ...s, open }))} />
      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Excluir fornecedor?"
        description={
          toDelete?.productCount
            ? `${toDelete.name} está vinculado a ${toDelete.productCount} produto(s) e não pode ser excluído. Desative-o em vez disso.`
            : `${toDelete?.name} será excluído permanentemente.`
        }
        confirmLabel="Excluir"
        destructive
        onConfirm={() => (toDelete ? remove.mutateAsync(toDelete) : undefined)}
      />
    </div>
  );
}

function pick(s: Supplier): SupplierInput {
  return { name: s.name, taxId: s.taxId, email: s.email, phone: s.phone, address: s.address, notes: s.notes, active: s.active };
}

function SupplierDetailSheet({ supplier, onClose }: { supplier: Supplier | null; onClose: () => void }) {
  const { data, isLoading } = useProducts({ supplierId: supplier?.id, size: 8, sort: "name" }, Boolean(supplier));
  const f = useFormatters();
  return (
    <Sheet open={Boolean(supplier)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {supplier && (
          <>
            <SheetHeader className="text-left">
              <SheetTitle>{supplier.name}</SheetTitle>
              <SheetDescription asChild>
                <div>
                  <ActiveBadge active={supplier.active} />
                </div>
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6 space-y-6 text-sm">
              <dl className="space-y-2">
                {supplier.taxId && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Documento</dt>
                    <dd className="font-mono text-xs">{supplier.taxId}</dd>
                  </div>
                )}
                {supplier.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <a href={`mailto:${supplier.email}`} className="text-primary hover:underline">
                      {supplier.email}
                    </a>
                  </div>
                )}
                {supplier.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <a href={`tel:${supplier.phone.replace(/[^\d+]/g, "")}`} className="hover:underline">
                      {supplier.phone}
                    </a>
                  </div>
                )}
                {supplier.address && <p className="text-muted-foreground">{supplier.address}</p>}
              </dl>
              {supplier.notes && <p className="rounded-lg bg-muted p-3 text-[13px] text-muted-foreground">{supplier.notes}</p>}
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-semibold">Produtos associados ({f.number(supplier.productCount)})</h3>
                  {supplier.productCount > 0 && (
                    <Link to="/products" search={{ supplierId: supplier.id } as never} className="text-xs font-medium text-primary hover:underline">
                      Ver todos
                    </Link>
                  )}
                </div>
                {isLoading ? (
                  <Skeleton className="h-32 w-full" />
                ) : !data?.items.length ? (
                  <p className="text-muted-foreground">Nenhum produto vinculado.</p>
                ) : (
                  <ul className="divide-y rounded-lg border">
                    {data.items.map((p) => (
                      <li key={p.id}>
                        <Link to="/products/$productId" params={{ productId: String(p.id) }} className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-muted/60">
                          <span className="min-w-0">
                            <span className="block truncate">{p.name}</span>
                            <span className="font-mono text-[11px] text-muted-foreground">{p.sku}</span>
                          </span>
                          <StatusBadge status={p.status} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

const supplierSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome ou razão social.").max(150, "Máximo de 150 caracteres."),
  taxId: z.string().trim().regex(/^[0-9./-]*$/, "Use apenas números, ponto, barra ou hífen.").max(20, "Máximo de 20 caracteres."),
  email: z.string().trim().refine((v) => v === "" || z.string().email().safeParse(v).success, "Informe um e-mail válido."),
  phone: z.string().trim().regex(/^[0-9()+\- ]*$/, "Use apenas números, espaços, parênteses, + ou hífen.").max(30, "Máximo de 30 caracteres."),
  address: z.string().max(255, "Máximo de 255 caracteres."),
  notes: z.string().max(1000, "Máximo de 1000 caracteres."),
  active: z.boolean(),
});
type SupplierForm = z.infer<typeof supplierSchema>;

function SupplierFormDialog({ open, supplier, onOpenChange }: { open: boolean; supplier: Supplier | null; onOpenChange: (open: boolean) => void }) {
  const { register, control, handleSubmit, reset, setError, formState } = useForm<SupplierForm>({ resolver: zodResolver(supplierSchema), mode: "onTouched" });
  const errors = formState.errors;
  useEffect(() => {
    if (open)
      reset({
        name: supplier?.name ?? "",
        taxId: supplier?.taxId ?? "",
        email: supplier?.email ?? "",
        phone: supplier?.phone ?? "",
        address: supplier?.address ?? "",
        notes: supplier?.notes ?? "",
        active: supplier?.active ?? true,
      });
  }, [open, supplier, reset]);

  const save = useApiMutation((body: SupplierInput) => (supplier ? suppliersApi.update(supplier.id, body) : suppliersApi.create(body)), {
    silentFieldErrors: true,
    success: (s) => (supplier ? `Fornecedor ${s.name} atualizado.` : `Fornecedor ${s.name} cadastrado.`),
    onSuccess: () => onOpenChange(false),
  });

  const onSubmit = handleSubmit((v) => {
    const clean = (value: string) => value.trim() || null;
    save.mutate(
      { name: v.name.trim(), taxId: clean(v.taxId), email: clean(v.email), phone: clean(v.phone), address: clean(v.address), notes: clean(v.notes), active: v.active },
      {
        onError: (e) => {
          for (const [field, message] of Object.entries(e.fieldErrors)) {
            if (field in v) setError(field as keyof SupplierForm, { message });
          }
        },
      },
    );
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !save.isPending && onOpenChange(next)}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{supplier ? "Editar fornecedor" : "Novo fornecedor"}</DialogTitle>
          <DialogDescription>Somente o nome é obrigatório.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <Field label="Nome ou razão social" error={errors.name?.message} required>
            <Input disabled={save.isPending} {...register("name")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="CNPJ/CPF" error={errors.taxId?.message}>
              <Input inputMode="numeric" disabled={save.isPending} {...register("taxId")} />
            </Field>
            <Field label="Telefone" error={errors.phone?.message}>
              <Input type="tel" disabled={save.isPending} {...register("phone")} />
            </Field>
          </div>
          <Field label="E-mail" error={errors.email?.message}>
            <Input type="email" disabled={save.isPending} {...register("email")} />
          </Field>
          <Field label="Endereço" error={errors.address?.message}>
            <Input disabled={save.isPending} {...register("address")} />
          </Field>
          <Field label="Observações" error={errors.notes?.message}>
            <Textarea rows={2} disabled={save.isPending} {...register("notes")} />
          </Field>
          <Controller
            control={control}
            name="active"
            render={({ field }) => (
              <label className="flex items-center justify-between gap-4 rounded-lg border p-3 text-sm">
                <span className="font-medium">Ativo</span>
                <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Fornecedor ativo" />
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
