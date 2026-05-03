import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Settings, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Category {
  seq?: number;
  name: string;
  inactive?: number;
}

interface ManageCategoriesDialogProps {
  categories: Category[];
  onAdd: (name: string) => Promise<void>;
  onDelete: (seq: number) => Promise<void>;
}

export function ManageCategoriesDialog({ categories, onAdd, onDelete }: ManageCategoriesDialogProps) {
  const [open, setOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [page, setPage] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const pageSize = 5;

  const handleAdd = async () => {
    if (!newCategoryName.trim()) {
      setErrorMessage("Nome da categoria é obrigatório");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage("");
      setSuccessMessage("");
      await onAdd(newCategoryName);
      setNewCategoryName("");
      setSuccessMessage("Categoria adicionada com sucesso!");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Erro ao criar categoria");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (deleteId === null) return;

    try {
      setIsSubmitting(true);
      setErrorMessage("");
      setSuccessMessage("");
      await onDelete(deleteId);
      setDeleteId(null);
      setSuccessMessage("Categoria deletada/inativada com sucesso!");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Erro ao deletar categoria");
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(categories.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const visibleCategories = useMemo(
    () => categories.slice(currentPage * pageSize, currentPage * pageSize + pageSize),
    [categories, currentPage]
  );
  const activeCategories = visibleCategories.filter((c) => !c.inactive);
  const inactiveCategories = visibleCategories.filter((c) => c.inactive);

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" /> Gerenciar Categorias
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader className="flex flex-row items-center justify-between gap-4">
            <DialogTitle>Gerenciar Categorias</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-3 rounded-lg border bg-slate-50 p-4">
              <h3 className="text-sm font-semibold">Adicionar Nova Categoria</h3>
              <div className="flex gap-2">
                <Input
                  placeholder="Nome da categoria"
                  value={newCategoryName}
                  onChange={(e) => {
                    setNewCategoryName(e.target.value);
                    setErrorMessage("");
                  }}
                  disabled={isSubmitting}
                />
                <Button onClick={handleAdd} disabled={isSubmitting || !newCategoryName.trim()}>
                  {isSubmitting ? "..." : "Adicionar"}
                </Button>
              </div>
              {errorMessage && <div className="text-sm text-red-600">{errorMessage}</div>}
              {successMessage && <div className="text-sm text-green-600">{successMessage}</div>}
            </div>

            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeCategories.length === 0 && inactiveCategories.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-gray-500">
                        Nenhuma categoria encontrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {activeCategories.map((cat) => (
                        <TableRow key={cat.seq}>
                          <TableCell className="font-medium">{cat.name}</TableCell>
                          <TableCell>
                            <Badge variant="default">Ativa</Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteId(cat.seq || null)}
                              disabled={isSubmitting}
                              title="Deletar ou inativar categoria"
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {inactiveCategories.length > 0 && (
                        <>
                          <TableRow className="bg-gray-50">
                            <TableCell colSpan={3} className="py-2 text-xs italic text-gray-500">
                              Categorias Inativas (produtos ainda usando estas categorias)
                            </TableCell>
                          </TableRow>
                          {inactiveCategories.map((cat) => (
                            <TableRow key={cat.seq} className="opacity-50">
                              <TableCell className="font-medium line-through">{cat.name}</TableCell>
                              <TableCell>
                                <Badge variant="secondary">Inativa</Badge>
                              </TableCell>
                              <TableCell />
                            </TableRow>
                          ))}
                        </>
                      )}
                    </>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Página {currentPage + 1} de {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((prev) => Math.max(0, prev - 1))}
                  disabled={currentPage === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((prev) => Math.min(totalPages - 1, prev + 1))}
                  disabled={currentPage >= totalPages - 1}
                >
                  Próximo
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar Categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              Se existirem produtos usando esta categoria, ela será marcada como <strong>inativa</strong> em vez de deletada. 
              Caso contrário, será <strong>deletada permanentemente</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isSubmitting}
            className="bg-red-600 hover:bg-red-700"
          >
            {isSubmitting ? "Processando..." : "Confirmar"}
          </AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
