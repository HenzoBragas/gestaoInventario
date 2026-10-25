import { useEffect } from "react";

/**
 * Luz especular que segue o cursor nos elementos `.glass-interactive`:
 * atualiza --mx/--my no elemento sob o ponteiro, sem re-render do React.
 * Desligado para movimento reduzido e para ponteiros de toque.
 */
export function useGlassPointer() {
  useEffect(() => {
    const allowMotion =
      window.matchMedia("(prefers-reduced-motion: no-preference)").matches &&
      window.matchMedia("(pointer: fine)").matches;
    if (!allowMotion) return;

    let frame = 0;
    const handleMove = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) return;
      const target = event.target.closest<HTMLElement>(".glass-interactive");
      if (!target) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = target.getBoundingClientRect();
        target.style.setProperty("--mx", `${event.clientX - rect.left}px`);
        target.style.setProperty("--my", `${event.clientY - rect.top}px`);
      });
    };

    document.addEventListener("pointermove", handleMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointermove", handleMove);
    };
  }, []);
}
