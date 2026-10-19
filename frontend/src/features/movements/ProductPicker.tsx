import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { productsApi } from "@/lib/api/services";
import type { Product } from "@/lib/api/types";
import { cn } from "@/lib/utils";

interface ProductPickerProps {
  id?: string;
  /** Basta id, nome e SKU (ex.: produto ja vinculado a um registro em edicao). */
  value: Pick<Product, "id" | "name" | "sku"> | null;
  onChange: (product: Product) => void;
  disabled?: boolean;
  /** Somente produtos ativos podem ser movimentados. */
  activeOnly?: boolean;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

/** Combobox com busca no servidor (nome, SKU, modelo ou codigo de barras). */
export function ProductPicker({ id, value, onChange, disabled, activeOnly = true, ...aria }: ProductPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setTerm(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const { data, isFetching } = useQuery({
    queryKey: ["data", "product-picker", term, activeOnly],
    queryFn: () =>
      productsApi.list({ q: term || undefined, size: 20, status: activeOnly ? ["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"] : undefined }),
    enabled: open,
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("h-auto min-h-10 w-full justify-between px-3 py-2 text-left font-normal", aria["aria-invalid"] && "border-destructive")}
          {...aria}
        >
          {value ? (
            <span className="min-w-0">
              <span className="block truncate text-sm">{value.name}</span>
              <span className="block font-mono text-xs text-muted-foreground">{value.sku}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">Selecione um produto…</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-72 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar por nome, SKU ou código de barras…" value={query} onValueChange={setQuery} />
          <CommandList>
            {isFetching && !data ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Buscando…
              </div>
            ) : (
              <CommandEmpty>{activeOnly ? "Nenhum produto ativo encontrado." : "Nenhum produto encontrado."}</CommandEmpty>
            )}
            <CommandGroup>
              {data?.items.map((product) => (
                <CommandItem
                  key={product.id}
                  value={String(product.id)}
                  onSelect={() => {
                    onChange(product);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("h-4 w-4", value?.id === product.id ? "opacity-100" : "opacity-0")} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{product.name}</span>
                    <span className="block font-mono text-xs text-muted-foreground">{product.sku}</span>
                  </span>
                  <span className="tabular text-xs text-muted-foreground">
                    {product.stock} {product.unit}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
