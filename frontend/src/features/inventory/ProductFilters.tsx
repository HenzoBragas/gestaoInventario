import { useEffect, useState } from "react";
import { CircleOff, CircleSlash, CircleDollarSign, Search, TriangleAlert, X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCategories, useLocations, useSuppliers } from "@/lib/api/hooks";
import type { StockStatus } from "@/lib/api/types";
import type { InventorySearch } from "@/lib/search";
import { cn } from "@/lib/utils";

interface ProductFiltersProps {
  search: InventorySearch;
  onChange: (patch: Partial<InventorySearch>) => void;
  /** Quais filtros mostrar (Inventario: localizacao; Produtos: fornecedor). */
  show: { location?: boolean; supplier?: boolean };
}

const ALL = "__all__";

const QUICK: { status: StockStatus; label: string; icon: LucideIcon }[] = [
  { status: "LOW_STOCK", label: "Estoque baixo", icon: TriangleAlert },
  { status: "OUT_OF_STOCK", label: "Sem estoque", icon: CircleSlash },
  { status: "INACTIVE", label: "Inativos", icon: CircleOff },
];

/** Filtros combinaveis: todos atuam juntos e ficam na URL. */
export function ProductFilters({ search, onChange, show }: ProductFiltersProps) {
  const { data: categories } = useCategories();
  const { data: locations } = useLocations();
  const { data: suppliers } = useSuppliers();
  const [text, setText] = useState(search.q ?? "");

  // Debounce da busca textual e sincronia quando a URL muda por fora (ex.: busca global).
  useEffect(() => setText(search.q ?? ""), [search.q]);
  useEffect(() => {
    const value = text.trim() || undefined;
    if (value === search.q) return;
    const timer = window.setTimeout(() => onChange({ q: value, page: 0 }), 300);
    return () => window.clearTimeout(timer);
  }, [text, search.q, onChange]);

  const statuses = search.status ?? [];
  const toggleStatus = (status: StockStatus) => {
    const next = statuses.includes(status) ? statuses.filter((s) => s !== status) : [...statuses, status];
    onChange({ status: next.length ? next : undefined, page: 0 });
  };

  const active =
    Boolean(search.q || search.categoryId || search.locationId || search.supplierId || search.missingCost) || statuses.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Buscar por nome, SKU, modelo ou código de barras"
            aria-label="Buscar produtos"
            className="pl-9"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <FilterSelect
            label="Categoria"
            allLabel="Todas as categorias"
            value={search.categoryId}
            onChange={(categoryId) => onChange({ categoryId, page: 0 })}
            options={(categories ?? []).map((c) => ({ value: c.seq, label: c.active ? c.name : `${c.name} (inativa)` }))}
          />
          {show.location && (
            <FilterSelect
              label="Localização"
              allLabel="Todas as localizações"
              value={search.locationId}
              onChange={(locationId) => onChange({ locationId, page: 0 })}
              options={(locations ?? []).map((l) => ({ value: l.id, label: `${l.code} · ${l.name}` }))}
            />
          )}
          {show.supplier && (
            <FilterSelect
              label="Fornecedor"
              allLabel="Todos os fornecedores"
              value={search.supplierId}
              onChange={(supplierId) => onChange({ supplierId, page: 0 })}
              options={(suppliers ?? []).map((s) => ({ value: s.id, label: s.name }))}
            />
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtros rápidos de status">
        {QUICK.map(({ status, label, icon: Icon }) => {
          const on = statuses.includes(status);
          return (
            <button
              key={status}
              type="button"
              aria-pressed={on}
              onClick={() => toggleStatus(status)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                on ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:border-foreground/25 hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {label}
            </button>
          );
        })}
        {search.missingCost && (
          <button
            type="button"
            aria-pressed
            onClick={() => onChange({ missingCost: undefined, page: 0 })}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-primary bg-primary/10 px-3 text-xs font-medium text-primary"
          >
            <CircleDollarSign className="h-3.5 w-3.5" aria-hidden="true" /> Sem custo
            <X className="h-3 w-3" aria-label="Remover filtro" />
          </button>
        )}
        {active && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() =>
              onChange({ q: undefined, categoryId: undefined, locationId: undefined, supplierId: undefined, status: undefined, missingCost: undefined, page: 0 })
            }
          >
            <X /> Limpar filtros
          </Button>
        )}
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  allLabel,
  value,
  onChange,
  options,
}: {
  label: string;
  allLabel: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  options: { value: number; label: string }[];
}) {
  return (
    <Select value={value ? String(value) : ALL} onValueChange={(v) => onChange(v === ALL ? undefined : Number(v))}>
      <SelectTrigger className={cn("w-full sm:w-48", value && "border-primary/50 text-primary")} aria-label={`Filtrar por ${label.toLowerCase()}`}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={String(o.value)}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
