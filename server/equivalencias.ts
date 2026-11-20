import equivalenciasJson from '../src/data/equivalencias.json';
import type { BD } from './sqlite';
import { prep, transacao } from './db';

// Equivalências: pares de conteúdos de editais diferentes que tratam do mesmo assunto. Quando uma conta
// estuda os dois editais, o progresso de um conteúdo (situação, dominado, datas, revisões e anotações)
// vale também para o equivalente; a prioridade continua sendo de cada edital.
// A lista vem de src/data/equivalencias.json (scripts/equivalencias/, revisada pelo administrador).

export interface Par { a: string; b: string }
export const EQUIVALENCIAS: Par[] = (equivalenciasJson as { pares: Par[] }).pares;

// Equivalente de um conteúdo: o conteúdo do outro edital e o cargo dele.
export interface Equivalente { topicoId: string; cargoId: string }
export type MapaEquivalencias = Map<string, Equivalente[]>;

// Regrava a tabela se a lista mudou. Recusa pares com conteúdo desconhecido ou dos dois lados no mesmo edital.
export function sincronizarEquivalencias(db: BD, pares: Par[] = EQUIVALENCIAS): boolean {
  const cargo = (id: string) => (prep(db, 'SELECT d.cargo_id FROM topicos t JOIN disciplinas d ON d.id = t.disciplina_id WHERE t.id = ?').get(id) as { cargo_id: string } | undefined)?.cargo_id;
  const novos = new Set<string>();
  for (const p of pares) {
    const ca = cargo(p.a);
    const cb = cargo(p.b);
    if (!ca || !cb) throw new Error(`Equivalência com conteúdo desconhecido: ${p.a} e ${p.b}.`);
    if (ca === cb) throw new Error(`Equivalência entre conteúdos do mesmo edital (${ca}): ${p.a} e ${p.b}.`);
    novos.add(p.a < p.b ? `${p.a}|${p.b}` : `${p.b}|${p.a}`);
  }
  const atuais = new Set((prep(db, 'SELECT topico_a, topico_b FROM equivalencias').all() as { topico_a: string; topico_b: string }[]).map((r) => `${r.topico_a}|${r.topico_b}`));
  if (atuais.size === novos.size && [...novos].every((k) => atuais.has(k))) return false;
  transacao(db, () => {
    prep(db, 'DELETE FROM equivalencias').run();
    const ins = prep(db, 'INSERT INTO equivalencias (topico_a, topico_b) VALUES (?, ?)');
    for (const k of novos) {
      const [a, b] = k.split('|');
      ins.run(a, b);
    }
  });
  return true;
}

// Mapa de cada conteúdo para os seus equivalentes (nos dois sentidos), com o cargo de cada um.
export function lerEquivalencias(db: BD): MapaEquivalencias {
  const linhas = prep(db, `SELECT e.topico_a, da.cargo_id AS cargo_a, e.topico_b, db.cargo_id AS cargo_b FROM equivalencias e
    JOIN topicos ta ON ta.id = e.topico_a JOIN disciplinas da ON da.id = ta.disciplina_id
    JOIN topicos tb ON tb.id = e.topico_b JOIN disciplinas db ON db.id = tb.disciplina_id
    ORDER BY e.topico_a, e.topico_b`).all() as { topico_a: string; cargo_a: string; topico_b: string; cargo_b: string }[];
  const m: MapaEquivalencias = new Map();
  const add = (de: string, eq: Equivalente) => {
    const l = m.get(de);
    if (l) l.push(eq);
    else m.set(de, [eq]);
  };
  for (const r of linhas) {
    add(r.topico_a, { topicoId: r.topico_b, cargoId: r.cargo_b });
    add(r.topico_b, { topicoId: r.topico_a, cargoId: r.cargo_a });
  }
  return m;
}
