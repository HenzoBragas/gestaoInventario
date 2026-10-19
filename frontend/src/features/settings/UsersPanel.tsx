import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Pencil, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ActiveBadge } from "@/components/common/Badges";
import { DataTable, type Column } from "@/components/common/DataTable";
import { Field } from "@/components/common/Field";
import { EmptyState, ErrorState } from "@/components/common/States";
import { Panel } from "@/features/settings/Panel";
import { keys, useApiMutation, useUsers } from "@/lib/api/hooks";
import { adminApi } from "@/lib/api/services";
import type { Role, User, UserInput } from "@/lib/api/types";
import { useAuth } from "@/lib/auth-provider";
import { ROLE_DESCRIPTION, ROLE_LABEL } from "@/lib/domain";
import { useFormatters } from "@/lib/format";
import { initials } from "@/lib/utils";

export function UsersPanel() {
  const { data, isLoading, isError, error, refetch } = useUsers(true);
  const { user: me } = useAuth();
  const f = useFormatters();
  const [form, setForm] = useState<{ open: boolean; user: User | null }>({ open: false, user: null });

  const columns: Column<User>[] = [
    {
      id: "name",
      header: "Usuário",
      cell: (u) => (
        <div className="flex items-center gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">{initials(u.name)}</span>
          <span className="min-w-0">
            <span className="block truncate font-medium">
              {u.name} {u.id === me?.id && <span className="text-xs font-normal text-muted-foreground">(você)</span>}
            </span>
            <span className="block truncate text-xs text-muted-foreground">{u.email ?? u.username}</span>
          </span>
        </div>
      ),
    },
    { id: "username", header: "Login", cell: (u) => <span className="font-mono text-xs">{u.username}</span> },
    { id: "role", header: "Perfil", cell: (u) => ROLE_LABEL[u.role] },
    { id: "status", header: "Status", cell: (u) => <ActiveBadge active={u.active} /> },
    { id: "lastLogin", header: "Último acesso", cell: (u) => <span className="text-xs text-muted-foreground">{u.lastLoginAt ? f.relative(u.lastLoginAt) : "Nunca"}</span> },
    {
      id: "actions",
      header: "Ações",
      align: "right",
      cell: (u) => (
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setForm({ open: true, user: u })} aria-label={`Editar ${u.name}`}>
          <Pencil />
        </Button>
      ),
    },
  ];

  return (
    <>
      <Panel title="Usuários" description="Contas com acesso ao sistema e seus perfis.">
        <div className="mb-4 flex justify-end">
          <Button onClick={() => setForm({ open: true, user: null })}>
            <Plus /> Novo usuário
          </Button>
        </div>
        <div className="rounded-lg border">
          {isError ? (
            <ErrorState error={error} onRetry={() => refetch()} />
          ) : (
            <DataTable caption="Usuários" columns={columns} rows={data ?? []} rowKey={(u) => u.id} loading={isLoading} empty={<EmptyState icon={Users} title="Nenhum usuário" />} />
          )}
        </div>
      </Panel>
      <UserFormDialog open={form.open} user={form.user} isSelf={form.user?.id === me?.id} onOpenChange={(open) => setForm((s) => ({ ...s, open }))} />
    </>
  );
}

const ROLES: Role[] = ["ADMIN", "MANAGER", "OPERATOR", "VIEWER"];

function UserFormDialog({ open, user, isSelf, onOpenChange }: { open: boolean; user: User | null; isSelf: boolean; onOpenChange: (open: boolean) => void }) {
  const editing = Boolean(user);
  const schema = z.object({
    username: z.string().trim().min(3, "Mínimo de 3 caracteres.").max(60).regex(/^[a-zA-Z0-9._-]+$/, "Use letras, números, ponto, hífen ou sublinhado."),
    name: z.string().trim().min(1, "Informe o nome.").max(120),
    email: z.string().trim().refine((v) => v === "" || z.string().email().safeParse(v).success, "Informe um e-mail válido."),
    role: z.enum(["ADMIN", "MANAGER", "OPERATOR", "VIEWER"]),
    active: z.boolean(),
    password: editing
      ? z.string().refine((v) => v === "" || (v.length >= 8 && v.length <= 72), "A senha deve ter entre 8 e 72 caracteres.")
      : z.string().min(8, "Defina uma senha inicial com ao menos 8 caracteres.").max(72),
  });
  type FormValues = z.infer<typeof schema>;
  const { register, control, handleSubmit, reset, setError, watch, formState } = useForm<FormValues>({ resolver: zodResolver(schema), mode: "onTouched" });
  const errors = formState.errors;

  useEffect(() => {
    if (open) reset({ username: user?.username ?? "", name: user?.name ?? "", email: user?.email ?? "", role: user?.role ?? "OPERATOR", active: user?.active ?? true, password: "" });
  }, [open, user, reset]);

  const save = useApiMutation((body: UserInput) => (user ? adminApi.updateUser(user.id, body) : adminApi.createUser(body)), {
    invalidate: [keys.users],
    silentFieldErrors: true,
    success: (u) => (editing ? `Usuário ${u.username} atualizado.` : `Usuário ${u.username} criado.`),
    onSuccess: () => onOpenChange(false),
  });

  const onSubmit = handleSubmit((v) =>
    save.mutate(
      { username: v.username.trim().toLowerCase(), name: v.name.trim(), email: v.email.trim() || null, role: v.role, active: v.active, password: v.password || undefined },
      {
        onError: (e) => {
          for (const [field, message] of Object.entries(e.fieldErrors)) {
            if (field in v) setError(field as keyof FormValues, { message });
          }
        },
      },
    ),
  );
  const role = watch("role");

  return (
    <Dialog open={open} onOpenChange={(next) => !save.isPending && onOpenChange(next)}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar usuário" : "Novo usuário"}</DialogTitle>
          <DialogDescription>{isSelf ? "Você não pode alterar o próprio perfil nem desativar a própria conta." : "O perfil define o que o usuário pode fazer."}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome" error={errors.name?.message} required>
              <Input disabled={save.isPending} {...register("name")} />
            </Field>
            <Field label="Login" error={errors.username?.message} required>
              <Input autoComplete="off" className="font-mono" disabled={save.isPending} {...register("username")} />
            </Field>
          </div>
          <Field label="E-mail" error={errors.email?.message} hint="Também pode ser usado para entrar.">
            <Input type="email" autoComplete="off" disabled={save.isPending} {...register("email")} />
          </Field>
          <Field id="user-role" label="Perfil de acesso" error={errors.role?.message} hint={role ? ROLE_DESCRIPTION[role] : undefined} required>
            <Controller control={control} name="role" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={save.isPending || isSelf}>
                <SelectTrigger id="user-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}
                </SelectContent>
              </Select>
            )} />
          </Field>
          <Field label={editing ? "Nova senha" : "Senha inicial"} error={errors.password?.message} hint={editing ? "Deixe em branco para manter a atual." : "Mínimo de 8 caracteres."} required={!editing}>
            <Input type="password" autoComplete="new-password" disabled={save.isPending} {...register("password")} />
          </Field>
          <Controller control={control} name="active" render={({ field }) => (
            <label className="flex items-center justify-between gap-4 rounded-lg border p-3 text-sm">
              <span>
                <span className="block font-medium">Conta ativa</span>
                <span className="text-[13px] text-muted-foreground">Contas inativas não conseguem entrar; sessões abertas são encerradas.</span>
              </span>
              <Switch checked={field.value} onCheckedChange={field.onChange} disabled={isSelf} aria-label="Conta ativa" />
            </label>
          )} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>Cancelar</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending && <Loader2 className="animate-spin" />} Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
