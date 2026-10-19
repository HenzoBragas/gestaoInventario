import type { ReactNode } from "react";

/** Bloco padrao das secoes de configuracao. */
export function Panel({ title, description, children, footer }: { title: string; description?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <section className="rounded-xl border glass" aria-label={title}>
      <header className="border-b px-5 py-4">
        <h2 className="font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </header>
      <div className="p-5">{children}</div>
      {footer && <footer className="flex justify-end gap-2 border-t px-5 py-3">{footer}</footer>}
    </section>
  );
}
