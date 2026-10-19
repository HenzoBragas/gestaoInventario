import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CircleCheck, CircleOff, FolderTree, Loader2, MoreHorizontal, Pencil, Plus, Replace, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ActiveBadge } from "@/components/common/Badges";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataTable, type Column } from "@/components/common/DataTable";
import { Field } from "@/components/common/Field";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState } from "@/components/common/States";
import { useApiMutation, useCategories } from "@/lib/api/hooks";
import { categoriesApi } from "@/lib/api/services";
import type { Category, CategoryInput } from "@/lib/api/types";
import { useAuth } from "@/lib/auth-provider";
import { can } from "@/lib/domain";
import { useFormatters } from "@/lib/format";

export function CategoriesPage() {
  const { data, isLoading, isError, error, refetch } = useCategories();
  const { role } = useAuth();
  const canWrite = can(role, "catalog:write");
  const f = useFormatters();
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<{ open: boolean; category: Category | null }>({ open: false, category: null });
  const [reassign, setReassign] = useState<Category | null>(null);
  const [toDelete, setToDelete] = useState<Category | null>(null);

  const remove = useApiMutation((c: Category) => categoriesApi.remove(c.seq), { success: (_, c) => `Categoria ${c.name} excluída.` });
  const toggle = useApiMutation((c: Category) => categoriesApi.update(c.seq, { name: c.name, description: c.description, inactive: c.active ? 1 : 0 }), {
    success: (c) => (c.active ? `Categoria ${c.name} reativada.` : `Categoria ${c.name} desativada.`),
  });

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (data ?? []).filter((c) => !term || c.name.toLowerCase().includes(term) || c.description?.toLowerCase().includes(term));
  }, [data, query]);

  const columns: Column<Category>[] = [
    { id: "name", header: "Nome", cell: (c) => <span className="font-medium">{c.name}</span> },
    { id: "description", header: "Descrição", cell: (c) => <span className="block max-w-md truncate text-muted-foreground">{c.description ?? "—"}</span> },
    {
      id: "products",
      header: "Produtos",
      align: "right",
      cell: (c) =>
        c.productCount ? (
          <Link to="/inventory" search={{ categoryId: c.seq } as never} className="font-medium text-primary hover:underline">
            {f.number(c.productCount)}
          </Link>
        ) : (
          <span className="text-muted-foreground">0</span>
        ),
    },
    { id: "status", header: "Status", cell: (c) => <ActiveBadge active={c.active} /> },
    {
      id: "actions",
      header: "Ações",
      align: "right",
      cell: (c) =>
        canWrite ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Ações para ${c.name}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onSelect={() => setForm({ open: true, category: c })}>
                <Pencil /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => toggle.mutate(c)}>
                {c.active ? <CircleOff /> : <CircleCheck />} {c.active ? "Desativar" : "Reativar"}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setReassign(c)} disabled={!c.productCount}>
                <Replace /> Reatribuir produtos…
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setToDelete(c)} className="text-destructive focus:text-destructive">
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
        title="Categorias"
        description="Organize os produtos em grupos. Categorias com produtos não podem ser excluídas: desative-as ou reatribua os produtos."
        actions={
          canWrite && (
            <Button onClick={() => setForm({ open: true, category: null })}>
              <Plus /> Nova categoria
            </Button>
          )
        }
      />
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar categorias" aria-label="Buscar categorias" className="pl-9" />
      </div>
      <section className="rounded-xl border bg-card shadow-xs" aria-label="Categorias">
        {isError ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : (
          <DataTable
            caption="Categorias"
            columns={columns}
            rows={rows}
            rowKey={(c) => c.seq}
            loading={isLoading}
            empty={
              <EmptyState
                icon={FolderTree}
                title={query ? "Nenhuma categoria encontrada" : "Nenhuma categoria cadastrada"}
                action={canWrite && !query && <Button size="sm" onClick={() => setForm({ open: true, category: null })}><Plus /> Nova categoria</Button>}
              />
            }
          />
        )}
      </section>

      <CategoryFormDialog open={form.open} category={form.category} onOpenChange={(open) => setForm((s) => ({ ...s, open }))} />
      <ReassignDialog category={reassign} categories={data ?? []} onClose={() => setReassign(null)} />
      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Excluir categoria?"
        description={
          toDelete?.productCount
            ? `${toDelete.name} possui ${toDelete.productCount} produto(s) e não pode ser excluída. Desative-a ou reatribua os produtos antes.`
            : `A categoria ${toDelete?.name} será excluída permanentemente.`
        }
        confirmLabel="Excluir"
        destructive
        onConfirm={() => (toDelete ? remove.mutateAsync(toDelete) : undefined)}
      />
    </div>
  );
}

const categorySchema = z.object({
  name: z.string().trim().min(1, "Informe o nome.").max(50, "Máximo de 50 caracteres."),
  description: z.string().max(255, "Máximo de 255 caracteres."),
  active: z.boolean(),
});
type CategoryForm = z.infer<typeof categorySchema>;

function CategoryFormDialog({ open, category, onOpenChange }: { open: boolean; category: Category | null; onOpenChange: (open: boolean) => void }) {
  const { register, control, handleSubmit, reset, setError, formState } = useForm<CategoryForm>({ resolver: zodResolver(categorySchema) });
  useEffect(() => {
    if (open) reset({ name: category?.name ?? "", description: category?.description ?? "", active: category?.active ?? true });
  }, [open, category, reset]);

  const save = useApiMutation(
    (body: CategoryInput) => (category ? categoriesApi.update(category.seq, body) : categoriesApi.create(body)),
    { silentFieldErrors: true, success: (c) => (category ? `Categoria ${c.name} atualizada.` : `Categoria ${c.name} criada.`), onSuccess: () => onOpenChange(false) },
  );

  const onSubmit = handleSubmit((v) =>
    save.mutate(
      { name: v.name.trim(), description: v.description.trim() || null, inactive: v.active ? 0 : 1 },
      { onError: (e) => e.fieldErrors.name && setError("name", { message: e.fieldErrors.name }) },
    ),
  );

  return (
    <Dialog open={open} onOpenChange={(next) => !save.isPending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{category ? "Editar categoria" : "Nova categoria"}</DialogTitle>
          <DialogDescription>Nome único, usado para classificar produtos e filtrar relatórios.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <Field label="Nome" error={formState.errors.name?.message} required>
            <Input disabled={save.isPending} {...register("name")} />
          </Field>
          <Field label="Descrição" error={formState.errors.description?.message}>
            <Textarea rows={2} disabled={save.isPending} {...register("description")} />
          </Field>
          <Controller
            control={control}
            name="active"
            render={({ field }) => (
              <label className="flex items-center justify-between gap-4 rounded-lg border p-3 text-sm">
                <span>
                  <span className="block font-medium">Ativa</span>
                  <span className="text-[13px] text-muted-foreground">Inativas não aparecem para novos cadastros.</span>
                </span>
                <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Categoria ativa" />
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

function ReassignDialog({ category, categories, onClose }: { category: Category | null; categories: Category[]; onClose: () => void }) {
  const [target, setTarget] = useState("");
  useEffect(() => setTarget(""), [category]);
  const mutation = useApiMutation((v: { id: number; target: number }) => categoriesApi.reassign(v.id, v.target), {
    success: "Produtos reatribuídos.",
    onSuccess: onClose,
  });
  const options = categories.filter((c) => c.active && c.seq !== category?.seq);
  return (
    <Dialog open={Boolean(category)} onOpenChange={(open) => !open && !mutation.isPending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reatribuir produtos</DialogTitle>
          <DialogDescription>
            Mover os {category?.productCount} produto(s) de <span className="font-medium text-foreground">{category?.name}</span> para outra categoria ativa.
          </DialogDescription>
        </DialogHeader>
        <Field id="reassign-target" label="Categoria de destino" required>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger id="reassign-target">
              <SelectValue placeholder="Selecione…" />
            </SelectTrigger>
            <SelectContent>
              {options.map((c) => (
                <SelectItem key={c.seq} value={String(c.seq)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => category && mutation.mutate({ id: category.seq, target: Number(target) })} disabled={!target || mutation.isPending}>
            {mutation.isPending && <Loader2 className="animate-spin" />} Reatribuir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
