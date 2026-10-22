import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { BD } from './sqlite';
import { DatabaseSync } from './sqlite';

// Cópias do banco com VACUUM INTO: geram um arquivo SQLite completo e consistente,
// mesmo com o servidor em funcionamento (o modo WAL permite leitura concorrente).

const carimbo = (d = new Date()) => d.toISOString().replace(/[-:]/g, '').replace('T', '-').replace('.', '').slice(0, 18);

export function criarBackup(db: BD, pasta: string, motivo = 'auto'): string {
  mkdirSync(pasta, { recursive: true });
  const nome = `estudo-${carimbo()}-${motivo.replace(/[^a-z0-9-]/gi, '')}.db`;
  const destino = resolve(pasta, nome);
  if (existsSync(destino)) unlinkSync(destino);
  db.prepare('VACUUM INTO ?').run(destino);
  return destino;
}

export interface InfoBackup {
  arquivo: string;
  tamanho: number;
  criadoEm: string;
}

export function listarBackups(pasta: string): InfoBackup[] {
  if (!existsSync(pasta)) return [];
  return readdirSync(pasta)
    .filter((f) => /^estudo-.*\.db$/.test(f))
    .map((f) => {
      const st = statSync(join(pasta, f));
      return { arquivo: join(pasta, f), tamanho: st.size, criadoEm: st.mtime.toISOString() };
    })
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
}

// Mantém as `manter` cópias automáticas mais recentes. Cópias feitas antes de importações
// e reinícios (motivo diferente de "auto") são guardadas por mais tempo: o dobro.
export function rotacionarBackups(pasta: string, manter: number): string[] {
  const removidos: string[] = [];
  const todos = listarBackups(pasta);
  const auto = todos.filter((b) => b.arquivo.endsWith('-auto.db'));
  const outros = todos.filter((b) => !b.arquivo.endsWith('-auto.db'));
  for (const b of [...auto.slice(manter), ...outros.slice(manter * 2)]) {
    unlinkSync(b.arquivo);
    removidos.push(b.arquivo);
  }
  return removidos;
}

// Confere se um arquivo é um banco desta aplicação antes de restaurá-lo.
export function conferirArquivoBanco(caminho: string): string | null {
  if (!existsSync(caminho)) return 'Arquivo não encontrado.';
  let db: BD | null = null;
  try {
    db = new DatabaseSync(caminho, { readOnly: true });
    const ok = db.prepare('PRAGMA integrity_check').get() as { integrity_check: string };
    if (ok.integrity_check !== 'ok') return `O arquivo está corrompido: ${ok.integrity_check}`;
    const t = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('schema_migracoes', 'usuarios', 'sessoes_estudo')").all();
    if (t.length < 3) return 'O arquivo não é um banco desta aplicação.';
    return null;
  } catch (e) {
    return `Não foi possível abrir o arquivo: ${(e as Error).message}`;
  } finally {
    db?.close();
  }
}
