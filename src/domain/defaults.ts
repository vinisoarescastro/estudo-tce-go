import type { AppData, Seed, Status, TopicoEstado, UserData } from './types';
import { FUSO_PADRAO, isoDia } from './util';

// Ordem inicial do ciclo: 22 sessões (29h30 por volta), baseada no plano entregue antes,
// com o tempo de cada sessão em minutos. Tudo é editável na página Ciclo.
const CICLO_INICIAL: [string, number][] = [
  ['es', 90], ['lp', 90], ['redes', 90], ['bd', 60], ['seg', 90], ['leginst', 90], ['ds', 90], ['gov', 60],
  ['esia', 90], ['mat', 90], ['devops', 90], ['es', 90], ['legti', 90], ['lp', 90], ['redes', 90], ['bd', 60],
  ['seg', 90], ['ia', 90], ['ds', 90], ['leginst', 60], ['gov', 60], ['ing', 30],
];

const STATUS_PLANILHA: Record<string, Status> = {
  'Não estudado': 'nao_iniciado',
  Estudando: 'em_andamento',
  Estudado: 'estudado',
  Revisado: 'em_revisao',
};

export function criarDados(seed: Seed, hoje = isoDia(), agora = Date.now()): AppData {
  const topicos: Record<string, TopicoEstado> = {};
  for (const t of seed.topicos) {
    const st = STATUS_PLANILHA[t.statusPlanilha] ?? 'nao_iniciado';
    if (st !== 'nao_iniciado') topicos[t.id] = { status: st, dominado: false, notas: '', revisoesFeitas: 0, ultimoEstudo: hoje };
  }
  const itens = CICLO_INICIAL.map(([d, m], i) => ({ id: `ci${String(i + 1).padStart(2, '0')}`, disciplinaId: d, minutos: m, ativo: true }));
  const user: UserData = {
    topicos,
    prioridadeDisciplina: {},
    ciclo: { itens, proximoItemId: itens[0].id, numero: 1 },
    dependencias: seed.dependenciasSugeridas.map((d) => ({ ...d })),
    sessoes: [],
    timer: null,
    config: { metaDiariaMin: 390, metaSemanalMin: 2370, duracaoPadraoMin: 90, revisaoDias: [1, 7, 30], dataProva: '2027-01-17', fusoHorario: FUSO_PADRAO },
    historico: [
      {
        id: 'ev-inicio',
        ts: new Date(agora).toISOString(),
        tipo: 'importacao',
        descricao: 'Plano criado a partir do edital nº 01/2026 e da planilha Edital Verticalizado v2.0.',
      },
    ],
  };
  return { schemaVersion: 1, seedVersion: seed.seedVersion, user };
}
