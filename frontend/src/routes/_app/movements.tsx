import { createFileRoute } from "@tanstack/react-router";
import { MovementsPage } from "@/features/movements/MovementsPage";
import { movementsSearchSchema } from "@/lib/search";

export const Route = createFileRoute("/_app/movements")({
  validateSearch: (search) => movementsSearchSchema.parse(search),
  component: MovementsPage,
  head: () => ({ meta: [{ title: "Movimentações · Gestão de Inventário" }] }),
});
