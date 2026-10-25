import { createFileRoute } from "@tanstack/react-router";
import { AuditPage } from "@/features/audit/AuditPage";
import { auditSearchSchema } from "@/lib/search";

export const Route = createFileRoute("/_app/audit")({
  validateSearch: (search) => auditSearchSchema.parse(search),
  component: AuditPage,
  head: () => ({ meta: [{ title: "Auditoria · Gestão de Inventário" }] }),
});
