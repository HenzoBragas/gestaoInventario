import { useCallback, useEffect, useState } from "react";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { ArrowRight, History, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type Column } from "@/components/common/DataTable";
import { PageHeader } from "@/components/common/PageHeader";
import { Pagination } from "@/components/common/Pagination";
import { EmptyState, ErrorState } from "@/components/common/States";
import { useAudit, useEmployees } from "@/lib/api/hooks";
import type { AuditEntry, AuditQuery } from "@/lib/api/types";
import { useAuth } from "@/lib/auth-provider";
import { can } from "@/lib/domain";
import { useFormatters, type Formatters } from "@/lib/format";
import { usePersistedSearch, type AuditSearch } from "@/lib/search";
import { cn } from "@/lib/utils";

const route = getRouteApi("/_app/audit");
const ALL = "__all__";

/** Valores de Tabela_alterada gravados pelos triggers (db/auditoria-triggers.sql). */
const TABLES: Record<string, string> = {
  Produto: "Produto",
  Categoria: "Categoria",
  Funcionario: "Funcionário",
  NotaFiscal: "Nota fiscal",
  Fornecedor: "Fornecedor",
  Localizacao: "Localização",
  Configuracao: "Configuração",
};

const INSERTED = "NOVO REGISTRO";
const DELETED = "REGISTRO DELETADO";

/** Datas do filtro (AAAA-MM-DD) para instantes: inicio do dia "de" ate o fim do dia "ate". */
function toRange(from?: string, to?: string) {
  const start = from ? new Date(`${from}T00:00:00`) : undefined;
  const end = to ? new Date(`${to}T00:00:00`) : undefined;
  if (end) end.setDate(end.getDate() + 1);
  return { from: start?.toISOString(), to: end?.toISOString() };
}

export function AuditPage() {
  const search = route.useSearch();
  const navigate = useNavigate({ from: "/audit" });
  const f = useFormatters();
  const { role } = useAuth();
  const allowed = can(role, "audit:read");
  const { data: employees } = useEmployees();
  const [text, setText] = useState(search.q ?? "");

  const setSearch = useCallback(
    (patch: Partial<AuditSearch>) => navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true }),
    [navigate],
  );
  usePersistedSearch("audit", search, (saved) => setSearch(saved));

  useEffect(() => setText(search.q ?? ""), [search.q]);
  useEffect(() => {
    const value = text.trim() || undefined;
    if (value === search.q) return;
    const timer = window.setTimeout(() => setSearch({ q: value, page: 0 }), 300);
    return () => window.clearTimeout(timer);
  }, [text, search.q, setSearch]);

  const query: AuditQuery = {
    table: search.table,
    employeeId: search.employeeId,
    q: search.q,
    ...toRange(search.from, search.to),
    page: search.page ?? 0,
    size: search.size ?? 25,
  };
  const { data, isLoading, isError, error, refetch, isPlaceholderData } = useAudit(query, allowed);
  const hasFilters = Boolean(search.table || search.employeeId || search.q || search.from || search.to);

  if (!allowed) {
    return (
      <div className="space-y-6">
        <PageHeader title="Auditoria" />
        <section className="rounded-xl border glass">
          <EmptyState icon={History} title="Acesso restrito" description="A auditoria está disponível para gerentes e administradores." />
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Auditoria"
        description="Alterações registradas pelos triggers do banco de dados: uma linha por campo alterado, com o valor anterior, o atual, o funcionário e o usuário do banco."
      />

      <div className="space-y-3">
        <div className="flex flex-col gap-2 xl:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              type="search"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Buscar por campo, valor ou usuário do banco"
              aria-label="Buscar na auditoria"
              className="pl-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 xl:flex">
            <Select value={search.table ?? ALL} onValueChange={(v) => setSearch({ table: v === ALL ? undefined : v, page: 0 })}>
              <SelectTrigger className="w-full xl:w-44" aria-label="Filtrar por tabela">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas as tabelas</SelectItem>
                {Object.entries(TABLES).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={search.employeeId ? String(search.employeeId) : ALL} onValueChange={(v) => setSearch({ employeeId: v === ALL ? undefined : Number(v), page: 0 })}>
              <SelectTrigger className="w-full xl:w-48" aria-label="Filtrar por funcionário">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos os funcionários</SelectItem>
                {(employees ?? []).map((e) => (
                  <SelectItem key={e.id} value={String(e.id)}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="date" value={search.from ?? ""} max={search.to} onChange={(e) => setSearch({ from: e.target.value || undefined, page: 0 })} aria-label="Data inicial" className="w-full xl:w-40" />
            <Input type="date" value={search.to ?? ""} min={search.from} onChange={(e) => setSearch({ to: e.target.value || undefined, page: 0 })} aria-label="Data final" className="w-full xl:w-40" />
          </div>
        </div>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => setSearch({ table: undefined, employeeId: undefined, q: undefined, from: undefined, to: undefined, page: 0 })}
          >
            <X /> Limpar filtros
          </Button>
        )}
      </div>

      <section className="rounded-xl border glass" aria-label="Registros de auditoria">
        <div className="border-b px-4 py-3 text-sm text-muted-foreground">{data ? `${f.number(data.totalItems)} registro(s)` : "Carregando…"}</div>
        {isError ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : (
          <DataTable
            caption="Registros de auditoria"
            columns={auditColumns(f)}
            rows={data?.items ?? []}
            rowKey={(e) => e.id}
            rowLabel={(e) => `alteração ${e.id}`}
            loading={isLoading}
            refreshing={isPlaceholderData}
            empty={
              <EmptyState
                icon={History}
                title={hasFilters ? "Nenhum registro com esses filtros" : "Nenhum registro de auditoria"}
                description={hasFilters ? "Amplie o período ou remova filtros." : "As alterações de cadastro aparecerão aqui."}
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

function auditColumns(f: Formatters): Column<AuditEntry>[] {
  return [
    { id: "date", header: "Data e hora", cell: (e) => <span className="whitespace-nowrap text-xs">{f.dateTime(e.changedAt)}</span> },
    { id: "table", header: "Tabela", cell: (e) => <span className="whitespace-nowrap font-medium">{TABLES[e.table] ?? e.table}</span> },
    { id: "field", header: "Campo", cell: (e) => <FieldLabel field={e.field} /> },
    { id: "change", header: "Alteração", className: "min-w-64 max-w-[28rem]", cell: (e) => <Change entry={e} /> },
    {
      id: "employee",
      header: "Funcionário",
      cell: (e) =>
        e.employeeName ? (
          <span className="whitespace-nowrap">{e.employeeName}</span>
        ) : (
          <span className="whitespace-nowrap text-xs text-muted-foreground" title="Alteração feita sem um usuário logado (carga inicial ou direto no banco).">
            {e.employeeId ? `#${e.employeeId}` : "Sistema"}
          </span>
        ),
    },
    { id: "dbUser", header: "Usuário do banco", cell: (e) => <span className="font-mono text-xs text-muted-foreground">{e.dbUser}</span> },
  ];
}

function FieldLabel({ field }: { field: string }) {
  if (field === INSERTED || field === DELETED) {
    return (
      <span
        className={cn(
          "inline-flex whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
          field === INSERTED ? "bg-success/12 text-success" : "bg-destructive/10 text-destructive",
        )}
      >
        {field === INSERTED ? "Novo registro" : "Registro excluído"}
      </span>
    );
  }
  return <span className="font-mono text-xs">{field}</span>;
}

function Change({ entry }: { entry: AuditEntry }) {
  if (entry.field === INSERTED) return <span className="block truncate" title={entry.newValue}>{entry.newValue}</span>;
  if (entry.field === DELETED) return <span className="block truncate text-muted-foreground line-through" title={entry.oldValue}>{entry.oldValue}</span>;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="min-w-0 truncate text-muted-foreground" title={entry.oldValue}>
        {entry.oldValue}
      </span>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="para" />
      <span className="min-w-0 truncate font-medium" title={entry.newValue}>
        {entry.newValue}
      </span>
    </span>
  );
}
