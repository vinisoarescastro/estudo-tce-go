// Gera build/server.mjs e build/cli.mjs (servidor e administração) com o esbuild.
// O código de domínio (src/domain) e o seed.json entram no pacote; só módulos do Node ficam de fora.
import { build, context } from 'esbuild';

const opcoes = {
  entryPoints: { server: 'server/index.ts', cli: 'server/cli.ts' },
  outdir: 'build',
  outExtension: { '.js': '.mjs' },
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: true,
  logLevel: 'info',
  legalComments: 'none',
};

export async function observar(aoReconstruir) {
  const ctx = await context({
    ...opcoes,
    plugins: [{ name: 'avisar', setup: (b) => b.onEnd((r) => !r.errors.length && aoReconstruir()) }],
  });
  await ctx.watch();
  return ctx;
}

// Executado diretamente (npm run build:server); quando importado pelo dev.mjs, só exporta observar().
if (process.argv[1]?.endsWith('build-server.mjs')) await build(opcoes);
