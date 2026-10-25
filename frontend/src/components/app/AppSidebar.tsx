import { Link, useRouterState } from "@tanstack/react-router";
import { BrandMark } from "@/components/login/BrandMark";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { NAV_GROUPS, SETTINGS_ITEM, visibleItems, type NavItem } from "@/components/app/navigation";
import { useDashboard, useSettings } from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth-provider";

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: dashboard } = useDashboard(30);
  const { data: settings } = useSettings();
  const alerts = dashboard ? dashboard.kpis.lowStock + dashboard.kpis.outOfStock : 0;
  const { role } = useAuth();

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="h-16 justify-center border-b border-sidebar-border px-3">
        <Link to="/dashboard" className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring">
          <BrandMark tone="light" className="[&>span:last-child]:group-data-[collapsible=icon]:hidden" />
        </Link>
      </SidebarHeader>

      <SidebarContent className="py-2">
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-[11px] uppercase tracking-[0.12em] text-sidebar-foreground/50">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleItems(group.items, role).map((item) => (
                  <NavLink
                    key={item.to}
                    item={item}
                    active={isActive(pathname, item.to)}
                    badge={item.to === "/inventory" && alerts > 0 ? alerts : undefined}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <NavLink item={SETTINGS_ITEM} active={isActive(pathname, SETTINGS_ITEM.to)} />
        </SidebarMenu>
        <p className="truncate px-2 pb-1 text-[11px] text-sidebar-foreground/45 group-data-[collapsible=icon]:hidden">
          {settings?.organizationName ?? "Gestão de Inventário"}
        </p>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function NavLink({ item, active, badge }: { item: NavItem; active: boolean; badge?: number }) {
  const { isMobile, setOpenMobile } = useSidebar();
  const Icon = item.icon;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={active}
        tooltip={item.label}
        className="h-9 text-sidebar-foreground/80 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground data-[active=true]:shadow-[inset_2px_0_0_var(--sidebar-primary)]"
      >
        <Link to={item.to} onClick={() => isMobile && setOpenMobile(false)} aria-current={active ? "page" : undefined}>
          <Icon aria-hidden="true" />
          <span>{item.label}</span>
        </Link>
      </SidebarMenuButton>
      {badge !== undefined && (
        <SidebarMenuBadge
          className="rounded-full bg-sidebar-primary/20 text-[11px] text-sidebar-primary"
          aria-label={`${badge} produtos com alerta de estoque`}
        >
          {badge > 99 ? "99+" : badge}
        </SidebarMenuBadge>
      )}
    </SidebarMenuItem>
  );
}

function isActive(pathname: string, to: string) {
  return pathname === to || pathname.startsWith(`${to}/`);
}
