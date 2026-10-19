import { createFileRoute } from "@tanstack/react-router";
import { InvoicesPage } from "@/features/invoices/InvoicesPage";
import { invoicesSearchSchema } from "@/lib/search";

export const Route = createFileRoute("/_app/invoices")({
  validateSearch: (search) => invoicesSearchSchema.parse(search),
  component: InvoicesPage,
  head: () => ({ meta: [{ title: "Notas fiscais · Gestão de Inventário" }] }),
});
