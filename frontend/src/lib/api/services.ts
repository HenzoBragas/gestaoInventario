import { cleanParams, download, request } from "@/lib/api/client";
import type {
  AppNotification,
  AuditEntry,
  AuditQuery,
  EmployeeOption,
  Invoice,
  InvoiceInput,
  InvoiceQuery,
  Category,
  CategoryInput,
  Dashboard,
  GroupTotal,
  LocationBalance,
  LocationInput,
  LoginResponse,
  Movement,
  MovementInput,
  MovementQuery,
  Page,
  PeriodSummary,
  Product,
  ProductInput,
  ProductQuery,
  Settings,
  SettingsInput,
  StockLocation,
  Supplier,
  SupplierInput,
  TopProduct,
  User,
  UserInput,
} from "@/lib/api/types";

export const authApi = {
  login: (body: { username: string; password: string; remember: boolean }) =>
    request<LoginResponse>({ method: "POST", url: "/auth/login", data: body }),
  me: () => request<User>({ url: "/auth/me" }),
  updatePreferences: (body: Pick<User, "notifyLowStock" | "notifyOutOfStock" | "notifyMovements">) =>
    request<User>({ method: "PUT", url: "/auth/me/preferences", data: body }),
  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    request<void>({ method: "PUT", url: "/auth/me/password", data: body }),
};

export const productsApi = {
  list: (query: ProductQuery) => request<Page<Product>>({ url: "/products", params: cleanParams(query) }),
  get: (id: number) => request<Product>({ url: `/products/${id}` }),
  movements: (id: number, page: number, size = 10) =>
    request<Page<Movement>>({ url: `/products/${id}/movements`, params: { page, size } }),
  create: (body: ProductInput) => request<Product>({ method: "POST", url: "/products", data: body }),
  update: (id: number, body: ProductInput) => request<Product>({ method: "PUT", url: `/products/${id}`, data: body }),
  setActive: (id: number, active: boolean) =>
    request<Product>({ method: "PATCH", url: `/products/${id}/status`, data: { active } }),
  remove: (id: number) => request<void>({ method: "DELETE", url: `/products/${id}` }),
  exportCsv: (query: Omit<ProductQuery, "page" | "size">) => download("/reports/inventory.csv", cleanParams(query)),
};

export const categoriesApi = {
  list: () => request<Category[]>({ url: "/categories" }),
  create: (body: CategoryInput) => request<Category>({ method: "POST", url: "/categories", data: body }),
  update: (id: number, body: CategoryInput) => request<Category>({ method: "PUT", url: `/categories/${id}`, data: body }),
  reassign: (id: number, targetCategoryId: number) =>
    request<Category>({ method: "POST", url: `/categories/${id}/reassign`, data: { targetCategoryId } }),
  remove: (id: number) => request<void>({ method: "DELETE", url: `/categories/${id}` }),
};

export const suppliersApi = {
  list: () => request<Supplier[]>({ url: "/suppliers" }),
  create: (body: SupplierInput) => request<Supplier>({ method: "POST", url: "/suppliers", data: body }),
  update: (id: number, body: SupplierInput) => request<Supplier>({ method: "PUT", url: `/suppliers/${id}`, data: body }),
  remove: (id: number) => request<void>({ method: "DELETE", url: `/suppliers/${id}` }),
};

export const invoicesApi = {
  list: (query: InvoiceQuery) => request<Page<Invoice>>({ url: "/invoices", params: cleanParams(query) }),
  create: (body: InvoiceInput) => request<Invoice>({ method: "POST", url: "/invoices", data: body }),
  update: (id: number, body: InvoiceInput) => request<Invoice>({ method: "PUT", url: `/invoices/${id}`, data: body }),
  remove: (id: number) => request<void>({ method: "DELETE", url: `/invoices/${id}` }),
  attach: (id: number, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<Invoice>({ method: "PUT", url: `/invoices/${id}/file`, data: form, timeout: 120_000 });
  },
  detach: (id: number) => request<Invoice>({ method: "DELETE", url: `/invoices/${id}/file` }),
  download: (id: number) => download(`/invoices/${id}/file`),
};

export const locationsApi = {
  list: () => request<StockLocation[]>({ url: "/locations" }),
  balances: (id: number) => request<LocationBalance[]>({ url: `/locations/${id}/balances` }),
  create: (body: LocationInput) => request<StockLocation>({ method: "POST", url: "/locations", data: body }),
  update: (id: number, body: LocationInput) =>
    request<StockLocation>({ method: "PUT", url: `/locations/${id}`, data: body }),
  remove: (id: number) => request<void>({ method: "DELETE", url: `/locations/${id}` }),
};

export const movementsApi = {
  list: (query: MovementQuery) => request<Page<Movement>>({ url: "/movements", params: cleanParams(query) }),
  get: (id: number) => request<Movement>({ url: `/movements/${id}` }),
  create: (body: MovementInput) => request<Movement>({ method: "POST", url: "/movements", data: body }),
  exportCsv: (query: Omit<MovementQuery, "page" | "size">) => download("/reports/movements.csv", cleanParams(query)),
};

export const analyticsApi = {
  dashboard: (days: number) => request<Dashboard>({ url: "/dashboard", params: { days } }),
  notifications: () => request<AppNotification[]>({ url: "/notifications" }),
  periodSummary: (params: { from: string; to?: string; groupBy: string }) =>
    request<PeriodSummary[]>({ url: "/reports/period-summary", params: cleanParams(params) }),
  topProducts: (params: { from: string; to?: string; limit?: number }) =>
    request<TopProduct[]>({ url: "/reports/top-products", params: cleanParams(params) }),
  valuation: (groupBy: "category" | "location") =>
    request<GroupTotal[]>({ url: "/reports/valuation", params: { groupBy } }),
  exportPeriodSummary: (params: { from: string; to?: string; groupBy: string }) =>
    download("/reports/period-summary.csv", cleanParams(params)),
  exportTopProducts: (params: { from: string; to?: string; limit?: number }) =>
    download("/reports/top-products.csv", cleanParams(params)),
  exportValuation: (groupBy: "category" | "location") => download("/reports/valuation.csv", { groupBy }),
};

export const adminApi = {
  users: () => request<User[]>({ url: "/users" }),
  createUser: (body: UserInput) => request<User>({ method: "POST", url: "/users", data: body }),
  updateUser: (id: number, body: UserInput) => request<User>({ method: "PUT", url: `/users/${id}`, data: body }),
  settings: () => request<Settings>({ url: "/settings" }),
  updateSettings: (body: SettingsInput) => request<Settings>({ method: "PUT", url: "/settings", data: body }),
  audit: (params: AuditQuery) => request<Page<AuditEntry>>({ url: "/audit", params: cleanParams(params) }),
  employees: () => request<EmployeeOption[]>({ url: "/employees" }),
};
