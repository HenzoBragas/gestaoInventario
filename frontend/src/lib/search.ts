import { useEffect } from "react";
import { z } from "zod";
import type { ProductQuery } from "@/lib/api/types";

// Parametros de busca das paginas (validados na rota; valores invalidos sao descartados).

const optionalId = z.coerce.number().int().positive().optional().catch(undefined);
const optionalText = z.string().trim().min(1).optional().catch(undefined);
const page = z.coerce.number().int().min(0).optional().catch(undefined);
const size = z.coerce.number().int().min(5).max(100).optional().catch(undefined);
const direction = z.enum(["asc", "desc"]).optional().catch(undefined);
const flag = z
  .union([z.boolean(), z.enum(["true", "false"]).transform((v) => v === "true")])
  .optional()
  .catch(undefined);

const STATUSES = ["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK", "INACTIVE"] as const;
/** Aceita "LOW_STOCK", "LOW_STOCK,OUT_OF_STOCK" ou um array. */
const statusList = z
  .preprocess((value) => (typeof value === "string" ? value.split(",") : value), z.array(z.enum(STATUSES)).min(1))
  .optional()
  .catch(undefined);

export const inventorySearchSchema = z.object({
  q: optionalText,
  categoryId: optionalId,
  locationId: optionalId,
  supplierId: optionalId,
  status: statusList,
  missingCost: flag,
  sort: optionalText,
  dir: direction,
  page,
  size,
});
export type InventorySearch = z.infer<typeof inventorySearchSchema>;

export const productsSearchSchema = inventorySearchSchema.extend({
  new: flag,
});
export type ProductsSearch = z.infer<typeof productsSearchSchema>;

export const movementsSearchSchema = z.object({
  q: optionalText,
  type: z.enum(["IN", "OUT", "ADJUSTMENT", "TRANSFER"]).optional().catch(undefined),
  productId: optionalId,
  locationId: optionalId,
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  movementId: optionalId,
  page,
  size,
});
export type MovementsSearch = z.infer<typeof movementsSearchSchema>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined);

export const invoicesSearchSchema = z.object({
  q: optionalText,
  productId: optionalId,
  employeeId: optionalId,
  from: isoDate,
  to: isoDate,
  sort: optionalText,
  dir: direction,
  page,
  size,
  /** Abre o formulario de nova nota (ex.: vindo do detalhe do produto). */
  new: flag,
});
export type InvoicesSearch = z.infer<typeof invoicesSearchSchema>;

export const auditSearchSchema = z.object({
  table: optionalText,
  employeeId: optionalId,
  q: optionalText,
  from: isoDate,
  to: isoDate,
  page,
  size,
});
export type AuditSearch = z.infer<typeof auditSearchSchema>;

export const entitySearchSchema = z.object({ id: optionalId, q: optionalText });
export type EntitySearch = z.infer<typeof entitySearchSchema>;

/**
 * Preserva os filtros de uma pagina durante a sessao: ao voltar a ela sem filtros na URL
 * (ex.: pelo menu), os ultimos criterios usados sao restaurados.
 */
export function usePersistedSearch<T extends object>(key: string, search: T, restore: (saved: T) => void) {
  const storageKey = `inventario:filters:${key}`;
  const isEmpty = Object.values(search).every((v) => v === undefined);

  useEffect(() => {
    if (!isEmpty) return;
    try {
      const raw = window.sessionStorage.getItem(storageKey);
      if (raw) restore(JSON.parse(raw) as T);
    } catch {
      // Sem filtros salvos.
    }
    // Restaura somente na montagem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      if (isEmpty) window.sessionStorage.removeItem(storageKey);
      else window.sessionStorage.setItem(storageKey, JSON.stringify(search));
    } catch {
      // Ignora.
    }
  }, [search, isEmpty, storageKey]);
}

/** Converte os parametros da URL na consulta paginada de produtos. */
export function toProductQuery(search: InventorySearch, defaultSort = "name"): ProductQuery {
  return {
    q: search.q,
    categoryId: search.categoryId,
    locationId: search.locationId,
    supplierId: search.supplierId,
    status: search.status,
    missingCost: search.missingCost,
    sort: search.sort ?? defaultSort,
    direction: search.dir ?? "asc",
    page: search.page ?? 0,
    size: search.size ?? 25,
  };
}
