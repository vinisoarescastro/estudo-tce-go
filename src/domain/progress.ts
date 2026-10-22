import type { Disciplina, NucleoId, Status, Topico, TopicoEstado, UserData } from './types';

// Regras de contagem (as mesmas em todas as páginas):
// - Cada tópico do edital conta uma vez. Não há níveis acima do tópico com contagem própria,
//   então disciplina, núcleo e edital são somas de tópicos, sem dupla contagem.
// - Concluído = status "Estudado" ou "Em revisão". "Em andamento" não conta como concluído.
// - "Dominado" é um indicador separado e nunca entra no percentual de conclusão.

export const ESTADO_PADRAO: TopicoEstado = { status: 'nao_iniciado', dominado: false, notas: '', revisoesFeitas: 0 };

export function estadoDe(user: UserData, topicoId: string): TopicoEstado {
  return user.topicos[topicoId] ?? ESTADO_PADRAO;
}

export function isConcluido(status: Status): boolean {
  return status === 'estudado' || status === 'em_revisao';
}

export interface Contagem {
  total: number;
  concluidos: number;
  naoIniciados: number;
  emAndamento: number;
  estudados: number;
  emRevisao: number;
  dominados: number;
  pendentes: number;
  pct: number; // concluidos / total
}

export function contar(topicos: Topico[], user: UserData): Contagem {
  const c: Contagem = { total: 0, concluidos: 0, naoIniciados: 0, emAndamento: 0, estudados: 0, emRevisao: 0, dominados: 0, pendentes: 0, pct: 0 };
  for (const t of topicos) {
    const e = estadoDe(user, t.id);
    c.total++;
    if (e.status === 'nao_iniciado') c.naoIniciados++;
    else if (e.status === 'em_andamento') c.emAndamento++;
    else if (e.status === 'estudado') c.estudados++;
    else c.emRevisao++;
    if (isConcluido(e.status)) c.concluidos++;
    if (e.dominado) c.dominados++;
  }
  c.pendentes = c.total - c.concluidos;
  c.pct = c.total ? c.concluidos / c.total : 0;
  return c;
}

export function topicosDaDisciplina(topicos: Topico[], disciplinaId: string): Topico[] {
  return topicos.filter((t) => t.disciplinaId === disciplinaId);
}

export function topicosDoNucleo(topicos: Topico[], disciplinas: Disciplina[], nucleo: NucleoId): Topico[] {
  const ids = new Set(disciplinas.filter((d) => d.nucleo === nucleo).map((d) => d.id));
  return topicos.filter((t) => ids.has(t.disciplinaId));
}

// Aplica uma mudança de status mantendo as datas coerentes.
export function aplicarStatus(atual: TopicoEstado, novo: Status, hoje: string): TopicoEstado {
  const e: TopicoEstado = { ...atual, status: novo };
  const antes = isConcluido(atual.status);
  const depois = isConcluido(novo);
  if (!antes && depois) e.concluidoEm = hoje;
  if (antes && !depois) {
    // Reabrir: o tópico deixa de contar como concluído. As sessões e o histórico continuam.
    delete e.concluidoEm;
    e.dominado = false;
  }
  if (novo === 'estudado' || novo === 'em_andamento') e.ultimoEstudo = hoje;
  return e;
}

// Série acumulada de tópicos concluídos por dia, a partir de concluidoEm (estado atual).
export function serieConclusao(topicos: Topico[], user: UserData, dias: string[]): { dia: string; concluidos: number }[] {
  const datas = topicos
    .map((t) => estadoDe(user, t.id))
    .filter((e) => isConcluido(e.status) && e.concluidoEm)
    .map((e) => e.concluidoEm as string)
    .sort();
  let i = 0;
  let acc = 0;
  return dias.map((dia) => {
    while (i < datas.length && datas[i] <= dia) {
      acc++;
      i++;
    }
    return { dia, concluidos: acc };
  });
}
