import { Package, Layers, AlertTriangle, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface StatsCardsProps {
  totalItems: number;
  categories: number;
  lowStockAlerts: number;
  outOfStock: number;
}

const cards = [
  { key: "totalItems", label: "Total de Itens", icon: Package, color: "text-primary" },
  { key: "categories", label: "Categorias Ativas", icon: Layers, color: "text-success" },
  { key: "lowStockAlerts", label: "Estoque Baixo", icon: AlertTriangle, color: "text-warning-foreground" },
  { key: "outOfStock", label: "Sem Estoque", icon: XCircle, color: "text-destructive" },
] as const;

export function StatsCards({ totalItems, categories, lowStockAlerts, outOfStock }: StatsCardsProps) {
  const values = { totalItems, categories, lowStockAlerts, outOfStock };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map(({ key, label, icon: Icon, color }) => (
        <Card key={key} className="border-none shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className={`rounded-lg bg-secondary p-3 ${color}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="text-2xl font-bold tracking-tight">{values[key]}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
