import { useCallback, useEffect, useId, useRef, useState } from "react";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Download, FileUp, Loader2, MoreHorizontal, Paperclip, Pencil, Plus, ReceiptText, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataTable, type Column, type Sort } from "@/components/common/DataTable";
import { Field } from "@/components/common/Field";
import { PageHeader } from "@/components/common/PageHeader";
import { Pagination } from "@/components/common/Pagination";
import { EmptyState, ErrorState } from "@/components/common/States";
import { ProductPicker } from "@/features/movements/ProductPicker";
import { keys, useApiMutation, useEmployees, useInvoices, useProduct } from "@/lib/api/hooks";
import { ApiError, toApiError } from "@/lib/api/client";
import { invoicesApi } from "@/lib/api/services";
import type { Invoice, InvoiceInput, InvoiceQuery, Product } from "@/lib/api/types";
import { useAuth } from "@/lib/auth-provider";
import { can } from "@/lib/domain";
import { useFormatters, type Formatters } from "@/lib/format";
import { usePersistedSearch, type InvoicesSearch } from "@/lib/search";
import { cn } from "@/lib/utils";

const route = getRouteApi("/_app/invoices");
const ALL = "__all__";
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const FILE_EXTENSIONS = [".pdf", ".xml", ".png", ".jpg", ".jpeg"];

export function InvoicesPage() {
  const search = route.useSearch();
  const navigate = useNavigate({ from: "/invoices" });
  const f = useFormatters();
  const { role } = useAuth();
  const canWrite = can(role, "catalog:write");
  const { data: employees } = useEmployees();
  const { data: product } = useProduct(search.productId);
  const [text, setText] = useState(search.q ?? "");
  const [form, setForm] = useState<{ open: boolean; invoice: Invoice | null }>({ open: false, invoice: null });
  const [toDelete, setToDelete] = useState<Invoice | null>(null);

  const { new: openNew, ...filters } = search;
  const setSearch = useCallback(
    (patch: Partial<InvoicesSearch>) => navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true }),
    [navigate],
  );
  usePersistedSearch("invoices", filters, (saved) => setSearch(saved));

  // ?new=true (vindo do detalhe do produto): abre o formulario com o produto ja escolhido.
  useEffect(() => {
    if (!openNew) return;
    if (canWrite && (!search.productId || product)) {
      setForm({ open: true, invoice: null });
      setSearch({ new: undefined });
    } else if (!canWrite) {
      setSearch({ new: undefined });
    }
  }, [openNew, canWrite, search.productId, product, setSearch]);

  useEffect(() => setText(search.q ?? ""), [search.q]);
  useEffect(() => {
    const value = text.trim() || undefined;
    if (value === search.q) return;
    const timer = window.setTimeout(() => setSearch({ q: value, page: 0 }), 300);
    return () => window.clearTimeout(timer);
  }, [text, search.q, setSearch]);

  const sort: Sort = { key: search.sort ?? "paymentDate", direction: search.dir ?? "desc" };
  const query: InvoiceQuery = {
    q: search.q,
    productId: search.productId,
    employeeId: search.employeeId,
    from: search.from,
    to: search.to,
    sort: sort.key,
    dir: sort.direction,
    page: search.page ?? 0,
    size: search.size ?? 25,
  };
  const { data, isLoading, isError, error, refetch, isPlaceholderData } = useInvoices(query);
  const hasFilters = Boolean(search.q || search.productId || search.employeeId || search.from || search.to);

  const remove = useApiMutation((inv: Invoice) => invoicesApi.remove(inv.id), { success: (_, inv) => `Nota fiscal ${inv.number} excluída.` });

  const columns: Column<Invoice>[] = [
    { id: "number", header: "Número", sortKey: "number", cell: (inv) => <span className="whitespace-nowrap font-mono text-xs font-medium">{inv.number}</span> },
    {
      id: "product",
      header: "Produto",
      sortKey: "product",
      className: "min-w-48 max-w-72",
      cell: (inv) => (
        <Link
          to="/products/$productId"
          params={{ productId: String(inv.productId) }}
          className="block min-w-0 rounded hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="block truncate">{inv.productName}</span>
          <span className="block font-mono text-[11px] text-muted-foreground">{inv.productCode}</span>
        </Link>
      ),
    },
    { id: "place", header: "Local de compra", sortKey: "purchasePlace", className: "max-w-56", cell: (inv) => <span className="block truncate">{inv.purchasePlace}</span> },
    { id: "paymentDate", header: "Pagamento", sortKey: "paymentDate", cell: (inv) => <span className="whitespace-nowrap">{f.day(inv.paymentDate)}</span> },
    { id: "amount", header: "Valor", sortKey: "amount", align: "right", cell: (inv) => <span className="font-medium">{f.money(inv.amount)}</span> },
    { id: "employee", header: "Responsável", cell: (inv) => <span className="text-muted-foreground">{inv.employeeName}</span> },
    { id: "file", header: "Anexo", cell: (inv) => <AttachmentButton invoice={inv} /> },
    {
      id: "actions",
      header: "Ações",
      align: "right",
      fixed: true,
      cell: (inv) =>
        canWrite ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Ações para a nota ${inv.number}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onSelect={() => setForm({ open: true, invoice: inv })}>
                <Pencil /> Editar
              </DropdownMenuItem>
              {inv.fileName && (
                <DropdownMenuItem onSelect={() => downloadFile(inv)}>
                  <Download /> Baixar anexo
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setToDelete(inv)} className="text-destructive focus:text-destructive">
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
        title="Notas fiscais"
        description="Notas de compra vinculadas aos produtos, com o arquivo da NF-e. Toda alteração fica registrada na auditoria."
        actions={canWrite && <Button onClick={() => setForm({ open: true, invoice: null })}><Plus /> Nova nota fiscal</Button>}
      />

      <div className="space-y-3">
        <div className="flex flex-col gap-2 xl:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              type="search"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Buscar por número, local de compra ou produto"
              aria-label="Buscar notas fiscais"
              className="pl-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:flex">
            <Select value={search.employeeId ? String(search.employeeId) : ALL} onValueChange={(v) => setSearch({ employeeId: v === ALL ? undefined : Number(v), page: 0 })}>
              <SelectTrigger className="col-span-2 w-full sm:col-span-1 xl:w-52" aria-label="Filtrar por responsável">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos os responsáveis</SelectItem>
                {(employees ?? []).map((e) => (
                  <SelectItem key={e.id} value={String(e.id)}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="date" value={search.from ?? ""} max={search.to} onChange={(e) => setSearch({ from: e.target.value || undefined, page: 0 })} aria-label="Pagamento a partir de" className="w-full xl:w-40" />
            <Input type="date" value={search.to ?? ""} min={search.from} onChange={(e) => setSearch({ to: e.target.value || undefined, page: 0 })} aria-label="Pagamento até" className="w-full xl:w-40" />
          </div>
        </div>
        {hasFilters && (
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
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setSearch({ q: undefined, productId: undefined, employeeId: undefined, from: undefined, to: undefined, page: 0 })}
            >
              <X /> Limpar filtros
            </Button>
          </div>
        )}
      </div>

      <section className="rounded-xl border glass" aria-label="Notas fiscais">
        <div className="border-b px-4 py-3 text-sm text-muted-foreground">{data ? `${f.number(data.totalItems)} nota(s) fiscal(is)` : "Carregando…"}</div>
        {isError ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : (
          <DataTable
            caption="Notas fiscais"
            columns={columns}
            rows={data?.items ?? []}
            rowKey={(inv) => inv.id}
            rowLabel={(inv) => `nota ${inv.number}`}
            loading={isLoading}
            refreshing={isPlaceholderData}
            sort={sort}
            onSort={(next) => setSearch({ sort: next.key, dir: next.direction, page: 0 })}
            empty={
              <EmptyState
                icon={ReceiptText}
                title={hasFilters ? "Nenhuma nota com esses filtros" : "Nenhuma nota fiscal cadastrada"}
                description={hasFilters ? "Amplie o período ou remova filtros." : canWrite ? "Cadastre a primeira nota de compra." : undefined}
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

      <InvoiceFormDialog
        open={form.open}
        invoice={form.invoice}
        defaultProduct={!form.invoice && product ? product : null}
        onOpenChange={(open) => setForm((s) => ({ ...s, open }))}
      />
      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Excluir nota fiscal?"
        description={`A nota ${toDelete?.number} e o arquivo anexado serão excluídos permanentemente. A exclusão fica registrada na auditoria.`}
        confirmLabel="Excluir"
        destructive
        onConfirm={() => (toDelete ? remove.mutateAsync(toDelete) : undefined)}
      />
    </div>
  );
}

async function downloadFile(invoice: Pick<Invoice, "id">) {
  try {
    await invoicesApi.download(invoice.id);
  } catch (e) {
    toast.error(toApiError(e).message);
  }
}

/** Botao de download do anexo (ou traco quando a nota nao tem arquivo). */
export function AttachmentButton({ invoice }: { invoice: Invoice }) {
  const [busy, setBusy] = useState(false);
  if (!invoice.fileName) return <span className="text-muted-foreground">—</span>;
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 max-w-44 px-2 text-xs"
      disabled={busy}
      title={`Baixar ${invoice.fileName}`}
      aria-label={`Baixar anexo ${invoice.fileName}`}
      onClick={async (e) => {
        e.stopPropagation();
        setBusy(true);
        await downloadFile(invoice);
        setBusy(false);
      }}
    >
      {busy ? <Loader2 className="animate-spin" /> : <Paperclip />}
      <span className="truncate">{invoice.fileName}</span>
    </Button>
  );
}

// ------------------------------------------------------------------ formulario

/** Aceita "1.250,90", "1250,9", "1250.90" ou "1.250" (milhar). */
function parseAmount(raw: string): number | null {
  const v = raw.replace(/\s|R\$/g, "");
  if (!/^\d+([.,]\d{1,2})?$|^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(v)) return null;
  const normalized = v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : /^\d{1,3}(\.\d{3})+$/.test(v) ? v.replace(/\./g, "") : v;
  const n = Number(normalized);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

function fileProblem(file: File): string | null {
  const name = file.name.toLowerCase();
  if (!FILE_EXTENSIONS.some((ext) => name.endsWith(ext))) return "Envie a nota em PDF, XML, PNG ou JPG.";
  if (file.size === 0) return "O arquivo está vazio.";
  if (file.size > MAX_FILE_BYTES) return "O arquivo deve ter no máximo 5 MB.";
  return null;
}

const invoiceSchema = z.object({
  number: z.string().trim().min(1, "Informe o número da nota.").max(50, "Máximo de 50 caracteres."),
  purchasePlace: z.string().trim().min(1, "Informe o local de compra.").max(100, "Máximo de 100 caracteres."),
  amount: z
    .string()
    .trim()
    .min(1, "Informe o valor.")
    .refine((v) => parseAmount(v) !== null, "Valor inválido. Exemplo: 1.250,90")
    .refine((v) => (parseAmount(v) ?? 1) >= 0.01, "O valor deve ser maior que zero.")
    .refine((v) => (parseAmount(v) ?? 0) < 100_000_000, "Use no máximo 8 dígitos antes da vírgula."),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data de pagamento."),
  productId: z.number().int().positive("Selecione o produto."),
  employeeId: z.string().min(1, "Selecione o responsável."),
});
type InvoiceForm = z.infer<typeof invoiceSchema>;

interface SaveVariables {
  body: InvoiceInput;
  file: File | null;
  removeFile: boolean;
}

function InvoiceFormDialog({
  open,
  invoice,
  defaultProduct,
  onOpenChange,
}: {
  open: boolean;
  invoice: Invoice | null;
  defaultProduct: Pick<Product, "id" | "name" | "sku"> | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { user } = useAuth();
  const { data: employees } = useEmployees();
  const queryClient = useQueryClient();
  const f = useFormatters();
  const fileInputId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  // Nota em edicao; passa a ser a nota recem-criada se o envio do anexo falhar.
  const [current, setCurrent] = useState<Invoice | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [removeFile, setRemoveFile] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [picked, setPicked] = useState<Pick<Product, "id" | "name" | "sku"> | null>(null);

  const { register, control, handleSubmit, reset, setError, formState } = useForm<InvoiceForm>({ resolver: zodResolver(invoiceSchema), mode: "onTouched" });
  const errors = formState.errors;

  // Preenche so ao abrir: um refetch com o dialogo aberto nao apaga o que foi digitado.
  const wasOpen = useRef(false);
  useEffect(() => {
    const opening = open && !wasOpen.current;
    wasOpen.current = open;
    if (!opening) return;
    setCurrent(invoice);
    setFile(null);
    setRemoveFile(false);
    setFileError(null);
    setPicked(invoice ? { id: invoice.productId, name: invoice.productName, sku: invoice.productCode } : defaultProduct);
    reset({
      number: invoice?.number ?? "",
      purchasePlace: invoice?.purchasePlace ?? "",
      amount: invoice ? invoice.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "",
      paymentDate: invoice?.paymentDate ?? new Date().toLocaleDateString("en-CA"),
      productId: invoice?.productId ?? defaultProduct?.id ?? 0,
      employeeId: String(invoice?.employeeId ?? user?.id ?? ""),
    });
  }, [open, invoice, defaultProduct, user, reset]);

  // Responsavel inativo de uma nota antiga continua selecionavel na edicao.
  const employeeOptions = [...(employees ?? [])];
  if (current && !employeeOptions.some((e) => e.id === current.employeeId)) {
    employeeOptions.push({ id: current.employeeId, name: `${current.employeeName} (inativo)`, username: "" });
  }

  const save = useApiMutation(
    async ({ body, file, removeFile }: SaveVariables) => {
      let saved = current ? await invoicesApi.update(current.id, body) : await invoicesApi.create(body);
      try {
        if (file) saved = await invoicesApi.attach(saved.id, file);
        else if (removeFile && saved.fileName) saved = await invoicesApi.detach(saved.id);
      } catch (e) {
        const err = toApiError(e);
        setCurrent(saved);
        setFileError(err.fieldErrors.file ?? err.message);
        await queryClient.invalidateQueries({ queryKey: keys.data });
        throw new ApiError(err.status, err.code, `A nota foi salva, mas o anexo não foi atualizado: ${err.message}`);
      }
      return saved;
    },
    {
      silentFieldErrors: true,
      success: (saved) => (current ? `Nota fiscal ${saved.number} atualizada.` : `Nota fiscal ${saved.number} cadastrada.`),
      onSuccess: () => onOpenChange(false),
    },
  );

  function pickFile(next: File | undefined) {
    if (!next) return;
    const problem = fileProblem(next);
    setFileError(problem);
    if (!problem) {
      setFile(next);
      setRemoveFile(false);
    }
  }

  const onSubmit = handleSubmit((v) => {
    if (fileError && file) return;
    const amount = parseAmount(v.amount) as number;
    save.mutate(
      {
        body: {
          number: v.number.trim(),
          purchasePlace: v.purchasePlace.trim(),
          amount,
          paymentDate: v.paymentDate,
          productId: v.productId,
          employeeId: Number(v.employeeId),
        },
        file,
        removeFile,
      },
      {
        onError: (e) => {
          for (const [field, message] of Object.entries(e.fieldErrors)) {
            if (field in v) setError(field as keyof InvoiceForm, { message });
          }
        },
      },
    );
  });

  const busy = save.isPending;
  const existingFile = current?.fileName && !removeFile && !file ? current : null;

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{current ? `Editar nota ${current.number}` : "Nova nota fiscal"}</DialogTitle>
          <DialogDescription>Dados da compra e, opcionalmente, o arquivo da NF-e (PDF, XML ou imagem, até 5 MB).</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="min-w-0 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Número da nota" error={errors.number?.message} required>
              <Input disabled={busy} autoComplete="off" className="font-mono" {...register("number")} />
            </Field>
            <Field label="Valor (R$)" error={errors.amount?.message} required>
              <Input inputMode="decimal" placeholder="0,00" disabled={busy} className="tabular" {...register("amount")} />
            </Field>
          </div>
          <Field label="Local de compra" error={errors.purchasePlace?.message} required>
            <Input disabled={busy} placeholder="Fornecedor, loja ou site" {...register("purchasePlace")} />
          </Field>
          <Controller
            control={control}
            name="productId"
            render={({ field }) => (
              <Field label="Produto" id="invoice-product" error={errors.productId?.message} required>
                <ProductPicker
                  id="invoice-product"
                  value={picked}
                  onChange={(p) => {
                    setPicked(p);
                    field.onChange(p.id);
                  }}
                  activeOnly={false}
                  disabled={busy}
                  aria-invalid={Boolean(errors.productId)}
                />
              </Field>
            )}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Data de pagamento" error={errors.paymentDate?.message} required>
              <Input type="date" disabled={busy} {...register("paymentDate")} />
            </Field>
            <Controller
              control={control}
              name="employeeId"
              render={({ field }) => (
                <Field label="Responsável pela compra" id="invoice-employee" error={errors.employeeId?.message} required>
                  <Select value={field.value} onValueChange={field.onChange} disabled={busy}>
                    <SelectTrigger id="invoice-employee" aria-invalid={Boolean(errors.employeeId)}>
                      <SelectValue placeholder="Selecione…" />
                    </SelectTrigger>
                    <SelectContent>
                      {employeeOptions.map((e) => (
                        <SelectItem key={e.id} value={String(e.id)}>
                          {e.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor={fileInputId} className="text-[13px] font-medium">
              Arquivo da NF-e
            </label>
            {existingFile ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border p-3 text-sm">
                <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 flex-1 basis-40">
                  <span className="block truncate font-medium">{existingFile.fileName}</span>
                  <span className="text-xs text-muted-foreground">
                    {existingFile.fileSize ? formatBytes(existingFile.fileSize) : ""} · atualizado {f.relative(existingFile.updatedAt)}
                  </span>
                </span>
                <div className="ml-auto flex shrink-0 items-center gap-1">
                  <Button type="button" variant="ghost" size="sm" onClick={() => downloadFile(existingFile)} disabled={busy}>
                    <Download /> Baixar
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => fileInput.current?.click()} disabled={busy}>
                    Substituir
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setRemoveFile(true)} disabled={busy} aria-label="Remover anexo">
                    <Trash2 />
                  </Button>
                </div>
              </div>
            ) : (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  pickFile(e.dataTransfer.files[0]);
                }}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg border border-dashed p-4 text-center text-sm transition-colors",
                  dragging && "border-primary bg-primary/5",
                  fileError && "border-destructive",
                )}
              >
                {file ? (
                  <div className="flex w-full items-center gap-3 text-left">
                    <FileUp className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{file.name}</span>
                      <span className="text-xs text-muted-foreground">{formatBytes(file.size)} · será enviado ao salvar</span>
                    </span>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setFile(null)} disabled={busy} aria-label="Descartar arquivo selecionado">
                      <X />
                    </Button>
                  </div>
                ) : (
                  <>
                    <FileUp className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                    <p className="text-muted-foreground">
                      Arraste o arquivo aqui ou{" "}
                      <button type="button" className="font-medium text-primary hover:underline" onClick={() => fileInput.current?.click()} disabled={busy}>
                        escolha no computador
                      </button>
                    </p>
                    <p className="text-xs text-muted-foreground">PDF, XML, PNG ou JPG · até 5 MB</p>
                    {removeFile && (
                      <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => setRemoveFile(false)}>
                        Manter o anexo atual ({current?.fileName})
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
            <input
              ref={fileInput}
              id={fileInputId}
              type="file"
              accept={[...FILE_EXTENSIONS, "application/pdf", "application/xml", "text/xml", "image/png", "image/jpeg"].join(",")}
              className="sr-only"
              aria-describedby={fileError ? `${fileInputId}-error` : undefined}
              onChange={(e) => {
                pickFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            {fileError && (
              <p id={`${fileInputId}-error`} className="text-[13px] text-destructive">
                {fileError}
              </p>
            )}
            {removeFile && <p className="text-[13px] text-muted-foreground">O anexo atual será removido ao salvar.</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Lista compacta das notas de um produto (detalhe do produto). */
export function ProductInvoicesCard({ productId, canWrite, f }: { productId: number; canWrite: boolean; f: Formatters }) {
  const { data, isLoading } = useInvoices({ productId, size: 5, sort: "paymentDate", dir: "desc" });
  return (
    <section className="rounded-xl border glass" aria-label="Notas fiscais do produto">
      <header className="flex items-center justify-between gap-2 border-b px-5 py-3.5">
        <h2 className="text-sm font-semibold">Notas fiscais{data ? ` (${f.number(data.totalItems)})` : ""}</h2>
        <div className="flex items-center gap-3">
          {canWrite && (
            <Link to="/invoices" search={{ productId, new: true } as never} className="text-xs font-medium text-primary hover:underline">
              Nova nota
            </Link>
          )}
          {Boolean(data?.totalItems) && (
            <Link to="/invoices" search={{ productId } as never} className="text-xs font-medium text-primary hover:underline">
              Ver todas
            </Link>
          )}
        </div>
      </header>
      {isLoading ? (
        <div className="space-y-2 p-5">
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
        </div>
      ) : !data?.items.length ? (
        <p className="px-5 py-4 text-sm text-muted-foreground">Nenhuma nota fiscal vinculada.</p>
      ) : (
        <ul className="divide-y">
          {data.items.map((inv) => (
            <li key={inv.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block truncate">
                  <span className="font-mono text-xs font-medium">{inv.number}</span> · {inv.purchasePlace}
                </span>
                <span className="text-xs text-muted-foreground">
                  {f.day(inv.paymentDate)} · {f.money(inv.amount)}
                </span>
              </span>
              {inv.fileName && (
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => downloadFile(inv)} title={`Baixar ${inv.fileName}`} aria-label={`Baixar anexo da nota ${inv.number}`}>
                  <Download />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
