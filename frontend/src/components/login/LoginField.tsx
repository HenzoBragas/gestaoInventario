import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { AlertCircle, Check, type LucideIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface LoginFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  id: string;
  label: string;
  icon: LucideIcon;
  error?: string;
  /** Campo ja validado com sucesso (mostra o check). */
  valid?: boolean;
  /** Acao a direita do campo (ex.: mostrar senha). Substitui o icone de validacao. */
  trailing?: ReactNode;
  /** Dica exibida abaixo do campo quando nao ha erro. */
  hint?: ReactNode;
}

/** Campo com label persistente, icone, estados de validacao e mensagens associadas. */
export const LoginField = forwardRef<HTMLInputElement, LoginFieldProps>(function LoginField(
  { id, label, icon: Icon, error, valid, trailing, hint, className, ...inputProps },
  ref,
) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-[13px] font-medium">
        {label}
      </Label>
      <div className="group relative">
        <Icon
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors duration-200",
            "group-focus-within:text-primary",
            error && "text-destructive group-focus-within:text-destructive",
          )}
        />
        <Input
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            "h-12 rounded-xl bg-background pl-10 pr-11 text-[15px] shadow-none transition-[border-color,box-shadow,background-color] duration-200 md:text-[15px]",
            "hover:border-foreground/25",
            "focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15",
            error &&
              "border-destructive hover:border-destructive focus-visible:border-destructive focus-visible:ring-destructive/15",
            className,
          )}
          {...inputProps}
        />
        <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center">
          {trailing ??
            (valid && !error ? (
              <span className="login-message grid h-9 w-9 place-items-center text-success" aria-hidden="true">
                <Check className="h-4 w-4" />
              </span>
            ) : null)}
        </div>
      </div>
      {error ? (
        <p id={errorId} className="login-message flex items-start gap-1.5 text-[13px] text-destructive">
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : hint ? (
        <div id={hintId} className="text-[13px] text-muted-foreground">
          {hint}
        </div>
      ) : null}
    </div>
  );
});
