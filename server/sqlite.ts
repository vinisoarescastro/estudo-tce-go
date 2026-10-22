import { createRequire } from 'node:module';

// O SQLite embutido no Node (node:sqlite) dispensa dependências nativas e servidor de banco.
// É carregado via require porque o Vite, usado nos testes, remove o prefixo "node:" do import.
const require = createRequire(import.meta.url);
const sqlite = require('node:sqlite') as typeof import('node:sqlite');

export const DatabaseSync = sqlite.DatabaseSync;
export type BD = InstanceType<typeof sqlite.DatabaseSync>;
