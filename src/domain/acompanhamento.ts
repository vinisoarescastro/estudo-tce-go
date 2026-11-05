import type { Prioridade, Seed, UserData } from './types';
import { contar, estadoDe, isConcluido } from './progress';
import { prioridadeTopico } from './cycle';
import { revisoesDevidas } from './revisions';
import { filtrarSessoes, somaMin } from './stats';
import { diffDias, inicioSemana, somarDias } from './util';

// Acompanhamento do administrador: números agregados do progresso de uma conta. Nunca inclui notas dos
// conteúdos nem o texto das sessões; só contagens, datas e minutos.

export interface ResumoAcompanhamento {
  totalConteudos: number;
  concluidos: number;
  pct: number;
  /** Conteúdos Urgentes e Altos (prioridade efetiva da conta) e quantos já foram concluídos. */
  prioritarios: { total: number; concluidos: number; pct: number };
  minutos7: number;
  minutos30: number;
  metaSemanalMin: number;
  /** Dias com estudo registrado nos últimos 7 dias (hoje incluído). */
  diasEstudados7: number;
  ultimoEstudo: string | null;
  diasSemEstudar: number | null;
  sessoes: number;
  minutosTotais: number;
  revisoesAtrasadas: number;
  dataProva: string;
  diasAteProva: number | null;
  /** Conteúdos concluídos por semana, na média das últimas 4 semanas. */
  ritmoSemanal: number;
  /** Dias para concluir o que falta no ritmo atual (null se o ritmo é zero). */
  projecaoDias: number | null;
  /** 'ok' se a projeção cabe nos dias que faltam; 'atras' se não cabe; null sem dados. */
  situacao: 'ok' | 'atras' | 'sem-ritmo' | 'sem-prova' | null;
}

export interface DisciplinaAcomp {
  id: string;
  nome: string;
  nomeCurto: string;
  nucleo: 'CG' | 'CE';
  total: number;
  concluidos: number;
  pct: number;
  prioritariosPendentes: number;
  minutos30: number;
  /** Minutos que o ciclo previa para a disciplina nos últimos 30 dias (proporcional ao total estudado). */
  previstoMin30: number;
}

export interface PendenteAcomp {
  id: string;
  titulo: string;
  disciplina: string;
  prioridade: Prioridade;
  status: string;
}

export interface DetalheAcompanhamento {
  porDisciplina: DisciplinaAcomp[];
  semanas: { chave: string; min: number; metaMin: number }[];
  pendentesPrioritarios: PendenteAcomp[];
  negligenciadas: string[];
}

const PRIORITARIAS: Prioridade[] = ['Urgente', 'Alta'];

export function resumir(seed: Seed, user: UserData, hoje: string): ResumoAcompanhamento {
  const c = contar(seed.topicos, user);
  const prio = seed.topicos.filter((t) => PRIORITARIAS.includes(prioridadeTopico(t, user)));
  const prioConc = prio.filter((t) => isConcluido(estadoDe(user, t.id).status)).length;

  const sessoes = user.sessoes.filter((s) => s.data <= hoje);
  const min = (de: string) => somaMin(filtrarSessoes(sessoes, seed.disciplinas, { de, ate: hoje }));
  const sete = somarDias(hoje, -6);
  const diasEstudados = new Set(sessoes.filter((s) => s.data >= sete && s.realizadoMin > 0).map((s) => s.data)).size;
  const ultimo = sessoes.reduce<string | null>((a, s) => (s.realizadoMin > 0 && (!a || s.data > a) ? s.data : a), null);

  const quatroSem = somarDias(hoje, -27);
  const concluidosRecentes = seed.topicos.filter((t) => {
    const e = estadoDe(user, t.id);
    return isConcluido(e.status) && e.concluidoEm && e.concluidoEm >= quatroSem && e.concluidoEm <= hoje;
  }).length;
  const ritmo = concluidosRecentes / 4;
  const restantes = c.total - c.concluidos;
  const prova = user.config.dataProva;
  const diasAteProva = prova ? diffDias(hoje, prova) : null;
  const projecao = ritmo > 0 ? Math.ceil((restantes / ritmo) * 7) : null;
  let situacao: ResumoAcompanhamento['situacao'] = null;
  if (restantes === 0) situacao = 'ok';
  else if (diasAteProva === null || diasAteProva < 0) situacao = 'sem-prova';
  else if (projecao === null) situacao = 'sem-ritmo';
  else situacao = projecao <= diasAteProva ? 'ok' : 'atras';

  return {
    totalConteudos: c.total,
    concluidos: c.concluidos,
    pct: c.pct,
    prioritarios: { total: prio.length, concluidos: prioConc, pct: prio.length ? prioConc / prio.length : 0 },
    minutos7: min(sete),
    minutos30: min(somarDias(hoje, -29)),
    metaSemanalMin: user.config.metaSemanalMin,
    diasEstudados7: diasEstudados,
    ultimoEstudo: ultimo,
    diasSemEstudar: ultimo ? diffDias(ultimo, hoje) : null,
    sessoes: sessoes.length,
    minutosTotais: somaMin(sessoes),
    revisoesAtrasadas: revisoesDevidas(seed.topicos, user, hoje).length,
    dataProva: prova,
    diasAteProva,
    ritmoSemanal: ritmo,
    projecaoDias: projecao,
    situacao,
  };
}

export function detalhar(seed: Seed, user: UserData, hoje: string): DetalheAcompanhamento {
  const sessoes = user.sessoes.filter((s) => s.data <= hoje);
  const de30 = somarDias(hoje, -29);
  const s30 = filtrarSessoes(sessoes, seed.disciplinas, { de: de30, ate: hoje });
  const total30 = somaMin(s30);

  // Previsto pelo ciclo: fatia de cada disciplina nos minutos das sessões ativas do ciclo.
  const ativos = user.ciclo.itens.filter((i) => i.ativo);
  const minCiclo = ativos.reduce((a, i) => a + i.minutos, 0);
  const prevFatia = (id: string) => (minCiclo ? ativos.filter((i) => i.disciplinaId === id).reduce((a, i) => a + i.minutos, 0) / minCiclo : 0);

  const porDisciplina: DisciplinaAcomp[] = seed.disciplinas.map((d) => {
    const ts = seed.topicos.filter((t) => t.disciplinaId === d.id);
    const c = contar(ts, user);
    const min30 = somaMin(s30.filter((s) => s.disciplinaId === d.id));
    return {
      id: d.id,
      nome: d.nome,
      nomeCurto: d.nomeCurto,
      nucleo: d.nucleo,
      total: c.total,
      concluidos: c.concluidos,
      pct: c.pct,
      prioritariosPendentes: ts.filter((t) => PRIORITARIAS.includes(prioridadeTopico(t, user)) && !isConcluido(estadoDe(user, t.id).status)).length,
      minutos30: min30,
      previstoMin30: Math.round(total30 * prevFatia(d.id)),
    };
  });

  const semAtual = inicioSemana(hoje);
  const semanas: DetalheAcompanhamento['semanas'] = [];
  for (let k = 7; k >= 0; k--) {
    const ini = somarDias(semAtual, -7 * k);
    semanas.push({ chave: ini, min: somaMin(sessoes.filter((s) => s.data >= ini && s.data <= somarDias(ini, 6))), metaMin: user.config.metaSemanalMin });
  }

  const ordemP: Record<string, number> = { Urgente: 0, Alta: 1 };
  const nomeD = new Map(seed.disciplinas.map((d) => [d.id, d.nomeCurto]));
  const pendentes = seed.topicos
    .filter((t) => PRIORITARIAS.includes(prioridadeTopico(t, user)) && !isConcluido(estadoDe(user, t.id).status))
    .map((t) => ({ id: t.id, titulo: t.titulo, disciplina: nomeD.get(t.disciplinaId) ?? '', prioridade: prioridadeTopico(t, user), status: estadoDe(user, t.id).status }))
    .sort((a, b) => ordemP[a.prioridade] - ordemP[b.prioridade] || (a.status === 'nao_iniciado' ? 1 : 0) - (b.status === 'nao_iniciado' ? 1 : 0));

  // Negligenciada: estudou menos da metade do que o ciclo previa (só avalia com pelo menos 3 h no período).
  const negligenciadas = total30 >= 180
    ? porDisciplina.filter((d) => d.previstoMin30 >= 60 && d.minutos30 < d.previstoMin30 * 0.5 && d.pct < 1).map((d) => d.nomeCurto)
    : [];

  return { porDisciplina, semanas, pendentesPrioritarios: pendentes.slice(0, 40), negligenciadas };
}
