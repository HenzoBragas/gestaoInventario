import { useEffect, useMemo, useState } from "react";
import { Table2, PieChart as PieIcon, BarChart3 } from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { InventoryTable } from "@/components/inventory/InventoryTable";
import type { InventoryItem } from "@/lib/inventory-store";

type ViewMode = "table" | "pie" | "bar";

// Paleta vinda das variaveis de tema (se adapta ao claro/escuro automaticamente).
const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

interface InventoryViewsProps {
  items: InventoryItem[];
  categories: string[];
  onUpdate: (id: string, updates: Partial<InventoryItem>) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  onAdjust: (id: string, delta: number) => void | Promise<void>;
}

// Estilo do tooltip dos graficos, alinhado ao tema atual.
const tooltipStyle = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "0.5rem",
  color: "var(--popover-foreground)",
  fontSize: "0.8rem",
};

export function InventoryViews({
  items,
  categories,
  onUpdate,
  onDelete,
  onAdjust,
}: InventoryViewsProps) {
  const [view, setView] = useState<ViewMode>("table");

  // Recharts depende do DOM (ResponsiveContainer); so renderiza apos montar.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Quantidade total agrupada por categoria (para o gráfico de pizza).
  const byCategory = useMemo(() => {
    const totals = new Map<string, number>();
    for (const item of items) {
      totals.set(item.category, (totals.get(item.category) ?? 0) + item.quantity);
    }
    return Array.from(totals, ([name, value]) => ({ name, value })).filter(
      (entry) => entry.value > 0,
    );
  }, [items]);

  // Top 8 itens por quantidade (para o gráfico de barras).
  const topItems = useMemo(() => {
    return [...items]
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 8)
      .map((item) => ({
        name: item.name.length > 18 ? `${item.name.slice(0, 18)}…` : item.name,
        quantidade: item.quantity,
      }));
  }, [items]);

  return (
    <div className="space-y-4">
      {/* Controle de alternância de visualização */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {items.length} {items.length === 1 ? "produto" : "produtos"}
        </p>
        <ToggleGroup
          type="single"
          value={view}
          onValueChange={(value) => value && setView(value as ViewMode)}
          variant="outline"
          aria-label="Modo de visualização"
        >
          <ToggleGroupItem value="table" aria-label="Tabela" className="gap-2">
            <Table2 className="h-4 w-4" />
            <span className="hidden sm:inline">Tabela</span>
          </ToggleGroupItem>
          <ToggleGroupItem value="pie" aria-label="Gráfico de pizza" className="gap-2">
            <PieIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Pizza</span>
          </ToggleGroupItem>
          <ToggleGroupItem value="bar" aria-label="Gráfico de barras" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Barras</span>
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {view === "table" && (
        <InventoryTable
          items={items}
          categories={categories}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onAdjust={onAdjust}
        />
      )}

      {view === "pie" && (
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Quantidade por categoria</CardTitle>
          </CardHeader>
          <CardContent>
            {mounted && byCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height={360}>
                <PieChart>
                  <Pie
                    data={byCategory}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={120}
                    label={(entry) => `${entry.name} (${entry.value})`}
                  >
                    {byCategory.map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart />
            )}
          </CardContent>
        </Card>
      )}

      {view === "bar" && (
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Top produtos por quantidade</CardTitle>
          </CardHeader>
          <CardContent>
            {mounted && topItems.length > 0 ? (
              <ResponsiveContainer width="100%" height={360}>
                <BarChart data={topItems} margin={{ left: -16, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--accent)" }} />
                  <Bar dataKey="quantidade" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-[360px] items-center justify-center text-sm text-muted-foreground">
      Nenhum dado disponível para exibir.
    </div>
  );
}
