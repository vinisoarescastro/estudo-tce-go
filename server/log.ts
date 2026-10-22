// Logs em JSON, uma linha por evento, na saída padrão (journald, Docker e afins coletam daí).
// Nunca registre senhas, tokens ou o corpo das requisições.

const NIVEIS = { debug: 10, info: 20, aviso: 30, erro: 40 } as const;
export type Nivel = keyof typeof NIVEIS;

let minimo: Nivel = 'info';
let silencioso = false;

export function configurarLog(nivel: Nivel, silenciar = false): void {
  minimo = NIVEIS[nivel] ? nivel : 'info';
  silencioso = silenciar;
}

export function log(nivel: Nivel, msg: string, dados: Record<string, unknown> = {}): void {
  if (silencioso || NIVEIS[nivel] < NIVEIS[minimo]) return;
  const linha = JSON.stringify({ ts: new Date().toISOString(), nivel, msg, ...dados });
  (nivel === 'erro' ? process.stderr : process.stdout).write(linha + '\n');
}

export function logErro(msg: string, e: unknown, dados: Record<string, unknown> = {}): void {
  const err = e as Error;
  log('erro', msg, { ...dados, erro: err?.message ?? String(e), pilha: err?.stack?.split('\n').slice(0, 8).join(' | ') });
}
