// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import netlify from "@netlify/vite-plugin-tanstack-start";
import type { ProxyOptions } from "vite";

// No build do Netlify (NETLIFY=true e definido automaticamente) trocamos o alvo de
// Cloudflare para Netlify Functions. Fora dele (Docker/Render) o build segue igual.
const isNetlify = process.env.NETLIFY === "true";

// Alvo do proxy de API no modo dev. Por padrao aponta para o backend ao vivo (Render, o
// mesmo do netlify.toml), para que `npm run dev` ja exiba os dados reais sem subir o backend.
// Para usar um backend local, defina VITE_PROXY_TARGET=http://localhost:8080 antes do dev.
const proxyTarget =
	process.env.VITE_PROXY_TARGET ?? "https://gestao-inventario-backend-522e.onrender.com";

export default defineConfig({
	...(isNetlify ? { cloudflare: false as const, plugins: [netlify()] } : {}),
	vite: {
		server: {
			port: 3000,
			strictPort: true,
			proxy: {
				"/api": {
					target: proxyTarget,
					changeOrigin: true,
					secure: false,
					rewrite: (path: string) => path.replace(/^\/api/, ""),
					// Para o navegador a API e mesma origem (/api); sem o Origin, o CORS do backend nao
					// barra o dev server em portas fora da lista (ex.: um segundo `vite dev` na 3200).
					configure: (proxy: Parameters<NonNullable<ProxyOptions["configure"]>>[0]) => {
						proxy.on("proxyReq", (req) => req.removeHeader("origin"));
					},
				},
			},
		},
	},
});
