import { useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRight, Home } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/app/AppSidebar";
import { CommandSearch, SearchTrigger } from "@/components/app/CommandSearch";
import { navItemFor } from "@/components/app/navigation";
import { NotificationsMenu } from "@/components/app/NotificationsMenu";
import { UserMenu } from "@/components/app/UserMenu";
import { MovementDialogProvider } from "@/features/movements/MovementDialog";
import { useGlassPointer } from "@/hooks/use-glass-pointer";
import { useProduct } from "@/lib/api/hooks";

export function AppShell({ children }: { children: ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useGlassPointer();

  return (
    <TooltipProvider delayDuration={300}>
      <MovementDialogProvider>
        <SidebarProvider>
          <a
            href="#main-content"
            className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
          >
            Pular para o conteúdo
          </a>
          <div aria-hidden="true" className="app-ambient" />
          <AppSidebar />
          <SidebarInset className="min-w-0 bg-transparent">
            {/* Barra flutuante em vidro: o conteudo rola por tras dela. */}
            <header className="glass glass-blur sticky top-3 z-30 mx-3 mt-3 flex h-14 items-center gap-3 rounded-2xl border px-3 sm:mx-4 sm:px-4">
              <SidebarTrigger className="-ml-1" aria-label="Abrir ou recolher o menu" />
              <Separator orientation="vertical" className="h-5" />
              <Breadcrumbs pathname={pathname} />
              <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-1.5 sm:gap-2">
                <div className="min-w-0 max-w-md md:flex-1">
                  <SearchTrigger onOpen={() => setSearchOpen(true)} />
                </div>
                <NotificationsMenu />
                <UserMenu />
              </div>
            </header>
            {/* SidebarInset ja e o <main>: aqui so o alvo do "pular para o conteudo". */}
            <div id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
              {/* key: reanima a entrada a cada troca de pagina. */}
              <div key={pathname.split("/")[1]} className="page-enter mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:py-8">
                {children}
              </div>
            </div>
          </SidebarInset>
          <CommandSearch open={searchOpen} onOpenChange={setSearchOpen} />
        </SidebarProvider>
      </MovementDialogProvider>
    </TooltipProvider>
  );
}

function Breadcrumbs({ pathname }: { pathname: string }) {
  const item = navItemFor(pathname);
  const productMatch = /^\/products\/(\d+)/.exec(pathname);
  const { data: product } = useProduct(productMatch ? Number(productMatch[1]) : undefined);

  return (
    <nav aria-label="Trilha de navegação" className="hidden min-w-0 items-center gap-1.5 text-sm sm:flex">
      <Link to="/dashboard" className="rounded text-muted-foreground transition-colors hover:text-foreground" aria-label="Início">
        <Home className="h-4 w-4" />
      </Link>
      {item && (
        <>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" aria-hidden="true" />
          {productMatch ? (
            <Link to={item.to} className="text-muted-foreground transition-colors hover:text-foreground">
              {item.label}
            </Link>
          ) : (
            <span className="font-medium" aria-current="page">
              {item.label}
            </span>
          )}
        </>
      )}
      {productMatch && (
        <>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" aria-hidden="true" />
          <span className="max-w-[16rem] truncate font-medium" aria-current="page">
            {product?.name ?? "Detalhe"}
          </span>
        </>
      )}
    </nav>
  );
}
