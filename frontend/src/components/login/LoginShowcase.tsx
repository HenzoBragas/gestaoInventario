import { useEffect, useRef, type ReactNode } from "react";
import { ArrowDownToLine, BellRing, FileSpreadsheet, PackageX, TrendingUp } from "lucide-react";
import { BrandMark } from "@/components/login/BrandMark";
import { cn } from "@/lib/utils";
import { stagger, type StyleWithVars } from "@/components/login/motion";

// Alturas (%) do grafico decorativo de nivel de estoque.
const BARS = [42, 58, 51, 66, 61, 74, 69, 82, 77, 88, 84, 93];

const FEATURES = [
  { icon: BellRing, label: "Alertas de estoque baixo" },
  { icon: ArrowDownToLine, label: "Entradas e saídas registradas" },
  { icon: FileSpreadsheet, label: "Exportação para Excel" },
];

/**
 * Atualiza --px/--py no container conforme o cursor, sem re-render do React.
 * Desligado para movimento reduzido e para ponteiros de toque.
 */
function usePointerParallax<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const allowMotion =
      window.matchMedia("(prefers-reduced-motion: no-preference)").matches &&
      window.matchMedia("(pointer: fine)").matches;
    if (!allowMotion) return;

    let frame = 0;
    const handleMove = (event: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = node.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
        node.style.setProperty("--px", x.toFixed(3));
        node.style.setProperty("--py", y.toFixed(3));
      });
    };
    const handleLeave = () => {
      cancelAnimationFrame(frame);
      node.style.setProperty("--px", "0");
      node.style.setProperty("--py", "0");
    };

    node.addEventListener("pointermove", handleMove);
    node.addEventListener("pointerleave", handleLeave);
    return () => {
      cancelAnimationFrame(frame);
      node.removeEventListener("pointermove", handleMove);
      node.removeEventListener("pointerleave", handleLeave);
    };
  }, []);

  return ref;
}

/** Painel visual da esquerda (somente desktop). */
export function LoginShowcase() {
  const ref = usePointerParallax<HTMLElement>();

  return (
    <section
      ref={ref}
      aria-label="Apresentação do produto"
      className="relative hidden overflow-hidden bg-[var(--login-ink)] text-[var(--login-ink-text)] lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="login-aurora login-aurora--a" />
        <div className="login-aurora login-aurora--b" />
        <div className="login-grid" />
      </div>

      <BrandMark tone="light" className="login-enter relative" />

      <ShowcaseIllustration />

      <div className="relative max-w-lg">
        <h2
          className="login-enter text-4xl font-semibold leading-[1.08] tracking-tight xl:text-[2.75rem]"
          style={stagger(2)}
        >
          Cada item,{" "}
          <span className="font-[family-name:var(--font-display)] text-[1.12em] font-normal italic text-[oklch(0.86_0.08_220)]">
            no lugar certo.
          </span>
        </h2>
        <p
          className="login-enter mt-4 max-w-md text-[15px] leading-relaxed text-[var(--login-ink-muted)]"
          style={stagger(3)}
        >
          Produtos, categorias e movimentações em um só painel, para sua equipe saber exatamente o
          que tem em estoque e o que precisa repor.
        </p>
        <ul className="mt-8 flex flex-wrap gap-2">
          {FEATURES.map(({ icon: Icon, label }, index) => (
            <li
              key={label}
              className="login-enter inline-flex items-center gap-2 rounded-full border border-[var(--login-ink-line)] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-[var(--login-ink-text)]"
              style={stagger(4 + index)}
            >
              <Icon className="h-3.5 w-3.5 text-[var(--login-glow-teal)]" aria-hidden="true" />
              {label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Composicao decorativa de cartoes do produto; oculta de leitores de tela. */
function ShowcaseIllustration() {
  return (
    <div aria-hidden="true" className="relative mx-auto my-10 h-[300px] w-full max-w-[460px] select-none xl:h-[340px]">
      {/* Cartao principal: nivel de estoque */}
      <FloatingCard className="inset-x-6 top-8" depth={8} order={1}>
        <div className="login-glass p-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--login-ink-muted)]">
            Nível de estoque
          </p>
          <div className="mt-1 flex items-center gap-2.5">
            <p className="font-mono text-2xl font-semibold tracking-tight">1.248 un.</p>
            <span className="inline-flex items-center gap-1 rounded-full bg-[oklch(0.78_0.15_160/0.14)] px-2 py-1 text-[11px] font-semibold text-[var(--login-signal-ok)]">
              <TrendingUp className="h-3 w-3" />
              +12%
            </span>
          </div>
          <div className="mt-5 flex h-24 items-end gap-1.5">
            {BARS.map((height, index) => (
              <span
                key={index}
                className="login-bar flex-1 rounded-t-[4px] bg-gradient-to-t from-[oklch(0.6_0.2_255/0.35)] to-[oklch(0.72_0.13_200)]"
                style={{ height: `${height}%`, "--i": index } as StyleWithVars}
              />
            ))}
          </div>
        </div>
      </FloatingCard>

      {/* Alerta de reposicao (produto real do seed: estoque zerado) */}
      <FloatingCard className="-right-2 top-0 w-[230px] xl:-right-8" depth={22} order={3} floatDelay="-2s">
        <div className="login-glass flex items-start gap-3 p-3.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[oklch(0.8_0.15_75/0.16)] text-[var(--login-signal-low)]">
            <PackageX className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium">Pilhas Recarregáveis D</p>
            <p className="font-mono text-[11px] text-[var(--login-ink-muted)]">SKU 11850</p>
            <span className="mt-2 inline-block rounded-md bg-[oklch(0.8_0.15_75/0.16)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--login-signal-low)]">
              Sem estoque
            </span>
          </div>
        </div>
      </FloatingCard>

      {/* Movimentacao registrada */}
      <FloatingCard className="bottom-0 -left-2 w-[240px] xl:-left-8" depth={-14} order={5} floatDelay="-4s">
        <div className="login-glass flex items-center gap-3 p-3.5">
          <span className="login-pulse h-2 w-2 shrink-0 rounded-full bg-[var(--login-signal-ok)]" />
          <div className="min-w-0">
            <p className="text-[13px] font-medium">
              <span className="font-mono text-[var(--login-signal-ok)]">+24 un.</span> entrada registrada
            </p>
            <p className="text-[11px] text-[var(--login-ink-muted)]">Periféricos · agora mesmo</p>
          </div>
        </div>
      </FloatingCard>
    </div>
  );
}

interface FloatingCardProps {
  className: string;
  /** Intensidade do parallax em px; negativo move no sentido oposto ao cursor. */
  depth: number;
  /** Posicao na sequencia de entrada. */
  order: number;
  floatDelay?: string;
  children: ReactNode;
}

// Tres camadas porque cada uma anima `transform` de forma independente:
// parallax (cursor) > entrada > flutuacao continua.
function FloatingCard({ className, depth, order, floatDelay = "0s", children }: FloatingCardProps) {
  return (
    <div className={cn("login-parallax absolute", className)} style={{ "--depth": depth } as StyleWithVars}>
      <div className="login-enter" style={stagger(order)}>
        <div className="login-float" style={{ "--float-delay": floatDelay } as StyleWithVars}>
          {children}
        </div>
      </div>
    </div>
  );
}
