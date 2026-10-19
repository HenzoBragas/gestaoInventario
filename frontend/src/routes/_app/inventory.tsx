import { createFileRoute } from "@tanstack/react-router";
import { InventoryPage } from "@/features/inventory/InventoryPage";
import { inventorySearchSchema } from "@/lib/search";

export const Route = createFileRoute("/_app/inventory")({
  validateSearch: (search) => inventorySearchSchema.parse(search),
  component: InventoryPage,
  head: () => ({ meta: [{ title: "Inventário · Gestão de Inventário" }] }),
});
