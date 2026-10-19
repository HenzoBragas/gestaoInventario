import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FieldProps {
  label: string;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
  /**
   * Id do controle. Necessario quando o controle nao e o filho direto (ex.: Select dentro de
   * Controller): informe o mesmo id no SelectTrigger para o label ficar associado.
   */
  id?: string;
  children: ReactElement<Record<string, unknown>>;
}

/** Campo de formulario com label persistente e mensagens associadas ao controle. */
export function Field({ label, error, hint, required, className, id: explicitId, children }: FieldProps) {
  const generatedId = useId();
  const id = explicitId ?? generatedId;
  const messageId = `${id}-message`;
  const describedBy = error || hint ? messageId : undefined;
  // Controles nativos (Input, Textarea) recebem id e atributos ARIA automaticamente.
  const control =
    !explicitId && isValidElement(children)
      ? cloneElement(children, { id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })
      : children;

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className="text-[13px]">
        {label}
        {required && (
          <span className="ml-0.5 text-destructive" aria-hidden="true">
            *
          </span>
        )}
      </Label>
      {control}
      {error ? (
        <p id={messageId} className="flex items-start gap-1.5 text-[13px] text-destructive">
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-[13px] text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Agrupa campos em secoes nomeadas dentro de formularios longos. */
export function FormSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <div>
        <legend className="text-sm font-semibold">{title}</legend>
        {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
      </div>
      {children}
    </fieldset>
  );
}
