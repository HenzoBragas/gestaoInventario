import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Info, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormSection } from "@/components/common/Field";
import { useApiMutation, useCategories, useLocations, useSettings, useSuppliers } from "@/lib/api/hooks";
import { productsApi } from "@/lib/api/services";
import type { Product, ProductInput } from "@/lib/api/types";
import { useFormatters } from "@/lib/format";

const NONE = "__none__";
const decimal = /^\d+([.,]\d{1,2})?$/;

const schema = z.object({
  sku: z
    .string()
    .trim()
    .min(1, "Informe o SKU.")
    .max(20, "Máximo de 20 caracteres.")
    .regex(/^[A-Za-z0-9._\-/]+$/, "Use letras, números, ponto, hífen, barra ou sublinhado."),
  name: z.string().trim().min(1, "Informe o nome do produto.").max(150, "Máximo de 150 caracteres."),
  model: z.string().trim().max(60, "Máximo de 60 caracteres."),
  barcode: z.string().trim().regex(/^\d*$/, "Apenas números.").max(50, "Máximo de 50 dígitos."),
  description: z.string().max(1000, "Máximo de 1000 caracteres."),
  categoryId: z.string().min(1, "Selecione a categoria."),
  supplierId: z.string(),
  unit: z.string().min(1, "Selecione a unidade."),
  unitCost: z.string().trim().regex(decimal, "Informe um valor como 12,50."),
  salePrice: z.string().trim().refine((v) => v === "" || decimal.test(v), "Informe um valor como 19,90."),
  minStock: z.string().trim().regex(/^\d+$/, "Informe um número inteiro (0 ou mais)."),
  defaultLocationId: z.string(),
  imageUrl: z.string().trim().refine((v) => v === "" || /^https?:\/\/.+/.test(v), "Use uma URL iniciando com http:// ou https://."),
  active: z.boolean(),
  initialQuantity: z.string().trim().regex(/^\d*$/, "Informe um número inteiro."),
});

type FormValues = z.infer<typeof schema>;

const toNumber = (value: string) => Number(value.replace(",", "."));

interface ProductFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ausente = cadastro novo. */
  product?: Product | null;
  onSaved?: (product: Product) => void;
}

/** Formulario extenso em painel lateral amplo, organizado em secoes. */
export function ProductFormSheet({ open, onOpenChange, product, onSaved }: ProductFormSheetProps) {
  const editing = Boolean(product);
  const f = useFormatters();
  const { data: categories } = useCategories();
  const { data: suppliers } = useSuppliers();
  const { data: locations } = useLocations();
  const { data: settings } = useSettings();

  const form = useForm<FormValues>({ resolver: zodResolver(schema), mode: "onTouched" });
  const { register, control, handleSubmit, reset, setError, formState, watch } = form;
  const errors = formState.errors;

  useEffect(() => {
    if (!open) return;
    reset({
      sku: product?.sku ?? "",
      name: product?.name ?? "",
      model: product && product.model !== "Sem modelo" ? product.model : "",
      barcode: product?.barcode ?? "",
      description: product?.description ?? "",
      categoryId: product?.categoryId ? String(product.categoryId) : "",
      supplierId: product?.supplierId ? String(product.supplierId) : "",
      unit: product?.unit ?? "UN",
      unitCost: product ? String(product.unitCost).replace(".", ",") : "",
      salePrice: product?.salePrice != null ? String(product.salePrice).replace(".", ",") : "",
      minStock: String(product?.minStock ?? settings?.defaultMinStock ?? 5),
      defaultLocationId: product?.defaultLocationId ? String(product.defaultLocationId) : "",
      imageUrl: product?.imageUrl ?? "",
      active: product?.active ?? true,
      initialQuantity: "",
    });
  }, [open, product, settings?.defaultMinStock, reset]);

  const mutation = useApiMutation(
    (body: ProductInput) => (product ? productsApi.update(product.id, body) : productsApi.create(body)),
    {
      silentFieldErrors: true,
      success: (saved) => (editing ? `Produto ${saved.sku} atualizado.` : `Produto ${saved.sku} cadastrado.`),
      onSuccess: (saved) => {
        onOpenChange(false);
        onSaved?.(saved);
      },
    },
  );

  const onSubmit = handleSubmit((v) => {
    const initial = v.initialQuantity ? Number(v.initialQuantity) : 0;
    if (!editing && initial > 0 && !v.defaultLocationId) {
      setError("defaultLocationId", { message: "Selecione onde a quantidade inicial será armazenada." });
      return;
    }
    const body: ProductInput = {
      sku: v.sku.trim(),
      name: v.name.trim(),
      model: v.model.trim() || null,
      barcode: v.barcode.trim() || null,
      description: v.description.trim() || null,
      categoryId: Number(v.categoryId),
      supplierId: v.supplierId ? Number(v.supplierId) : null,
      unit: v.unit,
      unitCost: toNumber(v.unitCost),
      salePrice: v.salePrice ? toNumber(v.salePrice) : null,
      minStock: Number(v.minStock),
      defaultLocationId: v.defaultLocationId ? Number(v.defaultLocationId) : null,
      imageUrl: v.imageUrl.trim() || null,
      active: v.active,
      initialQuantity: editing ? undefined : initial,
    };
    mutation.mutate(body, {
      onError: (error) => {
        for (const [field, message] of Object.entries(error.fieldErrors)) {
          if (field in v) setError(field as keyof FormValues, { message });
        }
      },
    });
  });

  const busy = mutation.isPending;
  const units = settings?.units ?? ["UN"];
  const selectedUnit = watch("unit");
  const unitOptions = selectedUnit && !units.includes(selectedUnit) ? [selectedUnit, ...units] : units;

  const select = (
    name: "categoryId" | "supplierId" | "unit" | "defaultLocationId",
    options: { value: string; label: string }[],
    placeholder: string,
    optional?: boolean,
  ) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Select value={field.value || (optional ? NONE : "")} onValueChange={(v) => field.onChange(v === NONE ? "" : v)} disabled={busy}>
          <SelectTrigger id={`pf-${name}`} onBlur={field.onBlur} aria-invalid={Boolean(errors[name])}>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {optional && <SelectItem value={NONE}>Nenhum</SelectItem>}
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    />
  );

  // Registros inativos so aparecem se ja estiverem vinculados ao produto.
  const categoryOptions = (categories ?? [])
    .filter((c) => c.active || c.seq === product?.categoryId)
    .map((c) => ({ value: String(c.seq), label: c.name }));
  const supplierOptions = (suppliers ?? [])
    .filter((s) => s.active || s.id === product?.supplierId)
    .map((s) => ({ value: String(s.id), label: s.name }));
  const locationOptions = (locations ?? [])
    .filter((l) => l.active || l.id === product?.defaultLocationId)
    .map((l) => ({ value: String(l.id), label: `${l.code} · ${l.name}` }));

  return (
    <Sheet open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl">
        <SheetHeader className="border-b px-6 py-5 text-left">
          <SheetTitle>{editing ? "Editar produto" : "Novo produto"}</SheetTitle>
          <SheetDescription>
            {editing ? `SKU ${product?.sku} · saldo atual ${f.number(product?.stock)} ${product?.unit}` : "Cadastre o item no catálogo. Campos com * são obrigatórios."}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col" aria-busy={busy}>
          <div className="flex-1 space-y-7 overflow-y-auto px-6 py-6">
            <FormSection title="Identificação">
              <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
                <Field label="SKU" error={errors.sku?.message} required hint="Código único do produto.">
                  <Input autoComplete="off" className="font-mono" disabled={busy} {...register("sku")} />
                </Field>
                <Field label="Nome" error={errors.name?.message} required>
                  <Input disabled={busy} {...register("name")} />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Modelo / variação" error={errors.model?.message}>
                  <Input disabled={busy} {...register("model")} />
                </Field>
                <Field label="Código de barras" error={errors.barcode?.message} hint="Opcional (EAN/GTIN).">
                  <Input inputMode="numeric" className="font-mono" disabled={busy} {...register("barcode")} />
                </Field>
              </div>
              <Field label="Descrição" error={errors.description?.message}>
                <Textarea rows={3} disabled={busy} {...register("description")} />
              </Field>
            </FormSection>

            <Separator />

            <FormSection title="Classificação e fornecimento">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="pf-categoryId" label="Categoria" error={errors.categoryId?.message} required>
                  {select("categoryId", categoryOptions, "Selecione…")}
                </Field>
                <Field id="pf-supplierId" label="Fornecedor principal" error={errors.supplierId?.message}>
                  {select("supplierId", supplierOptions, "Nenhum", true)}
                </Field>
              </div>
            </FormSection>

            <Separator />

            <FormSection title="Valores e estoque" description="O custo unitário é usado na valorização do inventário.">
              <div className="grid gap-4 sm:grid-cols-3">
                <Field id="pf-unit" label="Unidade" error={errors.unit?.message} required>
                  {select("unit", unitOptions.map((u) => ({ value: u, label: u })), "UN")}
                </Field>
                <Field label="Custo unitário" error={errors.unitCost?.message} required>
                  <Input inputMode="decimal" placeholder="0,00" disabled={busy} {...register("unitCost")} />
                </Field>
                <Field label="Preço de venda" error={errors.salePrice?.message}>
                  <Input inputMode="decimal" placeholder="Opcional" disabled={busy} {...register("salePrice")} />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Estoque mínimo" error={errors.minStock?.message} required hint="Abaixo ou igual a este saldo, o item fica em “Estoque baixo”.">
                  <Input type="number" inputMode="numeric" min={0} disabled={busy} {...register("minStock")} />
                </Field>
                <Field id="pf-defaultLocationId" label="Localização padrão" error={errors.defaultLocationId?.message}>
                  {select("defaultLocationId", locationOptions, "Nenhuma", true)}
                </Field>
              </div>

              {editing ? (
                <p className="flex items-start gap-2 rounded-lg bg-info/10 px-3 py-2.5 text-[13px]">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" aria-hidden="true" />
                  O saldo não é alterado pela edição do cadastro. Use uma movimentação (entrada, saída ou ajuste) para que a alteração fique registrada no histórico.
                </p>
              ) : (
                <Field
                  label="Quantidade inicial"
                  error={errors.initialQuantity?.message}
                  hint="Opcional. Será registrada como uma entrada “Saldo inicial” na localização padrão."
                >
                  <Input type="number" inputMode="numeric" min={0} placeholder="0" disabled={busy} {...register("initialQuantity")} />
                </Field>
              )}
            </FormSection>

            <Separator />

            <FormSection title="Exibição e status">
              <Field label="URL da imagem" error={errors.imageUrl?.message} hint="Opcional: link público para a foto do produto.">
                <Input type="url" placeholder="https://…" disabled={busy} {...register("imageUrl")} />
              </Field>
              <Controller
                control={control}
                name="active"
                render={({ field }) => (
                  <label className="flex items-start justify-between gap-4 rounded-lg border p-3">
                    <span>
                      <span className="block text-sm font-medium">Produto ativo</span>
                      <span className="block text-[13px] text-muted-foreground">
                        Produtos inativos continuam no histórico, mas não recebem movimentações.
                      </span>
                    </span>
                    <Switch checked={field.value} onCheckedChange={field.onChange} disabled={busy} aria-label="Produto ativo" />
                  </label>
                )}
              />
            </FormSection>
          </div>

          <SheetFooter className="border-t px-6 py-4 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              {editing ? "Salvar alterações" : "Cadastrar produto"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
