import { useEffect, useState } from "react";
import { History, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination } from "@/components/common/Pagination";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common/States";
import { Panel } from "@/features/settings/Panel";
import { useAudit } from "@/lib/api/hooks";
import { useFormatters } from "@/lib/format";
import { cn } from "@/lib/utils";

const ENTITIES: Record<string, string> = {
  PRODUTO: "Produtos",
  CATEGORIA: "Categorias",
  FORNECEDOR: "Fornecedores",
  LOCALIZACAO: "Localizações",
  USUARIO: "Usuários",
  CONFIGURACAO: "Configurações",
};
const ACTIONS: Record<string, string> = {
  CRIACAO: "Criação",
  EDICAO: "Edição",
  EXCLUSAO: "Exclusão",
  DESATIVACAO: "Desativação",
  REATIVACAO: "Reativação",
  REATRIBUICAO: "Reatribuição",
  SENHA: "Senha",
};
const ALL = "__all__";

/** Trilha de auditoria de cadastros e configuracoes (movimentacoes de estoque tem historico proprio). */
export function AuditPanel() {
  const f = useFormatters();
  const [entity, setEntity] = useState<string | undefined>();
  const [text, setText] = useState("");
  const [q, setQ] = useState<string | undefined>();
  const [page, setPage] = useState(0);
  const { data, isLoading, isError, error, refetch, isPlaceholderData } = useAudit({ entity, q, page }, true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQ(text.trim() || undefined);
      setPage(0);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [text]);

  return (
    <Panel title="Auditoria" description="Alterações de cadastros, usuários e configurações. As movimentações de estoque são auditadas no próprio histórico.">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Buscar por descrição ou usuário" aria-label="Buscar na auditoria" className="pl-9" />
        </div>
        <Select value={entity ?? ALL} onValueChange={(v) => { setEntity(v === ALL ? undefined : v); setPage(0); }}>
          <SelectTrigger className="sm:w-48" aria-label="Filtrar por área"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas as áreas</SelectItem>
            {Object.entries(ENTITIES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="rounded-lg border">
        {isLoading ? (
          <TableSkeleton rows={6} columns={4} />
        ) : isError ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : !data?.items.length ? (
          <EmptyState icon={History} title="Nenhum registro de auditoria" description="Alterações de cadastro aparecerão aqui." />
        ) : (
          <>
            <ol className={cn("divide-y", isPlaceholderData && "opacity-60")}>
              {data.items.map((e) => (
                <li key={e.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:gap-4">
                  <span className="w-36 shrink-0 text-xs text-muted-foreground">{f.dateTime(e.createdAt)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="text-sm">{e.summary}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {ENTITIES[e.entity] ?? e.entity} · {ACTIONS[e.action] ?? e.action} · por <span className="font-mono">{e.username}</span>
                    </span>
                  </span>
                </li>
              ))}
            </ol>
            <Pagination page={data.page} size={data.size} totalItems={data.totalItems} totalPages={data.totalPages} onPageChange={setPage} />
          </>
        )}
      </div>
    </Panel>
  );
}
