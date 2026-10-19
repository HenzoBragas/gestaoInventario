import { createFileRoute } from "@tanstack/react-router";
import { ReportsPage } from "@/features/reports/ReportsPage";

export const Route = createFileRoute("/_app/reports")({
  component: ReportsPage,
  head: () => ({ meta: [{ title: "Relatórios · Gestão de Inventário" }] }),
});
