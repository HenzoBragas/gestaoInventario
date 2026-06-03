import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

// Credenciais fixas (hardcoded) para esta etapa do projeto.
const CREDENTIALS = {
  username: "inventario",
  password: "inventario123",
};

const STORAGE_KEY = "inventario:auth";

interface AuthContextValue {
  isAuthenticated: boolean;
  /** Indica que o estado ja foi lido do localStorage (evita "piscar" a tela de login). */
  isReady: boolean;
  /** Retorna true se as credenciais conferem. */
  login: (username: string, password: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // Restaura a sessao salva apos montar no cliente.
  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsAuthenticated(window.localStorage.getItem(STORAGE_KEY) === "1");
    }
    setIsReady(true);
  }, []);

  const login = useCallback((username: string, password: string) => {
    const ok =
      username.trim() === CREDENTIALS.username &&
      password === CREDENTIALS.password;
    if (ok) {
      setIsAuthenticated(true);
      window.localStorage.setItem(STORAGE_KEY, "1");
    }
    return ok;
  }, []);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    window.localStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ isAuthenticated, isReady, login, logout }),
    [isAuthenticated, isReady, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de um <AuthProvider>");
  }
  return context;
}
