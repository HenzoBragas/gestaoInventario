import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { SettingsPage } from "@/features/settings/SettingsPage";

const searchSchema = z.object({
  tab: z.enum(["organization", "preferences", "notifications", "account", "users", "permissions", "audit"]).optional().catch(undefined),
});

export const Route = createFileRoute("/_app/settings")({
  validateSearch: (search) => searchSchema.parse(search),
  // A auditoria saiu das configuracoes e ganhou pagina propria; links antigos continuam funcionando.
  beforeLoad: ({ search }) => {
    if (search.tab === "audit") throw redirect({ to: "/audit" });
  },
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Configurações · Gestão de Inventário" }] }),
});
