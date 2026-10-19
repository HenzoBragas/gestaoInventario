import { createFileRoute } from "@tanstack/react-router";
import { ProductDetailPage } from "@/features/products/ProductDetailPage";

export const Route = createFileRoute("/_app/products/$productId")({
  component: ProductDetailPage,
  head: () => ({ meta: [{ title: "Produto · Gestão de Inventário" }] }),
});
