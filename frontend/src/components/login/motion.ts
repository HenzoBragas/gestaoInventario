import type { CSSProperties } from "react";

/** Estilo inline que aceita CSS custom properties (ex.: --i, --depth). */
export type StyleWithVars = CSSProperties & Record<`--${string}`, string | number>;

/** Posicao do elemento na entrada sequencial (.login-enter). */
export const stagger = (index: number): StyleWithVars => ({ "--i": index });

/** Reinicia uma animacao CSS de classe (ex.: shake a cada nova falha). */
export function replayAnimation(element: HTMLElement | null, className: string) {
  if (!element) return;
  element.classList.remove(className);
  void element.offsetWidth; // Forca reflow para a animacao recomecar.
  element.classList.add(className);
}
