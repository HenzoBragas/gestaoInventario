import axios, { AxiosError, type AxiosRequestConfig } from "axios";

// O build recebe VITE_API_URL=/api/products (contrato antigo); a base da API e o prefixo sem /products.
const RAW_API_URL: string = import.meta.env.VITE_API_URL ?? "/api/products";
export const API_BASE = RAW_API_URL.replace(/\/products\/?$/, "");

/** Erro normalizado da API: { status, code, message, fieldErrors }. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors: Record<string, string>;

  constructor(status: number, code: string, message: string, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

// Todos os erros de queries/mutacoes passam pelo interceptor e chegam como ApiError.
declare module "@tanstack/react-query" {
  interface Register {
    defaultError: ApiError;
  }
}

interface ErrorBody {
  code?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
}

let getToken: () => string | null = () => null;
let handleUnauthorized: () => void = () => {};

/** Conecta o cliente HTTP a sessao (definido pelo AuthProvider). */
export function configureAuth(options: { getToken: () => string | null; onUnauthorized: () => void }) {
  getToken = options.getToken;
  handleUnauthorized = options.onUnauthorized;
}

export const http = axios.create({ baseURL: API_BASE, timeout: 30_000 });

http.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.set("Authorization", `Bearer ${token}`);
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const apiError = toApiError(error);
    // So um 401 de requisicao que levava token indica sessao expirada/invalidada.
    const sentToken = error instanceof AxiosError && Boolean(error.config?.headers?.has("Authorization"));
    if (apiError.status === 401 && sentToken) handleUnauthorized();
    return Promise.reject(apiError);
  },
);

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof AxiosError) {
    if (!error.response) {
      return new ApiError(0, "NETWORK_ERROR", "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.");
    }
    const body = (error.response.data ?? {}) as ErrorBody;
    const status = error.response.status;
    const fallback =
      status >= 500
        ? "O servidor encontrou um erro. Tente novamente em instantes."
        : status === 403
          ? "Seu perfil não tem permissão para esta operação."
          : "Não foi possível concluir a operação.";
    return new ApiError(status, body.code ?? `HTTP_${status}`, body.message ?? fallback, body.fieldErrors ?? {});
  }
  return new ApiError(0, "UNKNOWN", "Erro inesperado.");
}

export async function request<T>(config: AxiosRequestConfig): Promise<T> {
  const response = await http.request<T>(config);
  return response.data;
}

/** Baixa um arquivo gerado pela API (ex.: CSV) respeitando a autenticacao. */
export async function download(url: string, params?: Record<string, unknown>) {
  const response = await http.get<Blob>(url, { params, responseType: "blob", paramsSerializer: { indexes: null } });
  const disposition = String(response.headers["content-disposition"] ?? "");
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  const filename = encoded ? decodeURIComponent(encoded[1]) : (match?.[1] ?? "exportacao.csv");
  const href = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
  return filename;
}

/** Remove parametros vazios e serializa listas como "a,b". */
export function cleanParams(params: object): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length) result[key] = value.join(",");
      continue;
    }
    result[key] = value as string | number | boolean;
  }
  return result;
}
