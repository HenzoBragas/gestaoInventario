import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { LoginScreen } from "@/components/LoginScreen";
import { useAuth } from "@/lib/auth-provider";

export const Route = createFileRoute("/")({
  component: EntryPage,
  head: () => ({
    meta: [
      { title: "Entrar · Gestão de Inventário" },
      { name: "description", content: "Sistema de gestão de inventário" },
    ],
  }),
});

// Tela de login ou, com sessao ativa, redireciona para o dashboard.
function EntryPage() {
  const { isAuthenticated, isReady } = useAuth();

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Carregando" />
      </div>
    );
  }
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  return <LoginScreen />;
}
