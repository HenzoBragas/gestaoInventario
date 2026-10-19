import {
  ArrowLeftRight,
  BarChart3,
  Boxes,
  FolderTree,
  LayoutDashboard,
  MapPin,
  Package,
  Settings,
  Truck,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Palavras extras para a busca global. */
  keywords?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Visão geral",
    items: [{ label: "Dashboard", to: "/dashboard", icon: LayoutDashboard, keywords: "início indicadores resumo" }],
  },
  {
    label: "Estoque",
    items: [
      { label: "Inventário", to: "/inventory", icon: Boxes, keywords: "saldos posição estoque" },
      { label: "Movimentações", to: "/movements", icon: ArrowLeftRight, keywords: "entradas saídas ajustes transferências histórico" },
      { label: "Produtos", to: "/products", icon: Package, keywords: "cadastro sku catálogo" },
    ],
  },
  {
    label: "Cadastros",
    items: [
      { label: "Categorias", to: "/categories", icon: FolderTree },
      { label: "Fornecedores", to: "/suppliers", icon: Truck },
      { label: "Localizações", to: "/locations", icon: MapPin, keywords: "armazéns depósitos lojas" },
    ],
  },
  {
    label: "Análise",
    items: [{ label: "Relatórios", to: "/reports", icon: BarChart3, keywords: "exportar csv valor" }],
  },
];

export const SETTINGS_ITEM: NavItem = { label: "Configurações", to: "/settings", icon: Settings, keywords: "usuários permissões conta preferências" };

export const ALL_NAV_ITEMS: NavItem[] = [...NAV_GROUPS.flatMap((g) => g.items), SETTINGS_ITEM];

export function navItemFor(pathname: string): NavItem | undefined {
  return ALL_NAV_ITEMS.find((item) => pathname === item.to || pathname.startsWith(`${item.to}/`));
}
