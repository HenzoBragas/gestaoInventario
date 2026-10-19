import { KeyRound, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type AccessHelpKind = "forgot-password" | "request-access";

const CONTENT: Record<AccessHelpKind, { icon: typeof KeyRound; title: string; description: string; body: string }> = {
  "forgot-password": {
    icon: KeyRound,
    title: "Recuperar senha",
    description: "A redefinição automática de senha ainda não está disponível nesta versão.",
    body: "Peça ao administrador do sistema para redefinir sua senha. Quando a autenticação estiver integrada ao backend, este fluxo enviará um link de redefinição para o seu e-mail.",
  },
  "request-access": {
    icon: UserPlus,
    title: "Solicitar acesso",
    description: "O cadastro de novas contas ainda não está disponível nesta versão.",
    body: "Fale com o administrador do sistema para receber suas credenciais. O autocadastro será habilitado quando a autenticação estiver integrada ao backend.",
  },
};

interface AccessHelpDialogProps {
  kind: AccessHelpKind;
  children: React.ReactNode;
}

/** Explica, sem simular, os fluxos de conta que ainda dependem do backend. */
export function AccessHelpDialog({ kind, children }: AccessHelpDialogProps) {
  const { icon: Icon, title, description, body } = CONTENT[kind];

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <span className="mb-2 grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
        <DialogFooter>
          <DialogClose asChild>
            <Button>Entendi</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
