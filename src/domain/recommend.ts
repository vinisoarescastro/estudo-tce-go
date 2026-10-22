import type { Dependencia, Disciplina, Prioridade, Topico, UserData } from './types';
import { PRIORIDADES } from './types';
import { estadoDe, isConcluido } from './progress';
import { cadeiaObrigatoria, pendentes } from './deps';
import { ativos, prioridadeTopico, proximoItem } from './cycle';
import { revisoesDevidas } from './revisions';
import { somarDias } from './util';

export interface Recomendacao {
  topico: Topico;
  disciplina: Disciplina;
  tipo: 'ciclo' | 'prerequisito' | 'revisao' | 'equilibrio';
  motivos: string[];
}

const rank = (p: Prioridade) => PRIORIDADES.indexOf(p);

// Ordem de estudo dentro de uma disciplina: em andamento primeiro, depois prioridade, depois a ordem do edital.
export function candidatos(topicos: Topico[], user: UserData, disciplinaId: string): Topico[] {
  return topicos
    .filter((t) => t.disciplinaId === disciplinaId && !isConcluido(estadoDe(user, t.id).status))
    .sort((a, b) => {
      const ea = estadoDe(user, a.id).status === 'em_andamento' ? 0 : 1;
      const eb = estadoDe(user, b.id).status === 'em_andamento' ? 0 : 1;
      return ea - eb || rank(prioridadeTopico(a, user)) - rank(prioridadeTopico(b, user)) || a.numero - b.numero;
    });
}

// Próximo tópico de uma disciplina, respeitando pré-requisitos obrigatórios:
// se o mais prioritário depende de algo não estudado, recomenda primeiro a base.
export function proximoTopico(
  topicos: Topico[],
  disciplinas: Disciplina[],
  user: UserData,
  deps: Dependencia[],
  disciplinaId: string,
): Recomendacao | null {
  const lista = candidatos(topicos, user, disciplinaId);
  if (!lista.length) return null;
  const alvo = lista[0];
  const byId = new Map(topicos.map((t) => [t.id, t]));
  const cadeia = cadeiaObrigatoria(deps, user, alvo.id);
  const estudar = byId.get(cadeia[cadeia.length - 1]) as Topico;
  const disc = disciplinas.find((d) => d.id === estudar.disciplinaId) as Disciplina;
  const motivos: string[] = [];
  if (estudar.id !== alvo.id) {
    motivos.push(
      `É pré-requisito obrigatório de "${alvo.titulo}" (nº ${alvo.numero}, prioridade ${prioridadeTopico(alvo, user)}), que ainda não pode ser estudado.`,
    );
    return { topico: estudar, disciplina: disc, tipo: 'prerequisito', motivos: [...motivos, ...recomendadosPendentes(estudar)] };
  }
  const st = estadoDe(user, alvo.id).status;
  if (st === 'em_andamento') motivos.push('Já está em andamento.');
  motivos.push(`Prioridade ${prioridadeTopico(alvo, user)}${estadoDe(user, alvo.id).prioridade ? ' (definida por você)' : ' (planilha)'}.`);
  return { topico: alvo, disciplina: disc, tipo: 'ciclo', motivos: [...motivos, ...recomendadosPendentes(alvo)] };

  function recomendadosPendentes(t: Topico): string[] {
    const rec = pendentes(deps, user, t.id, 'recomendado');
    if (!rec.length) return [];
    const nomes = rec.map((d) => `nº ${byId.get(d.de)?.numero}`).join(', ');
    return [`Recomendado estudar antes: ${nomes} (não bloqueia).`];
  }
}

export function recomendacoes(
  topicos: Topico[],
  disciplinas: Disciplina[],
  user: UserData,
  hoje: string,
  max = 4,
): Recomendacao[] {
  const out: Recomendacao[] = [];
  const usados = new Set<string>();
  const push = (r: Recomendacao | null) => {
    if (r && !usados.has(r.topico.id) && out.length < max) {
      usados.add(r.topico.id);
      out.push(r);
    }
  };

  // 1. Posição atual no ciclo.
  const item = proximoItem(user.ciclo);
  if (item) {
    const r = proximoTopico(topicos, disciplinas, user, user.dependencias, item.disciplinaId);
    if (r) {
      r.motivos.unshift(`É a próxima disciplina do ciclo (volta ${user.ciclo.numero}).`);
      push(r);
    }
  }

  // 2. Revisões vencidas.
  for (const rv of revisoesDevidas(topicos, user, hoje).slice(0, 2)) {
    const disc = disciplinas.find((d) => d.id === rv.topico.disciplinaId) as Disciplina;
    push({
      topico: rv.topico,
      disciplina: disc,
      tipo: 'revisao',
      motivos: [rv.atrasoDias > 0 ? `Revisão venceu há ${rv.atrasoDias} dia(s).` : 'Revisão vence hoje.'],
    });
  }

  // 3. Equilíbrio: disciplina do ciclo com maior déficit entre tempo planejado e realizado nos últimos 14 dias.
  const at = ativos(user.ciclo);
  const planoTot = at.reduce((a, i) => a + i.minutos, 0);
  if (planoTot > 0) {
    const desde = somarDias(hoje, -13);
    const real: Record<string, number> = {};
    let realTot = 0;
    for (const s of user.sessoes) {
      if (s.data >= desde && s.data <= hoje) {
        real[s.disciplinaId] = (real[s.disciplinaId] ?? 0) + s.realizadoMin;
        realTot += s.realizadoMin;
      }
    }
    if (realTot > 0) {
      const plano: Record<string, number> = {};
      for (const i of at) plano[i.disciplinaId] = (plano[i.disciplinaId] ?? 0) + i.minutos;
      let pior: { id: string; deficit: number } | null = null;
      for (const id of Object.keys(plano)) {
        const deficit = plano[id] / planoTot - (real[id] ?? 0) / realTot;
        if (!pior || deficit > pior.deficit) pior = { id, deficit };
      }
      if (pior && pior.deficit > 0.05) {
        const r = proximoTopico(topicos, disciplinas, user, user.dependencias, pior.id);
        if (r) {
          r.tipo = r.tipo === 'prerequisito' ? 'prerequisito' : 'equilibrio';
          r.motivos.unshift(`Disciplina com menos tempo que o planejado nos últimos 14 dias (${Math.round(pior.deficit * 100)} pontos percentuais abaixo).`);
          push(r);
        }
      }
    }
  }
  return out;
}
