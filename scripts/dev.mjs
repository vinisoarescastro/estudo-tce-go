// Desenvolvimento: recompila e reinicia o servidor a cada mudança e sobe o Vite em paralelo.
// O Vite (http://localhost:5173) repassa /api ao servidor (http://127.0.0.1:3000).
import { spawn } from 'node:child_process';
import { observar } from './build-server.mjs';

let servidor = null;
const iniciar = () => {
  if (servidor) servidor.kill();
  servidor = spawn(process.execPath, ['--enable-source-maps', 'build/server.mjs'], { stdio: 'inherit', env: { ...process.env, NODE_ENV: 'development' } });
};

await observar(iniciar);
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js'], { stdio: 'inherit' });

const sair = () => {
  servidor?.kill();
  vite.kill();
  process.exit(0);
};
process.on('SIGINT', sair);
process.on('SIGTERM', sair);
