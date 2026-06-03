import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

// Os tres modos suportados pelo seletor de tema.
export type Theme = "light" | "dark" | "system";

// Tema "resolvido" = o que de fato e aplicado na tela (sem o "system").
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "inventario:theme";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * Regra do modo "Sistema": em vez da preferencia do SO, usamos o horario do dia.
 * Claro entre 06:00 e 17:59 / Escuro entre 18:00 e 05:59.
 */
function getTimeBasedTheme(date = new Date()): ResolvedTheme {
  const hour = date.getHours();
  return hour >= 6 && hour < 18 ? "light" : "dark";
}

function resolveTheme(theme: Theme): ResolvedTheme {
  return theme === "system" ? getTimeBasedTheme() : theme;
}

// Aplica/remove a classe `.dark` no <html> (lida pelo Tailwind via @custom-variant).
function applyResolvedTheme(resolved: ResolvedTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system"
    ? stored
    : "system";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Valor inicial deterministico ("system") para nao quebrar a hidratacao do SSR.
  // O valor real do localStorage e sincronizado no efeito abaixo.
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");

  // Sincroniza o estado com o que foi persistido (apos montar no cliente).
  useEffect(() => {
    const stored = readStoredTheme();
    setThemeState(stored);
    setResolvedTheme(resolveTheme(stored));
  }, []);

  // Sempre que o tema muda, aplica a classe e persiste a escolha.
  useEffect(() => {
    const resolved = resolveTheme(theme);
    setResolvedTheme(resolved);
    applyResolvedTheme(resolved);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, theme);
    }
  }, [theme]);

  // No modo "system", reavalia periodicamente para virar o tema sozinho as 18h/06h.
  useEffect(() => {
    if (theme !== "system") return;
    const interval = window.setInterval(() => {
      const resolved = getTimeBasedTheme();
      setResolvedTheme(resolved);
      applyResolvedTheme(resolved);
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => setThemeState(next), []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme deve ser usado dentro de um <ThemeProvider>");
  }
  return context;
}
