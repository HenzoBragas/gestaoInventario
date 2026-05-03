import { useState, useCallback, useMemo, useEffect } from "react";
import { api } from "@/lib/api";

export interface InventoryItem {
  seq?: number;
  id: string;
  name: string;
  model: string;
  category: string;
  quantity: number;
  description: string;
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

export type ItemStatus = "Em Estoque" | "Estoque Baixo" | "Sem Estoque";

export function getStatus(quantity: number): ItemStatus {
  if (quantity === 0) return "Sem Estoque";
  if (quantity <= 5) return "Estoque Baixo";
  return "Em Estoque";
}

const CATEGORIES = [
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
    description: "",
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

  const fetchItems = useCallback(async () => {
    const response = await api.get<ProductResponse[]>("");
    setItems(response.data.map(toInventoryItem));
  }, []);

  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

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
    const categories = new Set(items.map((i) => i.category)).size;
    const lowStockAlerts = items.filter((i) => i.quantity > 0 && i.quantity <= 5).length;
    const outOfStock = items.filter((i) => i.quantity === 0).length;
    return { totalItems, categories, lowStockAlerts, outOfStock };
  }, [items]);

  return { items, addItem, updateItem, deleteItem, adjustQuantity, stats, CATEGORIES };
}

export { CATEGORIES };
