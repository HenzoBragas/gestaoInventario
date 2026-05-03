import { useState, useCallback, useMemo, useEffect } from "react";
import { api, categoriesApi } from "@/lib/api";

export interface InventoryItem {
  seq?: number;
  id: string;
  name: string;
  model: string;
  category: string;
  quantity: number;
  updatedAt: string;
}

interface ProductResponse {
  seq: number;
  id: string;
  name: string;
  model: string;
  category: string;
  stock: number;
  changeDate: string;
}

interface ProductRequest {
  id: string;
  name: string;
  model: string;
  category: string;
  stock: number;
}

export interface Category {
  seq?: number;
  name: string;
  inactive?: number;
}

interface CategoryResponse {
  seq: number;
  name: string;
  inactive: number;
}

export type ItemStatus = "Em Estoque" | "Estoque Baixo" | "Sem Estoque";

export function getStatus(quantity: number): ItemStatus {
  if (quantity === 0) return "Sem Estoque";
  if (quantity <= 5) return "Estoque Baixo";
  return "Em Estoque";
}

const DEFAULT_CATEGORIES = [
  "Eletrônicos",
  "Periféricos",
  "Componentes",
  "Cabos & Conectores",
  "Acessórios",
  "Outros",
];

const now = () => new Date().toISOString();

function toInventoryItem(product: ProductResponse): InventoryItem {
  return {
    seq: product.seq,
    id: product.id,
    name: product.name,
    model: product.model ?? "",
    category: product.category ?? "Outros",
    quantity: product.stock ?? 0,
    updatedAt: product.changeDate ? new Date(product.changeDate).toISOString() : now(),
  };
}

function toProductRequest(item: Partial<InventoryItem>): ProductRequest {
  return {
    id: item.id ?? "",
    name: item.name ?? "",
    model: item.model ?? "",
    category: item.category ?? "Outros",
    stock: Math.max(0, Number(item.quantity ?? 0)),
  };
}

export function useInventoryStore() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES.map(name => ({ name, inactive: 0 })));

  const fetchCategories = useCallback(async () => {
    try {
      const response = await categoriesApi.get<CategoryResponse[]>("");
      // Filter only active categories (inactive = 0)
      const activeCategories = response.data.filter(cat => cat.inactive === 0);
      setCategories(activeCategories);
    } catch (error) {
      console.error("Erro ao buscar categorias:", error);
      // Fallback to default categories if API fails
      setCategories(DEFAULT_CATEGORIES.map((name) => ({ name, inactive: 0 })));
    }
  }, []);

  const addCategory = useCallback(async (name: string) => {
    try {
      const response = await categoriesApi.post<CategoryResponse>("", { name, inactive: 0 });
      await fetchCategories();
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 409) {
        throw new Error("Categoria já existe");
      }
      throw error;
    }
  }, [fetchCategories]);

  const deleteCategory = useCallback(async (seq: number) => {
    try {
      await categoriesApi.delete(`/${seq}`);
      await fetchCategories();
    } catch (error) {
      throw error;
    }
  }, [fetchCategories]);

  const fetchItems = useCallback(async () => {
    const response = await api.get<ProductResponse[]>("");
    setItems(response.data.map(toInventoryItem));
  }, []);

  useEffect(() => {
    void fetchCategories();
    void fetchItems();
  }, [fetchCategories, fetchItems]);

  const addItem = useCallback(async (item: Omit<InventoryItem, "updatedAt">) => {
    await api.post("", toProductRequest(item));
    await fetchItems();
  }, [fetchItems]);

  const updateItem = useCallback(async (id: string, updates: Partial<InventoryItem>) => {
    const current = items.find((item) => item.id === id);
    if (!current?.seq) return;

    const merged: InventoryItem = {
      ...current,
      ...updates,
      updatedAt: now(),
    };

    await api.put(`/${current.seq}`, toProductRequest(merged));
    await fetchItems();
  }, [items, fetchItems]);

  const deleteItem = useCallback(async (id: string) => {
    const current = items.find((item) => item.id === id);
    if (!current?.seq) return;

    await api.delete(`/${current.seq}`);
    await fetchItems();
  }, [items, fetchItems]);

  const adjustQuantity = useCallback(async (id: string, delta: number) => {
    const current = items.find((item) => item.id === id);
    if (!current?.seq) return;

    const nextQuantity = Math.max(0, current.quantity + delta);
    if (nextQuantity === current.quantity) return;

    await api.put(`/${current.seq}`, toProductRequest({ ...current, quantity: nextQuantity }));
    await fetchItems();
  }, [items, fetchItems]);

  const stats = useMemo(() => {
    const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
    const categoriesCount = categories.length;
    const lowStockAlerts = items.filter((i) => i.quantity > 0 && i.quantity <= 5).length;
    const outOfStock = items.filter((i) => i.quantity === 0).length;
    return { totalItems, categories: categoriesCount, lowStockAlerts, outOfStock };
  }, [items, categories]);

  return { items, addItem, updateItem, deleteItem, adjustQuantity, stats, categories, addCategory, deleteCategory };
}
