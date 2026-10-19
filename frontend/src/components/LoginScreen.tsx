import { ThemeToggle } from "@/components/ThemeToggle";
import { BrandMark } from "@/components/login/BrandMark";
import { LoginForm } from "@/components/login/LoginForm";
import { LoginShowcase } from "@/components/login/LoginShowcase";

/**
 * Tela de autenticacao: painel visual a esquerda (desktop) e formulario a direita.
 * Em telas menores o formulario ocupa a tela inteira e o painel visual e omitido.
 */
export function LoginScreen() {
  return (
    <div className="login-root grid min-h-dvh bg-background lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <LoginShowcase />

      <main className="relative flex min-h-dvh flex-col overflow-hidden px-5 pb-8 pt-5 sm:px-10 lg:px-14 xl:px-20">
        {/* Brilho sutil no topo para telas sem o painel visual. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(60%_100%_at_50%_0%,color-mix(in_oklch,var(--color-primary)_14%,transparent),transparent)] lg:hidden"
        />

        <div className="relative flex items-center justify-between">
          <BrandMark className="login-enter lg:invisible" />
          <ThemeToggle />
        </div>

        <div className="relative mx-auto flex w-full max-w-[420px] flex-1 items-center py-10">
          <LoginForm />
        </div>

        <footer className="relative text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Gestão de Inventário · Projeto acadêmico
        </footer>
      </main>
    </div>
  );
}
