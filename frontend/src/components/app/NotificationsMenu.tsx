import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeftRight, Bell, CheckCheck, CircleSlash, Settings2, TriangleAlert, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotifications } from "@/lib/api/hooks";
import type { AppNotification } from "@/lib/api/types";
import { useAuth } from "@/lib/auth-provider";
import { useFormatters } from "@/lib/format";
import { cn } from "@/lib/utils";

const ICONS: Record<AppNotification["type"], { icon: LucideIcon; className: string }> = {
  OUT_OF_STOCK: { icon: CircleSlash, className: "bg-destructive/10 text-destructive" },
  LOW_STOCK: { icon: TriangleAlert, className: "bg-warning/15 text-warning-foreground dark:text-warning" },
  MOVEMENT: { icon: ArrowLeftRight, className: "bg-primary/10 text-primary" },
};

/** "Lido ate" e uma preferencia de interface por usuario e navegador. */
function useSeenMarker(username: string | undefined) {
  const key = `inventario:notifications-seen:${username ?? ""}`;
  const [seenAt, setSeenAt] = useState<number>(0);
  useEffect(() => {
    try {
      setSeenAt(Number(window.localStorage.getItem(key) ?? 0));
    } catch {
      setSeenAt(0);
    }
  }, [key]);
  const markAll = () => {
    const now = Date.now();
    setSeenAt(now);
    try {
      window.localStorage.setItem(key, String(now));
    } catch {
      // Preferencia so em memoria.
    }
  };
  return { seenAt, markAll };
}

export function NotificationsMenu() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const f = useFormatters();
  const { data, isLoading, isError, refetch } = useNotifications();
  const { seenAt, markAll } = useSeenMarker(user?.username);
  const [open, setOpen] = useState(false);

  const unread = useMemo(() => (data ?? []).filter((n) => new Date(n.createdAt).getTime() > seenAt).length, [data, seenAt]);

  function go(link: string) {
    setOpen(false);
    const [path, query] = link.split("?");
    const search = Object.fromEntries(new URLSearchParams(query ?? ""));
    if (search.movementId) {
      void navigate({ to: path, search: { movementId: Number(search.movementId) } as never });
    } else {
      void navigate({ to: path });
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={unread ? `Notificações: ${unread} não lidas` : "Notificações"}
        >
          <Bell />
          {unread > 0 && (
            <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(380px,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Notificações</p>
            <p className="text-xs text-muted-foreground">{unread ? `${unread} não lida(s)` : "Tudo em dia"}</p>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={markAll} disabled={!unread}>
              <CheckCheck /> Marcar como lidas
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="Preferências de notificação"
              onClick={() => {
                setOpen(false);
                void navigate({ to: "/settings", search: { tab: "notifications" } as never });
              }}
            >
              <Settings2 />
            </Button>
          </div>
        </div>
        <ScrollArea className="max-h-[420px]">
          {isLoading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : isError ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Não foi possível carregar.{" "}
              <button className="font-medium text-primary hover:underline" onClick={() => refetch()}>
                Tentar novamente
              </button>
            </div>
          ) : !data?.length ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Nenhuma notificação no momento.</p>
          ) : (
            <ul className="divide-y">
              {data.map((n) => {
                const { icon: Icon, className } = ICONS[n.type];
                const isUnread = new Date(n.createdAt).getTime() > seenAt;
                return (
                  <li key={n.id}>
                    <button
                      onClick={() => go(n.link)}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-none"
                    >
                      <span className={cn("mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg", className)}>
                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className={cn("line-clamp-1 text-[13px]", isUnread ? "font-semibold" : "font-medium")}>{n.title}</span>
                          {isUnread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Não lida" />}
                        </span>
                        <span className="line-clamp-2 text-xs text-muted-foreground">{n.description}</span>
                        <span className="mt-0.5 block text-[11px] text-muted-foreground/80">{f.relative(n.createdAt)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
