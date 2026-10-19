import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import appCss from "../styles.css?url";
import { AuthProvider } from "@/lib/auth-provider";
import { ThemeProvider } from "@/lib/theme-provider";
import { Toaster } from "@/components/ui/sonner";

// Script executado antes da pintura para aplicar o tema correto (claro/escuro/horário)
// e evitar o "flash" de tema errado na carga inicial. Espelha a lógica do ThemeProvider.
const themeInitScript = `(function(){try{var t=localStorage.getItem('inventario:theme')||'system';var d;if(t==='system'){var h=new Date().getHours();d=(h<6||h>=18);}else{d=t==='dark';}if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">
          Page not found
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Gestão de Inventário" },
      { name: "description", content: "Sistema de gestão de inventário: estoque, movimentações e relatórios." },
      { property: "og:title", content: "Gestão de Inventário" },
      { property: "og:description", content: "Sistema de gestão de inventário: estoque, movimentações e relatórios." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        // Inter e JetBrains Mono ja eram as fontes declaradas no tema, mas nunca eram carregadas.
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&family=Instrument+Serif:ital@1&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    // O themeInitScript adiciona a classe `dark` antes da hidratacao, de proposito.
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* Aplica o tema antes da pintura para evitar flash (FOUC de tema). */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  // Um QueryClient por montagem (no SSR, evita compartilhar cache entre requisicoes).
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: true,
            // Erros de cliente (4xx) nao melhoram com nova tentativa.
            retry: (failureCount, error) => {
              const status = (error as { status?: number }).status ?? 0;
              return status >= 400 && status < 500 ? false : failureCount < 2;
            },
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          <Outlet />
          <Toaster richColors closeButton position="top-right" />
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
