// Contratos da API (espelham os DTOs do backend Spring Boot).

export type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "INACTIVE";
export type MovementType = "IN" | "OUT" | "ADJUSTMENT" | "TRANSFER";
export type LocationType = "WAREHOUSE" | "DEPOT" | "STORE" | "INTERNAL_AREA";
export type Role = "VIEWER" | "OPERATOR" | "MANAGER" | "ADMIN";

export interface Page<T> {
  items: T[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
}

export interface LocationQuantity {
  locationId: number;
  code: string;
  name: string;
  quantity: number;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  model: string;
  barcode: string | null;
  description: string | null;
  categoryId: number | null;
  categoryName: string | null;
  supplierId: number | null;
  supplierName: string | null;
  unit: string;
  unitCost: number;
  salePrice: number | null;
  minStock: number;
  defaultLocationId: number | null;
  defaultLocationName: string | null;
  imageUrl: string | null;
  active: boolean;
  stock: number;
  status: StockStatus;
  stockValue: number;
  createdAt: string | null;
  updatedAt: string | null;
  locations: LocationQuantity[];
}

export interface ProductInput {
  sku: string;
  name: string;
  model?: string | null;
  barcode?: string | null;
  description?: string | null;
  categoryId: number;
  supplierId?: number | null;
  unit: string;
  unitCost: number;
  salePrice?: number | null;
  minStock: number;
  defaultLocationId?: number | null;
  imageUrl?: string | null;
  active?: boolean;
  initialQuantity?: number;
}

export interface ProductQuery {
  q?: string;
  categoryId?: number;
  supplierId?: number;
  locationId?: number;
  status?: StockStatus[];
  missingCost?: boolean;
  sort?: string;
  direction?: "asc" | "desc";
  page?: number;
  size?: number;
}

export interface Category {
  seq: number;
  name: string;
  description: string | null;
  inactive: number;
  active: boolean;
  productCount: number;
}

export interface CategoryInput {
  name: string;
  description?: string | null;
  inactive: number;
}

export interface Supplier {
  id: number;
  name: string;
  taxId: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  active: boolean;
  productCount: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export type SupplierInput = Omit<Supplier, "id" | "productCount" | "createdAt" | "updatedAt">;

export interface StockLocation {
  id: number;
  code: string;
  name: string;
  type: LocationType;
  description: string | null;
  active: boolean;
  productCount: number;
  totalUnits: number;
  totalValue: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export type LocationInput = Pick<StockLocation, "code" | "name" | "type" | "description" | "active">;

export interface LocationBalance {
  productId: number;
  sku: string;
  productName: string;
  categoryName: string | null;
  unit: string;
  quantity: number;
  unitCost: number;
  value: number;
}

export interface Movement {
  id: number;
  type: MovementType;
  productId: number;
  productSku: string;
  productName: string;
  unit: string;
  quantity: number;
  delta: number;
  fromLocationId: number | null;
  fromLocationCode: string | null;
  fromLocationName: string | null;
  toLocationId: number | null;
  toLocationCode: string | null;
  toLocationName: string | null;
  reason: string;
  notes: string | null;
  reference: string | null;
  username: string;
  userDisplayName: string | null;
  createdAt: string;
  totalBefore: number;
  totalAfter: number;
  fromBefore: number | null;
  fromAfter: number | null;
  toBefore: number | null;
  toAfter: number | null;
}

export interface MovementInput {
  type: MovementType;
  productId: number;
  quantity?: number;
  countedQuantity?: number;
  fromLocationId?: number | null;
  toLocationId?: number | null;
  locationId?: number | null;
  reason: string;
  notes?: string | null;
  reference?: string | null;
  requestKey: string;
}

export interface MovementQuery {
  type?: MovementType;
  productId?: number;
  locationId?: number;
  from?: string;
  to?: string;
  q?: string;
  page?: number;
  size?: number;
}

/** Nota fiscal de compra; fileName nulo = sem anexo. */
export interface Invoice {
  id: number;
  number: string;
  purchasePlace: string;
  amount: number;
  paymentDate: string;
  productId: number;
  productCode: string;
  productName: string;
  employeeId: number;
  employeeName: string;
  fileName: string | null;
  fileType: string | null;
  fileSize: number | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface InvoiceInput {
  number: string;
  purchasePlace: string;
  amount: number;
  paymentDate: string;
  productId: number;
  employeeId: number;
}

export interface InvoiceQuery {
  q?: string;
  productId?: number;
  employeeId?: number;
  from?: string;
  to?: string;
  sort?: string;
  dir?: "asc" | "desc";
  page?: number;
  size?: number;
}

export interface EmployeeOption {
  id: number;
  name: string;
  username: string;
}

export interface User {
  id: number;
  username: string;
  name: string;
  email: string | null;
  role: Role;
  active: boolean;
  notifyLowStock: boolean;
  notifyOutOfStock: boolean;
  notifyMovements: boolean;
  createdAt: string | null;
  lastLoginAt: string | null;
}

export interface UserInput {
  username: string;
  name: string;
  email?: string | null;
  role: Role;
  active: boolean;
  password?: string;
}

export interface LoginResponse {
  token: string;
  expiresAt: string;
  user: User;
}

export interface Settings {
  organizationName: string;
  taxId: string | null;
  currency: "BRL" | "USD" | "EUR";
  locale: "pt-BR" | "en-US" | "es-ES";
  timeZone: string;
  defaultMinStock: number;
  units: string[];
  updatedAt: string | null;
}

export type SettingsInput = Omit<Settings, "updatedAt">;

export interface Kpis {
  activeProducts: number;
  inactiveProducts: number;
  totalUnits: number;
  inventoryValue: number;
  lowStock: number;
  outOfStock: number;
  productsWithoutCost: number;
  inUnits: number;
  outUnits: number;
  movementCount: number;
  previousInUnits: number;
  previousOutUnits: number;
  previousMovementCount: number;
}

export interface DailyPoint {
  date: string;
  inUnits: number;
  outUnits: number;
  inventoryValue: number;
}

export interface GroupTotal {
  id: number;
  label: string;
  products: number;
  units: number;
  value: number;
}

export interface TopProduct {
  productId: number;
  sku: string;
  name: string;
  inUnits: number;
  outUnits: number;
  total: number;
}

export interface AlertItem {
  productId: number;
  sku: string;
  name: string;
  stock: number;
  minStock: number;
  unit: string;
}

export interface Dashboard {
  days: number;
  generatedAt: string;
  kpis: Kpis;
  series: DailyPoint[];
  byCategory: GroupTotal[];
  byLocation: GroupTotal[];
  topProducts: TopProduct[];
  lowStockItems: AlertItem[];
  outOfStockItems: AlertItem[];
  recentMovements: Movement[];
}

export interface PeriodSummary {
  period: string;
  start: string;
  inUnits: number;
  outUnits: number;
  adjustments: number;
  transfers: number;
  movements: number;
}

export interface AppNotification {
  id: string;
  type: "OUT_OF_STOCK" | "LOW_STOCK" | "MOVEMENT";
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  createdAt: string;
  link: string;
  entityId: number;
}

/** Linha da tabela Auditoria (gravada pelos triggers do banco): um campo alterado por linha. */
export interface AuditEntry {
  id: number;
  table: string;
  field: string;
  oldValue: string;
  newValue: string;
  changedAt: string;
  employeeId: number | null;
  employeeName: string | null;
  dbUser: string;
}

export interface AuditQuery {
  table?: string;
  employeeId?: number;
  q?: string;
  from?: string;
  to?: string;
  page?: number;
  size?: number;
}
