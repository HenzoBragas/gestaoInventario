import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-provider";
import type { ApiError } from "@/lib/api/client";
import {
  adminApi,
  analyticsApi,
  categoriesApi,
  locationsApi,
  movementsApi,
  productsApi,
  suppliersApi,
} from "@/lib/api/services";
import type { MovementQuery, ProductQuery } from "@/lib/api/types";

/** Chaves de cache: toda escrita de estoque/cadastro invalida o grupo "data". */
export const keys = {
  data: ["data"] as const,
  products: (q: ProductQuery) => ["data", "products", q] as const,
  product: (id: number) => ["data", "product", id] as const,
  productMovements: (id: number, page: number) => ["data", "product", id, "movements", page] as const,
  categories: ["data", "categories"] as const,
  suppliers: ["data", "suppliers"] as const,
  locations: ["data", "locations"] as const,
  locationBalances: (id: number) => ["data", "locations", id, "balances"] as const,
  movements: (q: MovementQuery) => ["data", "movements", q] as const,
  movement: (id: number) => ["data", "movement", id] as const,
  dashboard: (days: number) => ["data", "dashboard", days] as const,
  notifications: ["data", "notifications"] as const,
  report: (name: string, params: unknown) => ["data", "report", name, params] as const,
  settings: ["settings"] as const,
  users: ["users"] as const,
  audit: (params: unknown) => ["audit", params] as const,
};

function useEnabled() {
  return useAuth().isAuthenticated;
}

// ------------------------------------------------------------------ consultas

export function useProducts(query: ProductQuery, enabled = true) {
  return useQuery({
    queryKey: keys.products(query),
    queryFn: () => productsApi.list(query),
    enabled: useEnabled() && enabled,
    placeholderData: keepPreviousData,
  });
}

export function useProduct(id: number | undefined) {
  return useQuery({
    queryKey: keys.product(id ?? 0),
    queryFn: () => productsApi.get(id as number),
    enabled: useEnabled() && Boolean(id),
  });
}

export function useProductMovements(id: number, page: number) {
  return useQuery({
    queryKey: keys.productMovements(id, page),
    queryFn: () => productsApi.movements(id, page),
    enabled: useEnabled(),
    placeholderData: keepPreviousData,
  });
}

export function useCategories() {
  return useQuery({ queryKey: keys.categories, queryFn: categoriesApi.list, enabled: useEnabled(), staleTime: 60_000 });
}

export function useSuppliers() {
  return useQuery({ queryKey: keys.suppliers, queryFn: suppliersApi.list, enabled: useEnabled(), staleTime: 60_000 });
}

export function useLocations() {
  return useQuery({ queryKey: keys.locations, queryFn: locationsApi.list, enabled: useEnabled(), staleTime: 60_000 });
}

export function useLocationBalances(id: number | undefined) {
  return useQuery({
    queryKey: keys.locationBalances(id ?? 0),
    queryFn: () => locationsApi.balances(id as number),
    enabled: useEnabled() && Boolean(id),
  });
}

export function useMovements(query: MovementQuery) {
  return useQuery({
    queryKey: keys.movements(query),
    queryFn: () => movementsApi.list(query),
    enabled: useEnabled(),
    placeholderData: keepPreviousData,
  });
}

export function useMovement(id: number | undefined) {
  return useQuery({
    queryKey: keys.movement(id ?? 0),
    queryFn: () => movementsApi.get(id as number),
    enabled: useEnabled() && Boolean(id),
  });
}

export function useDashboard(days: number) {
  return useQuery({
    queryKey: keys.dashboard(days),
    queryFn: () => analyticsApi.dashboard(days),
    enabled: useEnabled(),
    placeholderData: keepPreviousData,
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: keys.notifications,
    queryFn: analyticsApi.notifications,
    enabled: useEnabled(),
    refetchInterval: 60_000,
  });
}

export function useSettings() {
  return useQuery({ queryKey: keys.settings, queryFn: adminApi.settings, enabled: useEnabled(), staleTime: 5 * 60_000 });
}

export function useUsers(enabled: boolean) {
  return useQuery({ queryKey: keys.users, queryFn: adminApi.users, enabled: useEnabled() && enabled });
}

export function useAudit(params: { entity?: string; q?: string; page: number }, enabled: boolean) {
  return useQuery({
    queryKey: keys.audit(params),
    queryFn: () => adminApi.audit({ ...params, size: 20 }),
    enabled: useEnabled() && enabled,
    placeholderData: keepPreviousData,
  });
}

// ------------------------------------------------------------------ escrita

/**
 * Mutacao padrao: toast de sucesso, toast de erro (exceto erros de campo, mostrados no formulario)
 * e invalidacao dos dados para a interface refletir o estado do servidor.
 */
export function useApiMutation<TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
  options: {
    success?: string | ((result: TResult, variables: TVariables) => string);
    invalidate?: ReadonlyArray<readonly unknown[]>;
    onSuccess?: (result: TResult, variables: TVariables) => void;
    silentFieldErrors?: boolean;
  } = {},
) {
  const queryClient = useQueryClient();
  return useMutation<TResult, ApiError, TVariables>({
    mutationFn,
    onSuccess: async (result, variables) => {
      const invalidations = options.invalidate ?? [keys.data];
      await Promise.all(invalidations.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      if (options.success) {
        toast.success(typeof options.success === "function" ? options.success(result, variables) : options.success);
      }
      options.onSuccess?.(result, variables);
    },
    onError: (error) => {
      const hasFieldErrors = Object.keys(error.fieldErrors ?? {}).length > 0;
      if (!(options.silentFieldErrors && hasFieldErrors)) {
        toast.error(error.message);
      }
    },
  });
}
