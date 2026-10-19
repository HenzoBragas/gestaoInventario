import { useEffect, useState } from "react";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Bell, Building2, Check, History, KeyRound, Loader2, Lock, Minus, Monitor, Moon, Palette, Plus, Shield, Sun, UserRound, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Field } from "@/components/common/Field";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorState } from "@/components/common/States";
import { AuditPanel } from "@/features/settings/AuditPanel";
import { Panel } from "@/features/settings/Panel";
import { UsersPanel } from "@/features/settings/UsersPanel";
import { keys, useApiMutation, useSettings } from "@/lib/api/hooks";
import { adminApi, authApi } from "@/lib/api/services";
import type { Role, SettingsInput } from "@/lib/api/types";
import { useAuth } from "@/lib/auth-provider";
import { can, ROLE_DESCRIPTION, ROLE_LABEL } from "@/lib/domain";
import { createFormatters } from "@/lib/format";
import { useTheme, type Theme } from "@/lib/theme-provider";
import { cn } from "@/lib/utils";

const route = getRouteApi("/_app/settings");

export type SettingsTab = "organization" | "preferences" | "notifications" | "account" | "users" | "permissions" | "audit";

export function SettingsPage() {
  const { tab = "organization" } = route.useSearch();
  const navigate = useNavigate({ from: "/settings" });
  const { role } = useAuth();

  const tabs: { id: SettingsTab; label: string; icon: typeof Building2; visible: boolean }[] = [
    { id: "organization", label: "Organização", icon: Building2, visible: true },
    { id: "preferences", label: "Preferências", icon: Palette, visible: true },
    { id: "notifications", label: "Notificações", icon: Bell, visible: true },
    { id: "account", label: "Minha conta", icon: UserRound, visible: true },
    { id: "users", label: "Usuários", icon: Users, visible: can(role, "users:manage") },
    { id: "permissions", label: "Perfis e permissões", icon: Shield, visible: true },
    { id: "audit", label: "Auditoria", icon: History, visible: can(role, "audit:read") },
  ];
  const visibleTabs = tabs.filter((t) => t.visible);
  const active = visibleTabs.some((t) => t.id === tab) ? tab : "organization";

  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" description="Organização, preferências, conta, usuários e auditoria." />
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Seções de configuração" className="min-w-0">
          <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            {visibleTabs.map((t) => (
              <li key={t.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => navigate({ search: { tab: t.id }, replace: true })}
                  aria-current={active === t.id ? "page" : undefined}
                  className={cn(
                    "flex w-full items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active === t.id ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <t.icon className="h-4 w-4" aria-hidden="true" />
                  {t.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0">
          {active === "organization" && <OrganizationPanel />}
          {active === "preferences" && <PreferencesPanel />}
          {active === "notifications" && <NotificationsPanel />}
          {active === "account" && <AccountPanel />}
          {active === "users" && <UsersPanel />}
          {active === "permissions" && <PermissionsPanel />}
          {active === "audit" && <AuditPanel />}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ organizacao

const TIME_ZONES = ["America/Sao_Paulo", "America/Manaus", "America/Belem", "America/Fortaleza", "America/Recife", "America/Cuiaba", "America/Rio_Branco", "America/Noronha", "UTC", "America/New_York", "Europe/Lisbon"];

const orgSchema = z.object({
  organizationName: z.string().trim().min(1, "Informe o nome da organização.").max(120),
  taxId: z.string().trim().max(20, "Máximo de 20 caracteres."),
  currency: z.enum(["BRL", "USD", "EUR"]),
  locale: z.enum(["pt-BR", "en-US", "es-ES"]),
  timeZone: z.string().min(1),
  defaultMinStock: z.string().regex(/^\d+$/, "Informe um número inteiro (0 ou mais)."),
  units: z.array(z.string()).min(1, "Mantenha ao menos uma unidade."),
});
type OrgForm = z.infer<typeof orgSchema>;

function OrganizationPanel() {
  const { role } = useAuth();
  const editable = can(role, "settings:write");
  const { data, isLoading, isError, error, refetch } = useSettings();
  const { register, control, handleSubmit, reset, watch, setValue, formState } = useForm<OrgForm>({ resolver: zodResolver(orgSchema) });
  const [newUnit, setNewUnit] = useState("");

  useEffect(() => {
    if (data) reset({ ...data, taxId: data.taxId ?? "", defaultMinStock: String(data.defaultMinStock) });
  }, [data, reset]);

  const save = useApiMutation((body: SettingsInput) => adminApi.updateSettings(body), {
    invalidate: [keys.settings, keys.data],
    success: "Configurações da organização salvas.",
  });

  const units = watch("units") ?? [];
  // Antes do reset com os dados do servidor os campos ainda estao vazios: usa os valores salvos.
  const preview = createFormatters(
    watch("locale") || data?.locale || "pt-BR",
    watch("currency") || data?.currency || "BRL",
    watch("timeZone") || data?.timeZone || "America/Sao_Paulo",
  );

  if (isLoading) return <Skeleton className="h-96 w-full rounded-xl" />;
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;

  const addUnit = () => {
    const unit = newUnit.trim().toUpperCase();
    if (/^[A-Z0-9]{1,10}$/.test(unit) && !units.includes(unit)) setValue("units", [...units, unit], { shouldDirty: true });
    setNewUnit("");
  };

  return (
    <form
      onSubmit={handleSubmit((v) => save.mutate({ ...v, taxId: v.taxId.trim() || null, defaultMinStock: Number(v.defaultMinStock) }))}
      noValidate
    >
      <Panel
        title="Organização"
        description={editable ? "Dados usados em toda a aplicação e nas exportações." : "Somente administradores podem alterar estas configurações."}
        footer={
          editable && (
            <Button type="submit" disabled={save.isPending || !formState.isDirty}>
              {save.isPending && <Loader2 className="animate-spin" />} Salvar alterações
            </Button>
          )
        }
      >
        <fieldset disabled={!editable || save.isPending} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <Field label="Nome da organização" error={formState.errors.organizationName?.message} required>
              <Input {...register("organizationName")} />
            </Field>
            <Field label="CNPJ" error={formState.errors.taxId?.message}>
              <Input {...register("taxId")} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="org-currency" label="Moeda" required>
              <Controller control={control} name="currency" render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={!editable}>
                  <SelectTrigger id="org-currency"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BRL">Real (BRL)</SelectItem>
                    <SelectItem value="USD">Dólar (USD)</SelectItem>
                    <SelectItem value="EUR">Euro (EUR)</SelectItem>
                  </SelectContent>
                </Select>
              )} />
            </Field>
            <Field id="org-locale" label="Formato regional" required>
              <Controller control={control} name="locale" render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={!editable}>
                  <SelectTrigger id="org-locale"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                    <SelectItem value="en-US">English (US)</SelectItem>
                    <SelectItem value="es-ES">Español</SelectItem>
                  </SelectContent>
                </Select>
              )} />
            </Field>
            <Field id="org-tz" label="Fuso horário" required>
              <Controller control={control} name="timeZone" render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={!editable}>
                  <SelectTrigger id="org-tz"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIME_ZONES.map((tz) => <SelectItem key={tz} value={tz}>{tz.replace("_", " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              )} />
            </Field>
          </div>
          <p className="rounded-lg bg-surface-sunken px-3 py-2 text-[13px] text-muted-foreground">
            Prévia: <span className="tabular text-foreground">{preview.money(1234.5)}</span> · <span className="tabular text-foreground">{preview.number(1234567)}</span> ·{" "}
            <span className="text-foreground">{preview.dateTime(new Date().toISOString())}</span>
          </p>
          <Field label="Estoque mínimo padrão" error={formState.errors.defaultMinStock?.message} hint="Sugerido no cadastro de novos produtos. Cada produto pode ter o seu.">
            <Input type="number" min={0} className="max-w-40" {...register("defaultMinStock")} />
          </Field>
          <div className="space-y-2">
            <p className="text-[13px] font-medium">Unidades de medida</p>
            <ul className="flex flex-wrap gap-2" aria-label="Unidades cadastradas">
              {units.map((u) => (
                <li key={u} className="inline-flex items-center gap-1 rounded-md border bg-muted/50 py-0.5 pl-2 pr-1 font-mono text-xs">
                  {u}
                  {editable && (
                    <button type="button" onClick={() => setValue("units", units.filter((x) => x !== u), { shouldDirty: true })} disabled={units.length <= 1} className="rounded p-0.5 hover:bg-muted disabled:opacity-40" aria-label={`Remover unidade ${u}`}>
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {editable && (
              <div className="flex max-w-xs gap-2">
                <Input value={newUnit} onChange={(e) => setNewUnit(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addUnit(); } }} placeholder="Ex.: FD" maxLength={10} className="h-9 font-mono uppercase" aria-label="Nova unidade de medida" />
                <Button type="button" variant="outline" size="sm" className="h-9" onClick={addUnit}><Plus /> Adicionar</Button>
              </div>
            )}
            {formState.errors.units && <p className="text-[13px] text-destructive">{formState.errors.units.message}</p>}
          </div>
        </fieldset>
      </Panel>
    </form>
  );
}

// ------------------------------------------------------------------ preferencias

function PreferencesPanel() {
  const { theme, setTheme } = useTheme();
  const options: { value: Theme; label: string; description: string; icon: typeof Sun }[] = [
    { value: "light", label: "Claro", description: "Sempre claro", icon: Sun },
    { value: "dark", label: "Escuro", description: "Sempre escuro", icon: Moon },
    { value: "system", label: "Automático", description: "Claro das 6h às 18h", icon: Monitor },
  ];
  return (
    <Panel title="Preferências de exibição" description="Salvas neste navegador.">
      <p className="mb-3 text-[13px] font-medium" id="theme-label">Tema</p>
      <div role="radiogroup" aria-labelledby="theme-label" className="grid gap-3 sm:grid-cols-3">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={theme === o.value}
            onClick={() => setTheme(o.value)}
            className={cn("flex items-start gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", theme === o.value ? "border-primary bg-primary/5" : "hover:border-foreground/25")}
          >
            <o.icon className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <span>
              <span className="block text-sm font-medium">{o.label}</span>
              <span className="block text-xs text-muted-foreground">{o.description}</span>
            </span>
          </button>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Animações respeitam a configuração “reduzir movimento” do sistema operacional. Moeda, formato e fuso seguem as configurações da organização.
      </p>
    </Panel>
  );
}

// ------------------------------------------------------------------ notificacoes

function NotificationsPanel() {
  const { user, updateUser } = useAuth();
  const save = useApiMutation(authApi.updatePreferences, {
    invalidate: [keys.notifications],
    success: "Preferências de notificação salvas.",
    onSuccess: (u) => updateUser(u),
  });
  if (!user) return null;
  const items = [
    { key: "notifyOutOfStock" as const, title: "Produtos sem estoque", description: "Itens ativos que chegaram a saldo zero." },
    { key: "notifyLowStock" as const, title: "Estoque baixo", description: "Itens no limite ou abaixo do estoque mínimo." },
    { key: "notifyMovements" as const, title: "Movimentações de outros usuários", description: "Entradas, saídas, transferências e ajustes dos últimos 7 dias." },
  ];
  return (
    <Panel title="Notificações" description="Escolha o que aparece na central de notificações (salvo no seu perfil).">
      <ul className="divide-y rounded-lg border">
        {items.map((item) => (
          <li key={item.key} className="flex items-center justify-between gap-4 p-4">
            <label htmlFor={item.key} className="cursor-pointer">
              <span className="block text-sm font-medium">{item.title}</span>
              <span className="block text-[13px] text-muted-foreground">{item.description}</span>
            </label>
            <Switch
              id={item.key}
              checked={user[item.key]}
              disabled={save.isPending}
              onCheckedChange={(checked) =>
                save.mutate({ notifyLowStock: user.notifyLowStock, notifyOutOfStock: user.notifyOutOfStock, notifyMovements: user.notifyMovements, [item.key]: checked })
              }
            />
          </li>
        ))}
      </ul>
    </Panel>
  );
}

// ------------------------------------------------------------------ conta

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Informe a senha atual."),
    newPassword: z.string().min(8, "Use ao menos 8 caracteres.").max(72, "Máximo de 72 caracteres."),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ["confirm"], message: "As senhas não conferem." })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ["newPassword"], message: "A nova senha deve ser diferente da atual." });
type PasswordForm = z.infer<typeof passwordSchema>;

function AccountPanel() {
  const { user } = useAuth();
  const { register, handleSubmit, reset, setError, formState } = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema), mode: "onTouched" });
  const change = useApiMutation((v: PasswordForm) => authApi.changePassword({ currentPassword: v.currentPassword, newPassword: v.newPassword }), {
    invalidate: [],
    silentFieldErrors: true,
    success: "Senha alterada.",
    onSuccess: () => reset({ currentPassword: "", newPassword: "", confirm: "" }),
  });
  if (!user) return null;
  return (
    <div className="space-y-6">
      <Panel title="Minha conta">
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div><dt className="text-muted-foreground">Nome</dt><dd className="font-medium">{user.name}</dd></div>
          <div><dt className="text-muted-foreground">Login</dt><dd className="font-mono">{user.username}</dd></div>
          <div><dt className="text-muted-foreground">E-mail</dt><dd>{user.email ?? "—"}</dd></div>
          <div><dt className="text-muted-foreground">Perfil</dt><dd>{ROLE_LABEL[user.role]}</dd></div>
        </dl>
        <p className="mt-4 text-xs text-muted-foreground">Nome, e-mail e perfil são alterados por um administrador.</p>
      </Panel>
      <form onSubmit={handleSubmit((v) => change.mutate(v, { onError: (e) => e.fieldErrors.currentPassword && setError("currentPassword", { message: e.fieldErrors.currentPassword }) }))} noValidate>
        <Panel
          title="Alterar senha"
          footer={<Button type="submit" disabled={change.isPending}>{change.isPending ? <Loader2 className="animate-spin" /> : <KeyRound />} Alterar senha</Button>}
        >
          <fieldset disabled={change.isPending} className="grid max-w-md gap-4">
            <Field label="Senha atual" error={formState.errors.currentPassword?.message} required>
              <Input type="password" autoComplete="current-password" {...register("currentPassword")} />
            </Field>
            <Field label="Nova senha" error={formState.errors.newPassword?.message} hint="Mínimo de 8 caracteres." required>
              <Input type="password" autoComplete="new-password" {...register("newPassword")} />
            </Field>
            <Field label="Confirmar nova senha" error={formState.errors.confirm?.message} required>
              <Input type="password" autoComplete="new-password" {...register("confirm")} />
            </Field>
          </fieldset>
        </Panel>
      </form>
    </div>
  );
}

// ------------------------------------------------------------------ permissoes

const MATRIX: { label: string; minimum: Role }[] = [
  { label: "Consultar dashboard, inventário e relatórios", minimum: "VIEWER" },
  { label: "Exportar CSV", minimum: "VIEWER" },
  { label: "Registrar entradas, saídas e transferências", minimum: "OPERATOR" },
  { label: "Ajustes de inventário", minimum: "MANAGER" },
  { label: "Cadastrar e editar produtos, categorias, fornecedores e localizações", minimum: "MANAGER" },
  { label: "Consultar auditoria", minimum: "MANAGER" },
  { label: "Gerenciar usuários e configurações da organização", minimum: "ADMIN" },
];
const ROLES: Role[] = ["VIEWER", "OPERATOR", "MANAGER", "ADMIN"];
const RANK: Record<Role, number> = { VIEWER: 0, OPERATOR: 1, MANAGER: 2, ADMIN: 3 };

function PermissionsPanel() {
  return (
    <Panel title="Perfis e permissões" description="As permissões são verificadas no servidor em cada requisição; a interface apenas oculta o que o perfil não pode fazer.">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <caption className="sr-only">Matriz de permissões por perfil</caption>
          <thead className="bg-muted/50">
            <tr>
              <th scope="col" className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Capacidade</th>
              {ROLES.map((r) => <th key={r} scope="col" className="px-3 py-2.5 text-center text-xs font-medium text-muted-foreground">{ROLE_LABEL[r]}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y">
            {MATRIX.map((row) => (
              <tr key={row.label}>
                <th scope="row" className="px-3 py-2.5 text-left font-normal">{row.label}</th>
                {ROLES.map((r) => (
                  <td key={r} className="px-3 py-2.5 text-center">
                    {RANK[r] >= RANK[row.minimum] ? <Check className="mx-auto h-4 w-4 text-success" aria-label="Permitido" /> : <Minus className="mx-auto h-4 w-4 text-muted-foreground/50" aria-label="Não permitido" />}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {ROLES.map((r) => (
          <li key={r} className="flex items-start gap-2 text-[13px]">
            <Lock className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            <span><span className="font-medium">{ROLE_LABEL[r]}:</span> <span className="text-muted-foreground">{ROLE_DESCRIPTION[r]}</span></span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
