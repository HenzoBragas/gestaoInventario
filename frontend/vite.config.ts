// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Alvo do proxy de API no modo dev. Por padrao aponta para o backend ao vivo (Render),
// para que `npm run dev` ja exiba os dados reais sem precisar subir o backend localmente.
// Para usar um backend local, defina VITE_PROXY_TARGET=http://localhost:8080 antes do dev.
const proxyTarget =
	process.env.VITE_PROXY_TARGET ?? "https://gestao-inventario-backend.onrender.com";

export default defineConfig({
	vite: {
		server: {
			port: 3000,
			strictPort: true,
			proxy: {
				"/api": {
					target: proxyTarget,
					changeOrigin: true,
					secure: false,
					rewrite: (path) => path.replace(/^\/api/, ""),
				},
			},
		},
	},
});
