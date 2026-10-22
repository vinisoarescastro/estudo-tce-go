import type { Disciplina, NucleoId, Sessao, Topico } from './types';
import { diffDias, inicioSemana, somarDias } from './util';

// Todas as somas de horas partem da lista de sessões. Cada sessão tem id único,
// então editar ou excluir uma sessão muda os totais na hora.

export interface FiltroSessoes {
  de?: string;
  ate?: string;
  disciplinaId?: string;
  nucleo?: NucleoId;
}

export function filtrarSessoes(sessoes: Sessao[], disciplinas: Disciplina[], f: FiltroSessoes): Sessao[] {
  const nuc = new Map(disciplinas.map((d) => [d.id, d.nucleo]));
  return sessoes.filter(
    (s) =>
      (!f.de || s.data >= f.de) &&
      (!f.ate || s.data <= f.ate) &&
      (!f.disciplinaId || s.disciplinaId === f.disciplinaId) &&
      (!f.nucleo || nuc.get(s.disciplinaId) === f.nucleo),
  );
}

export const somaMin = (ss: Sessao[]) => ss.reduce((a, s) => a + s.realizadoMin, 0);
export const somaPlanejado = (ss: Sessao[]) => ss.reduce((a, s) => a + s.planejadoMin, 0);

export function porChave<K extends string>(ss: Sessao[], chave: (s: Sessao) => K | null): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of ss) {
    const k = chave(s);
    if (k === null) continue;
    out[k] = (out[k] ?? 0) + s.realizadoMin;
  }
  return out;
}

export function porDisciplina(ss: Sessao[]) {
  return porChave(ss, (s) => s.disciplinaId);
}

export function porTopico(ss: Sessao[]) {
  return porChave(ss, (s) => s.topicoId);
}

export function porNucleo(ss: Sessao[], disciplinas: Disciplina[]): Record<NucleoId, number> {
  const nuc = new Map(disciplinas.map((d) => [d.id, d.nucleo]));
  const r = porChave(ss, (s) => nuc.get(s.disciplinaId) ?? null);
  return { CG: r.CG ?? 0, CE: r.CE ?? 0 };
}

export function dias(de: string, ate: string): string[] {
  const n = diffDias(de, ate);
  const out: string[] = [];
  for (let i = 0; i <= n; i++) out.push(somarDias(de, i));
  return out;
}

export function seriePorDia(ss: Sessao[], de: string, ate: string): { chave: string; min: number; planejado: number }[] {
  const m = new Map<string, { min: number; planejado: number }>();
  for (const s of ss) {
    const v = m.get(s.data) ?? { min: 0, planejado: 0 };
    v.min += s.realizadoMin;
    v.planejado += s.planejadoMin;
    m.set(s.data, v);
  }
  return dias(de, ate).map((d) => ({ chave: d, ...(m.get(d) ?? { min: 0, planejado: 0 }) }));
}

export function seriePorSemana(ss: Sessao[], de: string, ate: string): { chave: string; min: number; planejado: number }[] {
  const m = new Map<string, { min: number; planejado: number }>();
  for (const s of ss) {
    const k = inicioSemana(s.data);
    const v = m.get(k) ?? { min: 0, planejado: 0 };
    v.min += s.realizadoMin;
    v.planejado += s.planejadoMin;
    m.set(k, v);
  }
  const out: { chave: string; min: number; planejado: number }[] = [];
  for (let w = inicioSemana(de); w <= ate; w = somarDias(w, 7)) out.push({ chave: w, ...(m.get(w) ?? { min: 0, planejado: 0 }) });
  return out;
}

export function seriePorMes(ss: Sessao[], de: string, ate: string): { chave: string; min: number; planejado: number }[] {
  const m = new Map<string, { min: number; planejado: number }>();
  for (const s of ss) {
    const k = s.data.slice(0, 7);
    const v = m.get(k) ?? { min: 0, planejado: 0 };
    v.min += s.realizadoMin;
    v.planejado += s.planejadoMin;
    m.set(k, v);
  }
  const out: { chave: string; min: number; planejado: number }[] = [];
  for (let k = de.slice(0, 7); k <= ate.slice(0, 7); ) {
    out.push({ chave: k, ...(m.get(k) ?? { min: 0, planejado: 0 }) });
    const [y, mo] = k.split('-').map(Number);
    k = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`;
  }
  return out;
}

// Cumprimento das metas no período: dias que atingiram a meta diária e semanas (segunda a domingo)
// que atingiram a meta semanal. Só conta até hoje; a semana atual entra como "em andamento".
export function cumprimentoMetas(
  ss: Sessao[],
  de: string,
  ate: string,
  hoje: string,
  metaDiariaMin: number,
  metaSemanalMin: number,
): { dias: number; diasNaMeta: number; semanas: number; semanasNaMeta: number; semanaAtualMin: number } {
  const fim = ate < hoje ? ate : hoje;
  const porDia = new Map<string, number>();
  for (const s of ss) porDia.set(s.data, (porDia.get(s.data) ?? 0) + s.realizadoMin);
  let diasN = 0, diasOk = 0;
  if (de <= fim) for (const d of dias(de, fim)) {
    diasN++;
    if (metaDiariaMin > 0 && (porDia.get(d) ?? 0) >= metaDiariaMin) diasOk++;
  }
  let semN = 0, semOk = 0, semanaAtualMin = 0;
  const semHoje = inicioSemana(hoje);
  for (let w = inicioSemana(de); w <= fim; w = somarDias(w, 7)) {
    let tot = 0;
    for (let i = 0; i < 7; i++) tot += porDia.get(somarDias(w, i)) ?? 0;
    if (w === semHoje) { semanaAtualMin = tot; continue; }
    semN++;
    if (metaSemanalMin > 0 && tot >= metaSemanalMin) semOk++;
  }
  return { dias: diasN, diasNaMeta: diasOk, semanas: semN, semanasNaMeta: semOk, semanaAtualMin };
}

// Médias contam a partir do primeiro dia com estudo até hoje (dias sem estudo entram como zero).
export function medias(ss: Sessao[], hoje: string): { diaria: number; semanal: number; dias: number } {
  if (!ss.length) return { diaria: 0, semanal: 0, dias: 0 };
  const primeiro = ss.reduce((a, s) => (s.data < a ? s.data : a), ss[0].data);
  const n = Math.max(1, diffDias(primeiro, hoje) + 1);
  const tot = somaMin(ss.filter((s) => s.data <= hoje));
  return { diaria: tot / n, semanal: (tot / n) * 7, dias: n };
}

export function topicosSemSessao(topicos: Topico[], ss: Sessao[]): number {
  const com = new Set(ss.map((s) => s.topicoId));
  return topicos.filter((t) => !com.has(t.id)).length;
}
