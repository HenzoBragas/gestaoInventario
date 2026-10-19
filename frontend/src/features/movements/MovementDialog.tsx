import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, Info, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/common/Field";
import { MovementTypeIcon } from "@/components/common/Badges";
import { ProductPicker } from "@/features/movements/ProductPicker";
import { keys, useApiMutation, useLocations, useProduct } from "@/lib/api/hooks";
import { movementsApi } from "@/lib/api/services";
import type { MovementInput, MovementType, Product } from "@/lib/api/types";
import { useAuth } from "@/lib/auth-provider";
import { can, MOVEMENT_DESCRIPTION, MOVEMENT_LABEL, MOVEMENT_REASONS } from "@/lib/domain";
import { useFormatters } from "@/lib/format";
import { cn } from "@/lib/utils";

// ------------------------------------------------------------------ contexto global

interface OpenOptions {
  type?: MovementType;
  productId?: number;
  locationId?: number;
}

const MovementDialogContext = createContext<{ openMovement: (options?: OpenOptions) => void } | null>(null);

export function useMovementDialog() {
  const context = useContext(MovementDialogContext);
  if (!context) throw new Error("useMovementDialog deve ser usado dentro de <MovementDialogProvider>");
  return context;
}

export function MovementDialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ open: boolean; options: OpenOptions; key: number }>({ open: false, options: {}, key: 0 });
  const openMovement = useCallback((options: OpenOptions = {}) => {
    setState((s) => ({ open: true, options, key: s.key + 1 }));
  }, []);
  const value = useMemo(() => ({ openMovement }), [openMovement]);

  return (
    <MovementDialogContext.Provider value={value}>
      {children}
      <Dialog open={state.open} onOpenChange={(open) => setState((s) => ({ ...s, open }))}>
        {/* key: cada abertura comeca um formulario novo (e uma nova chave de idempotencia). */}
        <MovementForm key={state.key} options={state.options} onDone={() => setState((s) => ({ ...s, open: false }))} />
      </Dialog>
    </MovementDialogContext.Provider>
  );
}

// ------------------------------------------------------------------ formulario

const TYPES: MovementType[] = ["IN", "OUT", "TRANSFER", "ADJUSTMENT"];

const schema = z
  .object({
    type: z.enum(["IN", "OUT", "TRANSFER", "ADJUSTMENT"]),
    productId: z.number({ required_error: "Selecione o produto." }).int().positive("Selecione o produto."),
    quantity: z.string(),
    countedQuantity: z.string(),
    fromLocationId: z.string(),
    toLocationId: z.string(),
    locationId: z.string(),
    reason: z.string().min(1, "Selecione o motivo."),
    notes: z.string().max(1000, "Máximo de 1000 caracteres."),
    reference: z.string().max(60, "Máximo de 60 caracteres."),
  })
  .superRefine((v, ctx) => {
    const positiveInt = (value: string) => /^\d+$/.test(value) && Number(value) > 0;
    if (v.type !== "ADJUSTMENT" && !positiveInt(v.quantity)) {
      ctx.addIssue({ code: "custom", path: ["quantity"], message: "Informe uma quantidade inteira maior que zero." });
    }
    if (v.type === "ADJUSTMENT" && !/^\d+$/.test(v.countedQuantity)) {
      ctx.addIssue({ code: "custom", path: ["countedQuantity"], message: "Informe o saldo contado (0 ou mais)." });
    }
    if ((v.type === "IN" || v.type === "TRANSFER") && !v.toLocationId) {
      ctx.addIssue({ code: "custom", path: ["toLocationId"], message: "Selecione o destino." });
    }
    if ((v.type === "OUT" || v.type === "TRANSFER") && !v.fromLocationId) {
      ctx.addIssue({ code: "custom", path: ["fromLocationId"], message: "Selecione a origem." });
    }
    if (v.type === "TRANSFER" && v.fromLocationId && v.fromLocationId === v.toLocationId) {
      ctx.addIssue({ code: "custom", path: ["toLocationId"], message: "Origem e destino devem ser diferentes." });
    }
    if (v.type === "ADJUSTMENT" && !v.locationId) {
      ctx.addIssue({ code: "custom", path: ["locationId"], message: "Selecione a localização contada." });
    }
    if (v.reason === "Outro" && v.notes.trim().length < 5) {
      ctx.addIssue({ code: "custom", path: ["notes"], message: "Descreva o motivo nas observações." });
    }
  });

type FormValues = z.infer<typeof schema>;

function MovementForm({ options, onDone }: { options: OpenOptions; onDone: () => void }) {
  const { role } = useAuth();
  const f = useFormatters();
  const canAdjust = can(role, "movement:adjust");
  const requestKey = useRef(crypto.randomUUID());
  const { data: locations } = useLocations();
  const activeLocations = useMemo(() => (locations ?? []).filter((l) => l.active), [locations]);
  const [picked, setPicked] = useState<Product | null>(null);

  const initialType: MovementType = options.type === "ADJUSTMENT" && !canAdjust ? "IN" : (options.type ?? "IN");
  const loc = options.locationId ? String(options.locationId) : "";
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      type: initialType,
      productId: options.productId ?? 0,
      quantity: "",
      countedQuantity: "",
      fromLocationId: initialType === "OUT" || initialType === "TRANSFER" ? loc : "",
      toLocationId: initialType === "IN" ? loc : "",
      locationId: loc,
      reason: "",
      notes: "",
      reference: "",
    },
  });
  const { control, register, handleSubmit, setValue, setError, formState } = form;
  const values = useWatch({ control });
  const type = (values.type ?? "IN") as MovementType;

  // Produto completo (com saldos por localizacao, inclusive zerados) para a previa.
  const { data: product, isFetching: loadingProduct } = useProduct(values.productId || undefined);
  const selected = product ?? picked;

  // Sugere a localizacao padrao do produto ao seleciona-lo.
  useEffect(() => {
    if (!product?.defaultLocationId) return;
    const def = String(product.defaultLocationId);
    if (type === "IN" && !form.getValues("toLocationId")) setValue("toLocationId", def);
    if (type === "OUT" && !form.getValues("fromLocationId")) setValue("fromLocationId", def);
    if (type === "TRANSFER" && !form.getValues("fromLocationId")) setValue("fromLocationId", def);
    if (type === "ADJUSTMENT" && !form.getValues("locationId")) setValue("locationId", def);
  }, [product, type, form, setValue]);

  const balanceAt = (locationId: string | undefined) =>
    selected?.locations.find((l) => String(l.locationId) === locationId)?.quantity ?? 0;

  const preview = (() => {
    if (!selected) return null;
    const qty = Number(values.quantity) || 0;
    const total = selected.stock;
    switch (type) {
      case "IN": {
        const before = balanceAt(values.toLocationId);
        return { rows: [{ label: "Destino", before, after: before + qty }], total: { before: total, after: total + qty }, invalid: false };
      }
      case "OUT": {
        const before = balanceAt(values.fromLocationId);
        return { rows: [{ label: "Origem", before, after: before - qty }], total: { before: total, after: total - qty }, invalid: qty > before };
      }
      case "TRANSFER": {
        const from = balanceAt(values.fromLocationId);
        const to = balanceAt(values.toLocationId);
        return {
          rows: [
            { label: "Origem", before: from, after: from - qty },
            { label: "Destino", before: to, after: to + qty },
          ],
          total: { before: total, after: total },
          invalid: qty > from,
        };
      }
      case "ADJUSTMENT": {
        const before = balanceAt(values.locationId);
        const counted = values.countedQuantity === "" ? before : Number(values.countedQuantity);
        return {
          rows: [{ label: "Localização", before, after: counted }],
          total: { before: total, after: total + (counted - before) },
          invalid: false,
        };
      }
    }
  })();

  const mutation = useApiMutation((body: MovementInput) => movementsApi.create(body), {
    invalidate: [keys.data],
    silentFieldErrors: true,
    success: (m) =>
      `${MOVEMENT_LABEL[m.type]} registrada: ${m.quantity} ${m.unit} · ${m.productName}. Saldo total: ${f.number(m.totalAfter)} ${m.unit}.`,
    onSuccess: () => {
      requestKey.current = crypto.randomUUID();
      onDone();
    },
  });

  function changeType(next: MovementType) {
    setValue("type", next);
    setValue("reason", "");
    form.clearErrors();
  }

  const onSubmit = handleSubmit((v) => {
    if (mutation.isPending) return;
    const body: MovementInput = {
      type: v.type,
      productId: v.productId,
      reason: v.reason,
      notes: v.notes.trim() || null,
      reference: v.reference.trim() || null,
      requestKey: requestKey.current,
    };
    if (v.type === "ADJUSTMENT") {
      body.countedQuantity = Number(v.countedQuantity);
      body.locationId = Number(v.locationId);
    } else {
      body.quantity = Number(v.quantity);
      if (v.type !== "IN") body.fromLocationId = Number(v.fromLocationId);
      if (v.type !== "OUT") body.toLocationId = Number(v.toLocationId);
    }
    mutation.mutate(body, {
      onError: (error) => {
        for (const [field, message] of Object.entries(error.fieldErrors)) {
          if (field in v) setError(field as keyof FormValues, { message });
        }
      },
    });
  });

  const errors = formState.errors;
  const locationSelect = (name: "fromLocationId" | "toLocationId" | "locationId", label: string, exclude?: string) => (
    <Field id={`mv-${name}`} label={label} error={errors[name]?.message} required>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Select value={field.value} onValueChange={field.onChange} disabled={mutation.isPending}>
            <SelectTrigger id={`mv-${name}`} onBlur={field.onBlur} aria-invalid={Boolean(errors[name])}>
              <SelectValue placeholder="Selecione…" />
            </SelectTrigger>
            <SelectContent>
              {activeLocations
                .filter((l) => String(l.id) !== exclude)
                .map((l) => (
                  <SelectItem key={l.id} value={String(l.id)}>
                    {l.code} · {l.name}
                    {selected ? ` (${balanceAt(String(l.id))} ${selected.unit})` : ""}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        )}
      />
    </Field>
  );

  return (
    <DialogContent className="max-h-[92dvh] gap-0 overflow-y-auto p-0 sm:max-w-2xl">
      <DialogHeader className="border-b px-6 py-5">
        <DialogTitle>Registrar movimentação</DialogTitle>
        <DialogDescription>{MOVEMENT_DESCRIPTION[type]}</DialogDescription>
      </DialogHeader>

      <form onSubmit={onSubmit} noValidate aria-busy={mutation.isPending}>
        <div className="space-y-5 px-6 py-5">
          <div role="radiogroup" aria-label="Tipo de movimentação" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TYPES.map((t) => {
              const disabled = t === "ADJUSTMENT" && !canAdjust;
              const active = type === t;
              return (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={disabled || mutation.isPending}
                  title={disabled ? "Ajustes exigem perfil de Gerente ou Administrador." : undefined}
                  onClick={() => changeType(t)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl border p-2.5 text-left text-sm font-medium transition-[border-color,background-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45",
                    active ? "border-primary bg-primary/5 shadow-[0_0_0_1px_var(--color-primary)]" : "hover:border-foreground/25",
                  )}
                >
                  <MovementTypeIcon type={t} className="h-7 w-7" />
                  {MOVEMENT_LABEL[t]}
                </button>
              );
            })}
          </div>

          <Field id="mv-product" label="Produto" error={errors.productId?.message} required>
            <Controller
              control={control}
              name="productId"
              render={({ field }) => (
                <ProductPicker
                  id="mv-product"
                  aria-invalid={Boolean(errors.productId)}
                  value={selected}
                  disabled={mutation.isPending}
                  onChange={(p) => {
                    setPicked(p);
                    field.onChange(p.id);
                  }}
                />
              )}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            {type === "ADJUSTMENT" ? (
              <>
                {locationSelect("locationId", "Localização contada")}
                <Field label="Saldo contado" error={errors.countedQuantity?.message} hint="Quantidade física encontrada na contagem." required>
                  <Input type="number" inputMode="numeric" min={0} step={1} disabled={mutation.isPending} {...register("countedQuantity")} />
                </Field>
              </>
            ) : (
              <>
                {type !== "IN" && locationSelect("fromLocationId", "Origem")}
                {type !== "OUT" && locationSelect("toLocationId", "Destino", type === "TRANSFER" ? values.fromLocationId : undefined)}
                <Field
                  label={`Quantidade${selected ? ` (${selected.unit})` : ""}`}
                  error={errors.quantity?.message}
                  required
                  className={type === "TRANSFER" ? "sm:col-span-2" : undefined}
                >
                  <Input type="number" inputMode="numeric" min={1} step={1} disabled={mutation.isPending} {...register("quantity")} />
                </Field>
              </>
            )}
          </div>

          {preview && (
            <div className={cn("rounded-xl border bg-surface-sunken p-4", preview.invalid && "border-destructive/40 bg-destructive/5")} aria-live="polite">
              <p className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Prévia do saldo {loadingProduct && <Loader2 className="h-3 w-3 animate-spin" />}
              </p>
              <dl className="space-y-2 text-sm">
                {[...preview.rows, { label: "Total do produto", ...preview.total }].map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">{row.label}</dt>
                    <dd className="tabular flex items-center gap-2 font-medium">
                      {f.number(row.before)}
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-label="passa a" />
                      <span className={cn(row.after < 0 && "text-destructive", row.after !== row.before && row.after >= 0 && "text-foreground")}>
                        {f.number(row.after)}
                      </span>
                      <span className="text-xs font-normal text-muted-foreground">{selected?.unit}</span>
                    </dd>
                  </div>
                ))}
              </dl>
              {preview.invalid && (
                <p className="mt-3 flex items-center gap-1.5 text-[13px] text-destructive">
                  <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" /> Saldo insuficiente na origem. Saídas não podem deixar o estoque negativo.
                </p>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="mv-reason" label="Motivo" error={errors.reason?.message} required>
              <Controller
                control={control}
                name="reason"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={mutation.isPending}>
                    <SelectTrigger id="mv-reason" onBlur={field.onBlur} aria-invalid={Boolean(errors.reason)}>
                      <SelectValue placeholder="Selecione…" />
                    </SelectTrigger>
                    <SelectContent>
                      {MOVEMENT_REASONS[type].map((reason) => (
                        <SelectItem key={reason} value={reason}>
                          {reason}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="Referência documental" error={errors.reference?.message} hint="Opcional: NF, pedido, ordem…">
              <Input placeholder="Ex.: NF 12345" disabled={mutation.isPending} {...register("reference")} />
            </Field>
          </div>

          <Field
            label="Observações"
            error={errors.notes?.message}
            hint={values.reason === "Outro" ? "Obrigatório quando o motivo é “Outro”." : undefined}
          >
            <Textarea rows={2} disabled={mutation.isPending} {...register("notes")} />
          </Field>

          <p className="flex items-start gap-2 rounded-lg bg-info/10 px-3 py-2.5 text-[13px] text-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" aria-hidden="true" />
            A movimentação altera o estoque imediatamente e fica registrada no histórico com seu usuário. Ela não pode ser editada: para corrigir, registre um ajuste.
          </p>
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button type="button" variant="outline" onClick={onDone} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.isPending || preview?.invalid}>
            {mutation.isPending && <Loader2 className="animate-spin" />}
            Registrar {MOVEMENT_LABEL[type].toLowerCase()}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
