import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, AtSign, Eye, EyeOff, Info, Loader2, Lock, ShieldAlert } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { AccessHelpDialog } from "@/components/login/AccessHelpDialog";
import { LoginField } from "@/components/login/LoginField";
import { DEMO_CREDENTIALS, useAuth } from "@/lib/auth-provider";
import { loginSchema, type LoginFormValues } from "@/lib/login-schema";
import { cn } from "@/lib/utils";
import { replayAnimation, stagger } from "@/components/login/motion";

type SubmitStatus = "idle" | "loading" | "success" | "error";

// Tempo da animacao de sucesso antes de abrir o painel.
const SUCCESS_HOLD_MS = 750;

export function LoginForm() {
  const { login } = useAuth();
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [serverError, setServerError] = useState<string | null>(null);

  // Aviso quando a sessao anterior expirou ou foi encerrada pelo servidor.
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem("inventario:expired")) {
        window.sessionStorage.removeItem("inventario:expired");
        setServerError("Sua sessão expirou. Entre novamente para continuar.");
      }
    } catch {
      // Sem aviso.
    }
  }, []);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const commitTimer = useRef<number | undefined>(undefined);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    setFocus,
    resetField,
    formState: { errors, touchedFields },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: "onTouched",
    defaultValues: { identifier: "", password: "", remember: true },
  });

  useEffect(() => () => window.clearTimeout(commitTimer.current), []);

  const isBusy = status === "loading" || status === "success";

  const onSubmit = handleSubmit(async (values) => {
    if (isBusy) return; // Impede envios duplicados.
    setStatus("loading");
    setServerError(null);

    const result = await login(values);

    if (result.ok) {
      setStatus("success");
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      commitTimer.current = window.setTimeout(result.commit, reduceMotion ? 0 : SUCCESS_HOLD_MS);
      return;
    }

    setStatus("error");
    // Mensagens ja vem do servidor em portugues (credenciais, bloqueio por tentativas, usuario inativo).
    setServerError(result.message);
    replayAnimation(formRef.current, "login-shake");
    resetField("password");
  });

  // Apos uma falha, devolve o foco a senha (so depois do re-render que reabilita o campo).
  useEffect(() => {
    if (status === "error") setFocus("password");
  }, [status, setFocus]);

  // Ao editar depois de um erro, volta o botao ao estado normal.
  const clearServerError = () => {
    if (status === "error") {
      setStatus("idle");
      setServerError(null);
    }
  };

  const detectCapsLock = (event: KeyboardEvent<HTMLInputElement>) => {
    setCapsLockOn(event.getModifierState("CapsLock"));
  };

  const fillDemoCredentials = () => {
    const options = { shouldValidate: true, shouldDirty: true, shouldTouch: true } as const;
    setValue("identifier", DEMO_CREDENTIALS.username, options);
    setValue("password", DEMO_CREDENTIALS.password, options);
    clearServerError();
    setFocus("password");
  };

  const identifierField = register("identifier", { onChange: clearServerError });
  const passwordField = register("password", { onChange: clearServerError });

  return (
    <div className="w-full">
      <header className="login-enter" style={stagger(1)}>
        <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight sm:text-3xl">
          Bem-vindo de volta
        </h1>
        <p className="mt-2 text-[15px] text-muted-foreground">
          Entre com suas credenciais para acessar o painel de estoque.
        </p>
      </header>

      <DemoAccessNotice onFill={fillDemoCredentials} disabled={isBusy} />

      <div className="login-enter mt-6 grid grid-cols-2 gap-3" style={stagger(3)}>
        <SocialButton provider="google" />
        <SocialButton provider="microsoft" />
      </div>

      <div
        className="login-enter my-6 flex items-center gap-3 text-xs text-muted-foreground"
        style={stagger(4)}
      >
        <span className="h-px flex-1 bg-border" />
        ou entre com seu usuário
        <span className="h-px flex-1 bg-border" />
      </div>

      <form
        ref={formRef}
        onSubmit={onSubmit}
        noValidate
        aria-busy={isBusy}
        className="space-y-5"
      >
        <div className="login-enter" style={stagger(5)}>
          <LoginField
            id="identifier"
            label="E-mail ou usuário"
            icon={AtSign}
            type="text"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="nome@empresa.com"
            disabled={isBusy}
            error={errors.identifier?.message}
            valid={Boolean(touchedFields.identifier) && !errors.identifier}
            {...identifierField}
          />
        </div>

        <div className="login-enter" style={stagger(6)}>
          <LoginField
            id="password"
            label="Senha"
            icon={Lock}
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Digite sua senha"
            disabled={isBusy}
            error={errors.password?.message}
            onKeyDown={detectCapsLock}
            onKeyUp={detectCapsLock}
            hint={
              capsLockOn ? (
                <span className="login-message inline-flex items-center gap-1.5 text-warning-foreground dark:text-warning">
                  <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                  Caps Lock está ativado.
                </span>
              ) : undefined
            }
            trailing={
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                aria-pressed={showPassword}
                aria-controls="password"
                disabled={isBusy}
                className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }
            {...passwordField}
          />
        </div>

        <div
          className="login-enter flex items-center justify-between gap-4"
          style={stagger(7)}
        >
          <div className="flex items-center gap-2.5">
            <Controller
              control={control}
              name="remember"
              render={({ field }) => (
                <Checkbox
                  id="remember"
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                  disabled={isBusy}
                  className="h-[18px] w-[18px] rounded-[5px] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                />
              )}
            />
            <Label htmlFor="remember" className="cursor-pointer text-sm font-normal text-muted-foreground">
              Lembrar de mim
            </Label>
          </div>
          <AccessHelpDialog kind="forgot-password">
            <button
              type="button"
              className="rounded-sm text-sm font-medium text-primary underline-offset-4 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Esqueci minha senha
            </button>
          </AccessHelpDialog>
        </div>

        {serverError && (
          <div
            role="alert"
            className="login-message flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/[0.06] px-3.5 py-3 text-sm text-destructive"
          >
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {serverError}
          </div>
        )}

        <div className="login-enter" style={stagger(8)}>
          <SubmitButton status={status} />
        </div>

        {/* Anuncia o progresso para leitores de tela. */}
        <p className="sr-only" aria-live="polite">
          {status === "loading" ? "Verificando credenciais." : status === "success" ? "Acesso liberado. Abrindo o painel." : ""}
        </p>
      </form>

      <p
        className="login-enter mt-8 text-center text-sm text-muted-foreground"
        style={stagger(9)}
      >
        Ainda não tem conta?{" "}
        <AccessHelpDialog kind="request-access">
          <button
            type="button"
            className="rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Solicitar acesso
          </button>
        </AccessHelpDialog>
      </p>
    </div>
  );
}

function SubmitButton({ status }: { status: SubmitStatus }) {
  const isBusy = status === "loading" || status === "success";

  return (
    <button
      type="submit"
      disabled={isBusy}
      className={cn(
        "login-sheen group inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl px-5 text-[15px] font-semibold shadow-sm",
        "transition-[background-color,box-shadow,transform] duration-200 ease-out",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30",
        "active:scale-[0.99] disabled:cursor-default",
        status === "success"
          ? "bg-success text-success-foreground"
          : "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-[0_8px_24px_-8px_var(--color-primary)]",
      )}
    >
      {status === "loading" ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Verificando…
        </>
      ) : status === "success" ? (
        <>
          <svg viewBox="0 0 24 24" className="login-check h-5 w-5" aria-hidden="true">
            <path d="M5 12.5 10 17 19 7.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Acesso liberado
        </>
      ) : (
        <>
          Entrar
          <ArrowRight
            className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </>
      )}
    </button>
  );
}

function DemoAccessNotice({ onFill, disabled }: { onFill: () => void; disabled: boolean }) {
  return (
    <aside
      aria-label="Acesso de demonstração"
      className="login-enter mt-6 flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/[0.05] px-3.5 py-3"
      style={stagger(2)}
    >
      <Info className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-[13px] leading-snug text-muted-foreground">
        <span className="font-medium text-foreground">Ambiente de demonstração.</span> Usuário{" "}
        <code className="font-mono text-foreground">{DEMO_CREDENTIALS.username}</code> · senha{" "}
        <code className="font-mono text-foreground">{DEMO_CREDENTIALS.password}</code>
      </p>
      <button
        type="button"
        onClick={onFill}
        disabled={disabled}
        className="shrink-0 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        Preencher
      </button>
    </aside>
  );
}

const PROVIDERS = {
  google: {
    label: "Google",
    logo: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path fill="#4285F4" d="M22.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h5.9a5.05 5.05 0 0 1-2.2 3.3v2.75h3.55c2.08-1.92 3.25-4.74 3.25-8.08Z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.75c-.98.66-2.24 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
        <path fill="#FBBC05" d="M5.84 14.12a6.6 6.6 0 0 1 0-4.24V7.04H2.18a11 11 0 0 0 0 9.92l3.66-2.84Z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.2 1.64l3.15-3.15A10.96 10.96 0 0 0 12 1 11 11 0 0 0 2.18 7.04l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" />
      </svg>
    ),
  },
  microsoft: {
    label: "Microsoft",
    logo: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path fill="#F25022" d="M2 2h9.5v9.5H2z" />
        <path fill="#7FBA00" d="M12.5 2H22v9.5h-9.5z" />
        <path fill="#00A4EF" d="M2 12.5h9.5V22H2z" />
        <path fill="#FFB900" d="M12.5 12.5H22V22h-9.5z" />
      </svg>
    ),
  },
} as const;

/** Login social ainda nao integrado: exibido desabilitado e identificado como "em breve". */
function SocialButton({ provider }: { provider: keyof typeof PROVIDERS }) {
  const { label, logo } = PROVIDERS[provider];
  return (
    <button
      type="button"
      disabled
      aria-label={`Entrar com ${label} (em breve)`}
      title="Login social em breve"
      className="relative inline-flex h-11 items-center justify-center gap-2 rounded-xl border glass-subtle text-sm font-medium text-foreground/70 disabled:cursor-not-allowed"
    >
      <span className="opacity-60 grayscale-[35%]">{logo}</span>
      {label}
      <span className="absolute -top-2 right-2 rounded-full border bg-background px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Em breve
      </span>
    </button>
  );
}
