import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const API = process.env.API_URL ?? 'http://127.0.0.1:3000';

// O frontend é gerado em build/web e servido pelo servidor Node (server/), que também
// expõe a API em /api. Em desenvolvimento, o Vite repassa /api e o edital ao servidor.
// A pasta dist/ guarda o app antigo (arquivo único, dados no navegador) e não é mais gerada.
export default defineConfig({
  plugins: [react()],
  build: { outDir: 'build/web', emptyOutDir: true, sourcemap: false },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: API, changeOrigin: false },
      '/edital.pdf': { target: API, changeOrigin: false },
    },
  },
  test: { globals: true, environment: 'node', include: ['src/**/*.test.ts', 'server/**/*.test.ts'] },
});
