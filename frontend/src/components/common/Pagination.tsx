import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFormatters } from "@/lib/format";

interface PaginationProps {
  page: number; // base 0
  size: number;
  totalItems: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onSizeChange?: (size: number) => void;
  sizes?: number[];
}

export function Pagination({ page, size, totalItems, totalPages, onPageChange, onSizeChange, sizes = [10, 25, 50, 100] }: PaginationProps) {
  const f = useFormatters();
  const first = totalItems === 0 ? 0 : page * size + 1;
  const last = Math.min(totalItems, (page + 1) * size);
  const lastPage = Math.max(0, totalPages - 1);

  return (
    <div className="flex flex-col gap-3 border-t px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <p className="tabular" aria-live="polite">
        {f.number(first)}–{f.number(last)} de {f.number(totalItems)}
      </p>
      <div className="flex items-center gap-4">
        {onSizeChange && (
          <div className="hidden items-center gap-2 sm:flex">
            <span id="page-size-label">Linhas por página</span>
            <Select value={String(size)} onValueChange={(value) => onSizeChange(Number(value))}>
              <SelectTrigger className="h-8 w-[72px]" aria-labelledby="page-size-label">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sizes.map((s) => (
                  <SelectItem key={s} value={String(s)}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <nav className="flex items-center gap-1" aria-label="Paginação">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onPageChange(0)} disabled={page === 0} aria-label="Primeira página">
            <ChevronsLeft />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onPageChange(page - 1)} disabled={page === 0} aria-label="Página anterior">
            <ChevronLeft />
          </Button>
          <span className="tabular px-2 text-foreground">
            {totalPages === 0 ? 0 : page + 1} / {totalPages}
          </span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onPageChange(page + 1)} disabled={page >= lastPage} aria-label="Próxima página">
            <ChevronRight />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onPageChange(lastPage)} disabled={page >= lastPage} aria-label="Última página">
            <ChevronsRight />
          </Button>
        </nav>
      </div>
    </div>
  );
}
