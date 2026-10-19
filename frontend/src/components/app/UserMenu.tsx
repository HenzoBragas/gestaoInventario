import { useNavigate } from "@tanstack/react-router";
import { KeyRound, LogOut, Monitor, Moon, Sun, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth-provider";
import { ROLE_LABEL } from "@/lib/domain";
import { useTheme, type Theme } from "@/lib/theme-provider";
import { initials } from "@/lib/utils";

export function UserMenu() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 rounded-full pl-1 pr-2" aria-label={`Menu do usuário ${user.name}`}>
          <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
            {initials(user.name)}
          </span>
          <span className="hidden text-left leading-tight lg:block">
            <span className="block max-w-32 truncate text-[13px] font-medium">{user.name}</span>
            <span className="block text-[11px] text-muted-foreground">{ROLE_LABEL[user.role]}</span>
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email ?? user.username}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate({ to: "/settings", search: { tab: "account" } as never })}>
          <UserRound /> Minha conta
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate({ to: "/settings", search: { tab: "account" } as never })}>
          <KeyRound /> Alterar senha
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Sun /> Tema
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as Theme)}>
              <DropdownMenuRadioItem value="light" className="gap-2">
                <Sun className="h-4 w-4" /> Claro
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark" className="gap-2">
                <Moon className="h-4 w-4" /> Escuro
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system" className="gap-2">
                <Monitor className="h-4 w-4" /> Sistema (horário)
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => logout()} className="text-destructive focus:text-destructive">
          <LogOut /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
