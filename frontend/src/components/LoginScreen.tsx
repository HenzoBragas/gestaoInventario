import { useState, type FormEvent } from "react";
import { Lock, Package, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-provider";
import { ThemeToggle } from "@/components/ThemeToggle";

export function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = login(username, password);
    if (!ok) {
      setError("Usuário ou senha inválidos.");
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-sm border-none shadow-lg">
        <CardHeader className="flex flex-col items-center gap-3 pt-8 text-center">
          <div className="rounded-xl bg-primary p-3">
            <Package className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Gestão de Inventário</h1>
            <p className="text-sm text-muted-foreground">Faça login para continuar</p>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="username">Usuário</Label>
              <Input
                id="username"
                autoComplete="username"
                placeholder="inventario"
                value={username}
                onChange={(event) => {
                  setUsername(event.target.value);
                  setError(null);
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError(null);
                }}
              />
            </div>

            {error && (
              <p className="flex items-center gap-2 text-sm text-destructive">
                <Lock className="h-4 w-4" />
                {error}
              </p>
            )}

            <Button type="submit" className="w-full">
              <LogIn className="h-4 w-4" />
              Entrar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
