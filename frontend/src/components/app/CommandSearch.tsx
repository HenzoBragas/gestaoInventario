import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeftRight, FolderTree, MapPin, Package, Plus, Search, Truck } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { ALL_NAV_ITEMS } from "@/components/app/navigation";
import { useMovementDialog } from "@/features/movements/MovementDialog";
import { useCategories, useLocations, useSuppliers } from "@/lib/api/hooks";
import { productsApi } from "@/lib/api/services";
import { useAuth } from "@/lib/auth-provider";
import { can } from "@/lib/domain";
import { StatusBadge } from "@/components/common/Badges";

function useDebounced<T>(value: T, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function SearchTrigger({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="flex h-9 w-full max-w-md items-center gap-2 rounded-lg border glass-subtle px-3 text-sm text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label="Buscar produtos e registros (Ctrl+K)"
    >
      <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="hidden truncate sm:inline">Buscar produtos, SKUs, fornecedores…</span>
      <span className="sm:hidden">Buscar</span>
      <kbd className="ml-auto hidden rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium sm:inline">Ctrl K</kbd>
    </button>
  );
}

export function CommandSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { openMovement } = useMovementDialog();
  const [query, setQuery] = useState("");
  const term = useDebounced(query.trim());
  const { data: suppliers } = useSuppliers();
  const { data: locations } = useLocations();
  const { data: categories } = useCategories();

  const products = useQuery({
    queryKey: ["data", "search", term],
    queryFn: () => productsApi.list({ q: term, size: 6 }),
    enabled: open && term.length >= 2,
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const lower = term.toLowerCase();
  const match = (text: string | null | undefined) => Boolean(text && lower && text.toLowerCase().includes(lower));

  function go(to: string, search?: Record<string, unknown>) {
    onOpenChange(false);
    void navigate({ to, search: search as never });
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Busca global"
      description="Busque produtos, fornecedores, localizações e categorias, ou navegue entre as páginas."
    >
      {/* A filtragem de produtos e feita no servidor; o cmdk nao refiltra os resultados. */}
      <CommandInput placeholder="Buscar por nome, SKU, código de barras ou cadastro…" value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>{products.isFetching ? "Buscando…" : "Nenhum resultado."}</CommandEmpty>

        {term.length >= 2 && (products.data?.items.length ?? 0) > 0 && (
          <CommandGroup heading="Produtos">
            {products.data!.items.map((p) => (
              <CommandItem key={p.id} value={`produto ${p.id} ${p.sku} ${p.name} ${term}`} onSelect={() => go(`/products/${p.id}`)}>
                <Package aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{p.name}</span>
                  <span className="block font-mono text-xs text-muted-foreground">{p.sku}</span>
                </span>
                <StatusBadge status={p.status} />
              </CommandItem>
            ))}
            <CommandItem value={`ver todos ${term}`} onSelect={() => go("/inventory", { q: term })}>
              <Search aria-hidden="true" /> Ver todos os resultados para “{term}” no inventário
            </CommandItem>
          </CommandGroup>
        )}

        {lower && (
          <>
            {suppliers?.filter((s) => match(s.name) || match(s.taxId)).slice(0, 4).map((s) => (
              <CommandItem key={`s${s.id}`} value={`fornecedor ${s.name} ${term}`} onSelect={() => go("/suppliers", { id: s.id })}>
                <Truck aria-hidden="true" /> {s.name}
                <span className="ml-auto text-xs text-muted-foreground">Fornecedor</span>
              </CommandItem>
            ))}
            {locations?.filter((l) => match(l.name) || match(l.code)).slice(0, 4).map((l) => (
              <CommandItem key={`l${l.id}`} value={`local ${l.code} ${l.name} ${term}`} onSelect={() => go("/locations", { id: l.id })}>
                <MapPin aria-hidden="true" /> {l.code} · {l.name}
                <span className="ml-auto text-xs text-muted-foreground">Localização</span>
              </CommandItem>
            ))}
            {categories?.filter((c) => match(c.name)).slice(0, 4).map((c) => (
              <CommandItem key={`c${c.seq}`} value={`categoria ${c.name} ${term}`} onSelect={() => go("/inventory", { categoryId: c.seq })}>
                <FolderTree aria-hidden="true" /> {c.name}
                <span className="ml-auto text-xs text-muted-foreground">Categoria</span>
              </CommandItem>
            ))}
          </>
        )}

        <CommandSeparator />
        <CommandGroup heading="Ações">
          {can(role, "movement:create") && (
            <CommandItem
              value="nova movimentação entrada saída transferência"
              onSelect={() => {
                onOpenChange(false);
                openMovement({ type: "IN" });
              }}
            >
              <ArrowLeftRight aria-hidden="true" /> Registrar movimentação
            </CommandItem>
          )}
          {can(role, "catalog:write") && (
            <CommandItem value="novo produto cadastrar" onSelect={() => go("/products", { new: true })}>
              <Plus aria-hidden="true" /> Cadastrar produto
            </CommandItem>
          )}
        </CommandGroup>
        <CommandGroup heading="Ir para">
          {ALL_NAV_ITEMS.map((item) => (
            <CommandItem key={item.to} value={`${item.label} ${item.keywords ?? ""}`} onSelect={() => go(item.to)}>
              <item.icon aria-hidden="true" /> {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
