import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { configureAuth, toApiError } from "@/lib/api/client";
import { authApi } from "@/lib/api/services";
import type { Role, User } from "@/lib/api/types";

/**
 * Credenciais do administrador criado automaticamente pelo backend (seed), exibidas no
 * aviso de "Ambiente de demonstração" da tela de login. A verificacao e feita no servidor.
 */
export const DEMO_CREDENTIALS = {
  username: "inventario",
  password: "inventario123",
} as const;

const STORAGE_KEY = "inventario:session";

interface Session {
  token: string;
  expiresAt: string;
  user: User;
}

export interface LoginCredentials {
  identifier: string;
  password: string;
  /** true = sessao persiste entre visitas (localStorage); false = so nesta aba (sessionStorage). */
  remember: boolean;
}

export type LoginFailure = "invalid-credentials" | "too-many-attempts" | "disabled" | "unexpected";

export type LoginResult =
  | {
      ok: true;
      /** Efetiva a sessao. Separado para a interface concluir a animacao de sucesso antes. */
      commit: () => void;
    }
  | { ok: false; reason: LoginFailure; message: string };

interface AuthContextValue {
  isAuthenticated: boolean;
  /** Indica que a sessao ja foi lida do storage (evita "piscar" a tela de login). */
  isReady: boolean;
  user: User | null;
  role: Role | null;
  login: (credentials: LoginCredentials) => Promise<LoginResult>;
  logout: (reason?: "expired") => void;
  /** Atualiza os dados do usuario na sessao (ex.: preferencias salvas). */
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readSession(): Session | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY) ?? window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as Session;
    return new Date(session.expiresAt).getTime() > Date.now() ? session : null;
  } catch {
    return null;
  }
}

function writeSession(session: Session, remember: boolean) {
  try {
    const storage = remember ? window.localStorage : window.sessionStorage;
    storage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Storage indisponivel: a sessao vale so em memoria.
  }
}

function persistUser(user: User) {
  try {
    for (const storage of [window.localStorage, window.sessionStorage]) {
      const raw = storage.getItem(STORAGE_KEY);
      if (raw) storage.setItem(STORAGE_KEY, JSON.stringify({ ...(JSON.parse(raw) as Session), user }));
    }
  } catch {
    // Ignora: o estado em memoria ja foi atualizado.
  }
}

function clearSession() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.sessionStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem("inventario:auth"); // chave da versao anterior
  } catch {
    // Nada a limpar.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [isReady, setIsReady] = useState(false);
  const sessionRef = useRef<Session | null>(null);
  sessionRef.current = session;

  const logout = useCallback(
    (reason?: "expired") => {
      clearSession();
      setSession(null);
      queryClient.clear();
      if (reason === "expired") {
        try {
          window.sessionStorage.setItem("inventario:expired", "1");
        } catch {
          // Sem aviso de sessao expirada.
        }
      }
    },
    [queryClient],
  );

  // Conecta o cliente HTTP ao token atual e trata 401 (token expirado/invalidado no servidor).
  useEffect(() => {
    configureAuth({
      getToken: () => sessionRef.current?.token ?? null,
      onUnauthorized: () => {
        if (sessionRef.current) logout("expired");
      },
    });
  }, [logout]);

  // Restaura a sessao salva e revalida o usuario no servidor (perfil pode ter mudado).
  useEffect(() => {
    const stored = readSession();
    if (!stored) clearSession();
    setSession(stored);
    setIsReady(true);
    if (stored) {
      authApi
        .me()
        .then((user) => {
          setSession((current) => (current ? { ...current, user } : current));
          persistUser(user);
        })
        .catch(() => {
          // 401 ja dispara logout via interceptor; outros erros mantem a sessao local.
        });
    }
  }, []);

  // Encerra a sessao quando o token expira com a aba aberta.
  useEffect(() => {
    if (!session) return;
    const remaining = new Date(session.expiresAt).getTime() - Date.now();
    const timer = window.setTimeout(() => logout("expired"), Math.max(0, Math.min(remaining, 2_147_000_000)));
    return () => window.clearTimeout(timer);
  }, [session, logout]);

  const login = useCallback(async ({ identifier, password, remember }: LoginCredentials): Promise<LoginResult> => {
    try {
      const response = await authApi.login({ username: identifier.trim(), password, remember });
      const next: Session = { token: response.token, expiresAt: response.expiresAt, user: response.user };
      return {
        ok: true,
        commit: () => {
          clearSession();
          writeSession(next, remember);
          setSession(next);
        },
      };
    } catch (error) {
      const apiError = toApiError(error);
      const reason: LoginFailure =
        apiError.status === 401
          ? "invalid-credentials"
          : apiError.status === 429
            ? "too-many-attempts"
            : apiError.code === "USER_DISABLED"
              ? "disabled"
              : "unexpected";
      return { ok: false, reason, message: apiError.message };
    }
  }, []);

  const updateUser = useCallback((user: User) => {
    setSession((current) => (current ? { ...current, user } : current));
    persistUser(user);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: Boolean(session),
      isReady,
      user: session?.user ?? null,
      role: session?.user.role ?? null,
      login,
      logout,
      updateUser,
    }),
    [session, isReady, login, logout, updateUser],
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
