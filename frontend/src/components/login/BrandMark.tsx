import { cn } from "@/lib/utils";

interface BrandMarkProps {
  className?: string;
  /** "light" para fundos escuros (painel visual); "auto" segue o tema. */
  tone?: "light" | "auto";
}

// Identidade provisoria: tres caixas empilhadas em perspectiva isometrica.
// Troque este componente pelo logotipo oficial quando existir.
export function BrandMark({ className, tone = "auto" }: BrandMarkProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "grid h-9 w-9 place-items-center rounded-[10px] shadow-sm",
          tone === "light" ? "bg-white/10 ring-1 ring-white/15" : "bg-primary",
        )}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <path d="M12 3 4 7l8 4 8-4-8-4Z" fill="currentColor" className="text-white" />
          <path d="M4 7v5l8 4v-5L4 7Z" fill="currentColor" className="text-white/70" />
          <path d="M20 7v5l-8 4v-5l8-4Z" fill="currentColor" className="text-white/45" />
          <path
            d="m4 14.5 8 4 8-4M4 17l8 4 8-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-white/55"
          />
        </svg>
      </span>
      <span
        className={cn(
          "text-[15px] font-semibold tracking-tight",
          tone === "light" ? "text-[var(--login-ink-text)]" : "text-foreground",
        )}
      >
        Gestão de Inventário
      </span>
    </div>
  );
}
