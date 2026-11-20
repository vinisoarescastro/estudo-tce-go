import type { Topico, UserData } from './types';
import { estadoDe, isConcluido } from './progress';
import { diffDias, somarDias } from './util';

// Ritmo para terminar o edital: quantos conteúdos por dia faltam para concluir tudo até a data-alvo
// (alguns dias antes da prova, para a reta final de revisão) e quantos a pessoa tem concluído.
// Usado na página inicial e no acompanhamento do administrador, para os dois verem os mesmos números.

/** Dias antes da prova em que o conteúdo deve estar terminado (reta final de revisão). */
export const RETA_FINAL_DIAS = 3;
/** Janela do ritmo atual: as últimas 4 semanas, ou menos para quem começou há pouco (mínimo de 7 dias). */
const JANELA_MAX = 28;
const JANELA_MIN = 7;

export interface Ritmo {
  total: number;
  concluidos: number;
  restantes: number;
  /** Concluídos hoje (data de conclusão = hoje). */
  concluidosHoje: number;
  dataProva: string | null;
  /** Data em que o conteúdo deve estar terminado: a prova menos a reta final. */
  dataAlvo: string | null;
  /** Dias disponíveis até a data-alvo, contando hoje (0 se já passou). */
  diasDisponiveis: number | null;
  /** Conteúdos por dia necessários, calculados com o que faltava no começo do dia (não muda durante o dia). */
  necessarioDia: number | null;
  /** Meta de hoje: o necessário por dia arredondado para cima. */
  metaHoje: number | null;
  /** Conteúdos concluídos por dia na janela recente. */
  atualDia: number;
  /** Dias da janela usada no ritmo atual. */
  janelaDias: number;
  /** Dias desde o primeiro estudo, contando hoje (0 sem estudo). Com menos de 7, não há projeção. */
  historicoDias: number;
  /** Dias para concluir o que falta no ritmo atual (null se o ritmo é zero). */
  projecaoDias: number | null;
  /** Data em que terminaria no ritmo atual. */
  projecaoData: string | null;
  /** Dias de sobra (positivo) ou de atraso (negativo) da projeção em relação à data-alvo. */
  folgaDias: number | null;
  situacao: 'concluido' | 'ok' | 'atras' | 'sem-ritmo' | 'sem-prova' | 'prazo-encerrado';
}

export function calcularRitmo(topicos: Topico[], user: UserData, hoje: string): Ritmo {
  const conclusoes: string[] = [];
  for (const t of topicos) {
    const e = estadoDe(user, t.id);
    if (isConcluido(e.status) && e.concluidoEm) conclusoes.push(e.concluidoEm);
  }
  const total = topicos.length;
  const concluidos = topicos.filter((t) => isConcluido(estadoDe(user, t.id).status)).length;
  const restantes = total - concluidos;
  const concluidosHoje = conclusoes.filter((d) => d === hoje).length;

  // Ritmo atual: concluídos na janela. A janela começa no primeiro estudo, se ele for recente.
  const datasEstudo = [...conclusoes, ...user.sessoes.filter((s) => s.realizadoMin > 0).map((s) => s.data)].filter((d) => d <= hoje);
  const primeiro = datasEstudo.length ? datasEstudo.reduce((a, b) => (b < a ? b : a)) : null;
  const historicoDias = primeiro ? diffDias(primeiro, hoje) + 1 : 0;
  const janelaDias = primeiro ? Math.max(JANELA_MIN, Math.min(JANELA_MAX, historicoDias)) : JANELA_MAX;
  const inicioJanela = somarDias(hoje, -(janelaDias - 1));
  const naJanela = conclusoes.filter((d) => d >= inicioJanela && d <= hoje).length;
  const atualDia = naJanela / janelaDias;

  const prova = user.config.dataProva || null;
  const dataAlvo = prova ? somarDias(prova, -RETA_FINAL_DIAS) : null;
  const diasDisponiveis = dataAlvo ? Math.max(0, diffDias(hoje, dataAlvo) + 1) : null;
  const restantesInicioDia = restantes + concluidosHoje;
  const necessarioDia = diasDisponiveis ? restantesInicioDia / diasDisponiveis : null;
  const metaHoje = necessarioDia !== null && restantesInicioDia > 0 ? Math.ceil(necessarioDia) : null;

  // Com menos de uma semana de histórico, o ritmo ainda não diz nada: sem projeção.
  const projecaoDias = historicoDias >= JANELA_MIN && atualDia > 0 ? Math.ceil(restantes / atualDia) : null;
  const projecaoData = projecaoDias !== null ? somarDias(hoje, projecaoDias) : null;
  const folgaDias = projecaoData && dataAlvo ? diffDias(projecaoData, dataAlvo) : null;

  let situacao: Ritmo['situacao'];
  if (restantes === 0) situacao = 'concluido';
  else if (!prova || diffDias(hoje, prova) < 0) situacao = 'sem-prova';
  else if (!diasDisponiveis) situacao = 'prazo-encerrado';
  else if (projecaoDias === null) situacao = 'sem-ritmo';
  else situacao = folgaDias! >= 0 ? 'ok' : 'atras';

  return { total, concluidos, restantes, concluidosHoje, dataProva: prova, dataAlvo, diasDisponiveis, necessarioDia, metaHoje, atualDia, janelaDias, historicoDias, projecaoDias, projecaoData, folgaDias, situacao };
}
