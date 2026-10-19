// Mantem o backend do Render (plano gratuito) acordado: o servico "dorme" apos ~15 min
// sem requisicoes e a primeira chamada depois disso leva ~50 s. Roda a cada 10 minutos.
// Equivale a um job no cron-job.org, mas versionado junto com o projeto.
const BACKEND_URL = process.env.BACKEND_URL ?? "https://gestao-inventario-backend-522e.onrender.com";

export default async () => {
  const started = Date.now();
  try {
    const response = await fetch(`${BACKEND_URL}/health`, { signal: AbortSignal.timeout(25_000) });
    console.log(`keep-alive: HTTP ${response.status} em ${Date.now() - started} ms`);
  } catch (error) {
    console.error(`keep-alive: falhou apos ${Date.now() - started} ms`, error);
  }
};

export const config = {
  schedule: "*/10 * * * *",
};
