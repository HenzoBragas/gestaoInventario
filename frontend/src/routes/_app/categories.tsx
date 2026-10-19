import { createFileRoute } from "@tanstack/react-router";
import { CategoriesPage } from "@/features/catalog/CategoriesPage";

export const Route = createFileRoute("/_app/categories")({
  component: CategoriesPage,
  head: () => ({ meta: [{ title: "Categorias · Gestão de Inventário" }] }),
});
