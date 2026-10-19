import type { LocationType, Movement, MovementType, Role, StockStatus } from "@/lib/api/types";

/** "DEP-01 → LOJ-01" para transferencias; o codigo envolvido nas demais. */
export function locationsOf(m: Pick<Movement, "fromLocationCode" | "toLocationCode">) {
  if (m.fromLocationCode && m.toLocationCode) return `${m.fromLocationCode} → ${m.toLocationCode}`;
  return m.fromLocationCode ?? m.toLocationCode ?? "—";
}

export const STATUS_LABEL: Record<StockStatus, string> = {
  IN_STOCK: "Em estoque",
  LOW_STOCK: "Estoque baixo",
  OUT_OF_STOCK: "Sem estoque",
  INACTIVE: "Inativo",
};

/** Regra exibida ao usuario (a regra efetiva roda no servidor: StockStatus.of). */
export const STATUS_RULE: Record<StockStatus, string> = {
  IN_STOCK: "Saldo acima do estoque mínimo do produto.",
  LOW_STOCK: "Saldo maior que zero e menor ou igual ao estoque mínimo do produto.",
  OUT_OF_STOCK: "Produto ativo com saldo zerado.",
  INACTIVE: "Cadastro desativado. Não recebe movimentações, independentemente do saldo.",
};

export const MOVEMENT_LABEL: Record<MovementType, string> = {
  IN: "Entrada",
  OUT: "Saída",
  ADJUSTMENT: "Ajuste",
  TRANSFER: "Transferência",
};

export const MOVEMENT_DESCRIPTION: Record<MovementType, string> = {
  IN: "Recebimento de mercadoria em uma localização.",
  OUT: "Baixa de mercadoria de uma localização.",
  TRANSFER: "Move saldo entre localizações sem alterar o total.",
  ADJUSTMENT: "Corrige o saldo para a quantidade contada fisicamente.",
};

export const MOVEMENT_REASONS: Record<MovementType, string[]> = {
  IN: ["Compra de fornecedor", "Devolução de cliente", "Produção interna", "Saldo inicial", "Outro"],
  OUT: ["Venda", "Consumo interno", "Devolução ao fornecedor", "Perda ou avaria", "Outro"],
  TRANSFER: ["Reposição da loja", "Reorganização de estoque", "Envio para avaria", "Outro"],
  ADJUSTMENT: ["Contagem cíclica", "Inventário geral", "Correção de lançamento", "Perda identificada", "Outro"],
};

export const LOCATION_TYPE_LABEL: Record<LocationType, string> = {
  WAREHOUSE: "Armazém",
  DEPOT: "Depósito",
  STORE: "Loja",
  INTERNAL_AREA: "Área interna",
};

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Administrador",
  MANAGER: "Gerente de inventário",
  OPERATOR: "Operador",
  VIEWER: "Visualizador",
};

export const ROLE_DESCRIPTION: Record<Role, string> = {
  ADMIN: "Acesso total, incluindo usuários e configurações.",
  MANAGER: "Cadastros, ajustes de inventário, relatórios e auditoria.",
  OPERATOR: "Entradas, saídas e transferências; consulta os cadastros.",
  VIEWER: "Somente consulta e exportação.",
};

const ROLE_RANK: Record<Role, number> = { VIEWER: 0, OPERATOR: 1, MANAGER: 2, ADMIN: 3 };

export type Permission =
  | "catalog:write"
  | "movement:create"
  | "movement:adjust"
  | "users:manage"
  | "settings:write"
  | "audit:read";

const REQUIRED_ROLE: Record<Permission, Role> = {
  "catalog:write": "MANAGER",
  "movement:create": "OPERATOR",
  "movement:adjust": "MANAGER",
  "users:manage": "ADMIN",
  "settings:write": "ADMIN",
  "audit:read": "MANAGER",
};

/**
 * Controla apenas o que a interface mostra. A autorizacao efetiva e verificada no
 * servidor (SecurityConfig + checagens nos servicos).
 */
export function can(role: Role | null | undefined, permission: Permission) {
  return role ? ROLE_RANK[role] >= ROLE_RANK[REQUIRED_ROLE[permission]] : false;
}
