import { z } from "zod";

// Aceita e-mail (para a futura integracao com o backend) ou nome de usuario
// (o acesso de demonstracao atual usa o usuario "inventario").
const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{3,}$/;

export const loginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, "Informe seu e-mail ou usuário.")
    .refine(
      (value) =>
        value.includes("@") ? z.string().email().safeParse(value).success : USERNAME_PATTERN.test(value),
      (value) => ({
        message: value.includes("@")
          ? "Digite um e-mail válido, como nome@empresa.com."
          : "Use ao menos 3 caracteres: letras, números, ponto, hífen ou sublinhado.",
      }),
    ),
  password: z
    .string()
    .min(1, "Informe sua senha.")
    .min(6, "A senha deve ter ao menos 6 caracteres."),
  remember: z.boolean(),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
