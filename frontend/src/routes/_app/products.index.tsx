import { createFileRoute } from "@tanstack/react-router";
import { ProductsPage } from "@/features/products/ProductsPage";
import { productsSearchSchema } from "@/lib/search";

export const Route = createFileRoute("/_app/products/")({
  validateSearch: (search) => productsSearchSchema.parse(search),
  component: ProductsPage,
  head: () => ({ meta: [{ title: "Produtos · Gestão de Inventário" }] }),
});
