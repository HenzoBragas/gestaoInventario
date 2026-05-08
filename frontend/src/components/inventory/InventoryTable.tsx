// Importação de hooks do React
import { useState, useMemo } from "react";

// Importação das funções principais da tabela (TanStack Table)
import {
  useReactTable,
  getCoreRowModel,        // estrutura base da tabela
  getFilteredRowModel,    // filtro (busca)
  getSortedRowModel,      // ordenação
  getPaginationRowModel,  // paginação
  flexRender,             // renderização dinâmica
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";

// Ícones
import { ArrowUpDown, Search, Download } from "lucide-react";

// Bibliotecas para exportar Excel
import * as XLSX from "xlsx";
import pkg from "file-saver";
const { saveAs } = pkg;

// Componentes de UI
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// Tipos e funções do inventário
import type { InventoryItem } from "@/lib/inventory-store";
import { getStatus } from "@/lib/inventory-store";

// Dialogs de ações
import { EditItemDialog } from "./EditItemDialog";
import { DeleteItemDialog } from "./DeleteItemDialog";
import { StockMovementDialog } from "./StockMovementDialog";

// Props recebidas pelo componente
interface InventoryTableProps {
  items: InventoryItem[];
  categories: string[];
  onUpdate: (id: string, updates: Partial<InventoryItem>) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  onAdjust: (id: string, delta: number) => void | Promise<void>;
}

// Componente para mostrar o status do estoque
function StatusBadge({ quantity }: { quantity: number }) {
  const status = getStatus(quantity);

  if (status === "Em Estoque") {
    return <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">{status}</Badge>;
  }

  if (status === "Estoque Baixo") {
    return <Badge className="bg-orange-500 text-white hover:bg-orange-500">{status}</Badge>;
  }

  return <Badge className="bg-red-600 text-white hover:bg-red-600">{status}</Badge>;
}

// Componente principal da tabela
export function InventoryTable({ items, categories, onUpdate, onDelete, onAdjust }: InventoryTableProps) {

  // Estado de ordenação
  const [sorting, setSorting] = useState<SortingState>([]);

  // Estado da busca global
  const [globalFilter, setGlobalFilter] = useState("");

  // Estado do filtro por categoria
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Filtra os itens pela categoria selecionada
  const filteredItems = useMemo(() => {
    if (categoryFilter === "all") return items;
    return items.filter((i) => i.category === categoryFilter);
  }, [items, categoryFilter]);

  // Definição das colunas da tabela
  const columns = useMemo<ColumnDef<InventoryItem>[]>(() => [

    // Coluna ID
    {
      accessorKey: "id",
      header: ({ column }) => (
        <Button variant="ghost" size="sm" onClick={() => column.toggleSorting()}>
          ID <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="font-mono text-xs">
          {row.getValue("id")}
        </span>
      ),
    },

    // Coluna Nome
    {
      accessorKey: "name",
      header: ({ column }) => (
        <Button variant="ghost" size="sm" onClick={() => column.toggleSorting()}>
          Nome <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
    },

    // Coluna Modelo
    { accessorKey: "model", header: "Modelo" },

    // Coluna Categoria
    { accessorKey: "category", header: "Categoria" },

    // Coluna Quantidade
    {
      accessorKey: "quantity",
      header: ({ column }) => (
        <Button variant="ghost" size="sm" onClick={() => column.toggleSorting()}>
          Qtd. <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="font-semibold">
          {row.getValue("quantity")}
        </span>
      ),
    },

    // Coluna Status (calculado)
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <StatusBadge quantity={row.original.quantity} />
      ),
    },

    // Coluna Data de atualização
    {
      accessorKey: "updatedAt",
      header: "Atualizado",
      cell: ({ row }) => {
        const d = new Date(row.getValue("updatedAt") as string);
        return (
          <span className="text-xs text-muted-foreground">
            {d.toLocaleDateString("pt-BR")}
          </span>
        );
      },
    },

    // Coluna de ações (editar, deletar, movimentar)
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const item = row.original;

        return (
          <div className="flex items-center gap-1">
            <StockMovementDialog item={item} onAdjust={onAdjust} />
            <EditItemDialog item={item} categories={categories} onUpdate={onUpdate} />
            <DeleteItemDialog
              itemName={item.name}
              onDelete={() => onDelete(item.id)}
            />
          </div>
        );
      },
    },
  ], [onUpdate, onDelete, onAdjust]);

  // Configuração da tabela
  const table = useReactTable({
    data: filteredItems,
    columns,
    state: { sorting, globalFilter },

    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,

    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),

    initialState: { pagination: { pageSize: 10 } },
  });

  // Função para exportar para Excel
  const exportToExcel = () => {
    const data = items.map((i) => ({
      ID: i.id,
      Nome: i.name,
      Modelo: i.model,
      Categoria: i.category,
      Quantidade: i.quantity,
      Status: getStatus(i.quantity),
      Atualizado: new Date(i.updatedAt).toLocaleDateString("pt-BR"),
    }));

    const ws = XLSX.utils.json_to_sheet(data); // cria planilha
    const wb = XLSX.utils.book_new(); // cria workbook

    XLSX.utils.book_append_sheet(wb, ws, "Inventário");

    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });

    // Faz download do arquivo
    saveAs(
      new Blob([buf], { type: "application/octet-stream" }),
      "inventario.xlsx"
    );
  };

  return (
    <div className="space-y-4">

      {/* Barra de busca e filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

        <div className="flex flex-1 items-center gap-3">

          {/* Campo de busca */}
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar produtos..."
              className="pl-9"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
            />
          </div>

          {/* Filtro por categoria */}
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Categorias</SelectItem>

              {categories.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Botão exportar */}
        <Button variant="outline" onClick={exportToExcel}>
          <Download className="h-4 w-4" />
          Exportar Planilha
        </Button>
      </div>

      {/* Tabela */}
      <div className="rounded-lg border bg-card">
        <Table>

          {/* Cabeçalho */}
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id}>
                    {h.isPlaceholder
                      ? null
                      : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          {/* Corpo */}
          <TableBody>
            {table.getRowModel().rows.length ? (

              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))

            ) : (
              // Caso não tenha dados
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  Nenhum produto encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>

        </Table>
      </div>

      {/* Paginação */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {table.getFilteredRowModel().rows.length} produto(s)
        </p>

        <div className="flex items-center gap-2">

          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Anterior
          </Button>

          <span className="text-sm text-muted-foreground">
            {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Próximo
          </Button>

        </div>
      </div>

    </div>
  );
}