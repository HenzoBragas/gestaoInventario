import { createFileRoute } from "@tanstack/react-router";
import { Package } from "lucide-react";
import { useInventoryStore } from "@/lib/inventory-store";
import { StatsCards } from "@/components/inventory/StatsCards";
import { InventoryTable } from "@/components/inventory/InventoryTable";
import { AddItemDialog } from "@/components/inventory/AddItemDialog";
import { ManageCategoriesDialog } from "@/components/inventory/ManageCategoriesDialog";

export const Route = createFileRoute("/")({
  component: InventoryDashboard,
  head: () => ({
    meta: [
      { title: "Gestão de Inventário" },
      { name: "description", content: "Sistema profissional de gestão de inventário" },
    ],
  }),
});

function InventoryDashboard() {
  const { items, addItem, updateItem, deleteItem, adjustQuantity, stats, categories, addCategory, deleteCategory } = useInventoryStore();
  const categoryNames = categories.map((category) => category.name);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary p-2">
              <Package className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Gestão de Inventário</h1>
              <p className="text-xs text-muted-foreground">Controle completo do seu estoque</p>
            </div>
          </div>
          <div className="flex gap-2">
            <ManageCategoriesDialog
              categories={categories}
              onAdd={addCategory}
              onDelete={deleteCategory}
            />
            <AddItemDialog onAdd={addItem} categories={categoryNames} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <StatsCards {...stats} />
        <InventoryTable
          items={items}
          categories={categoryNames}
          onUpdate={updateItem}
          onDelete={deleteItem}
          onAdjust={adjustQuantity}
        />
      </main>
    </div>
  );
}
