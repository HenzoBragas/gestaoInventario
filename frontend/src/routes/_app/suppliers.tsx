import { createFileRoute } from "@tanstack/react-router";
import { SuppliersPage } from "@/features/catalog/SuppliersPage";
import { entitySearchSchema } from "@/lib/search";

export const Route = createFileRoute("/_app/suppliers")({
  validateSearch: (search) => entitySearchSchema.parse(search),
  component: SuppliersPage,
  head: () => ({ meta: [{ title: "Fornecedores · Gestão de Inventário" }] }),
});
