// Tipos do domínio. A estrutura do edital (núcleos, disciplinas, tópicos) vem do seed;
// tudo o que o usuário altera fica em UserData.

export type NucleoId = 'CG' | 'CE';

export interface Nucleo {
  id: NucleoId;
  nome: string; // nome usado no edital
  apelido: string; // "Núcleo comum" / "Núcleo específico"
  descricao: string;
  pagina: number;
}

export interface Disciplina {
  id: string;
  nome: string; // nome oficial do Anexo II
  nomeCurto: string;
  nucleo: NucleoId;
  ordemEdital: number;
  paginas: number[];
  textoOficial: string; // texto integral da disciplina no Anexo II
}

export type Confianca = 'alta' | 'media' | 'baixa';

export interface ReferenciaEdital {
  documento: string;
  anexo: string;
  secao: string;
  disciplina: string;
  paginas: number[];
  trecho: string | null; // trecho literal do Anexo II que corresponde ao item
  confianca: Confianca; // grau da correspondência automática entre item e trecho
}

export type Prioridade = 'Urgente' | 'Alta' | 'Média' | 'Baixa';
export const PRIORIDADES: Prioridade[] = ['Urgente', 'Alta', 'Média', 'Baixa'];

export interface Topico {
  id: string;
  numero: number; // coluna Nº da planilha Edital Verticalizado
  disciplinaId: string;
  titulo: string; // título do item na planilha
  desdobramentoPlanilha: boolean; // item marcado [Interpretacao] na planilha
  ref: ReferenciaEdital;
  prioridadePlanilha: Prioridade;
  incidencia: string;
  statusPlanilha: string;
}

export interface Fato {
  id: string;
  rotulo: string;
  valor: string;
  ref: string;
  pagina: number;
}

export type TipoDependencia = 'obrigatorio' | 'recomendado';

export interface Dependencia {
  id: string;
  de: string; // pré-requisito (tópico que vem antes)
  para: string; // tópico que depende dele
  tipo: TipoDependencia;
  origem: 'sugestao' | 'usuario';
}

export interface Seed {
  seedVersion: number;
  fonte: { edital: string; planilha: string };
  nucleos: Nucleo[];
  disciplinas: Disciplina[];
  topicos: Topico[];
  dependenciasSugeridas: Dependencia[];
  fatos: Fato[];
}

export type Status = 'nao_iniciado' | 'em_andamento' | 'estudado' | 'em_revisao';
export const STATUS: Status[] = ['nao_iniciado', 'em_andamento', 'estudado', 'em_revisao'];
export const STATUS_LABEL: Record<Status, string> = {
  nao_iniciado: 'Não iniciado',
  em_andamento: 'Em andamento',
  estudado: 'Estudado',
  em_revisao: 'Em revisão',
};

export interface TopicoEstado {
  status: Status;
  dominado: boolean; // autoavaliação: domina o assunto (diferente de "estudado")
  prioridade?: Prioridade; // sobrescreve a prioridade da planilha
  notas: string;
  concluidoEm?: string; // AAAA-MM-DD em que passou a contar como concluído
  ultimoEstudo?: string; // AAAA-MM-DD da última vez que foi estudado ou revisado
  revisoesFeitas: number;
}

export interface CicloItem {
  id: string;
  disciplinaId: string;
  minutos: number; // tempo planejado da sessão
  ativo: boolean;
}

export interface Ciclo {
  itens: CicloItem[];
  proximoItemId: string | null;
  numero: number; // quantas voltas completas + 1
}

export interface Sessao {
  id: string;
  data: string; // AAAA-MM-DD
  disciplinaId: string;
  topicoId: string | null;
  planejadoMin: number;
  realizadoMin: number;
  notas: string;
  origem: 'cronometro' | 'manual';
  cicloItemId: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface Timer {
  id: string; // vira o id da sessão ao finalizar (evita duplicidade)
  disciplinaId: string;
  topicoId: string | null;
  cicloItemId: string | null;
  planejadoMin: number;
  iniciadoEm: number; // epoch ms
  acumuladoMs: number; // tempo já contado antes da última pausa
  rodandoDesde: number | null; // epoch ms; null = pausado
}

export interface Config {
  metaDiariaMin: number;
  metaSemanalMin: number;
  duracaoPadraoMin: number;
  revisaoDias: number[]; // intervalos entre revisões
  dataProva: string; // AAAA-MM-DD; vazio = ainda não definida
  fusoHorario?: string; // fuso IANA usado para "hoje" e "esta semana" (padrão America/Sao_Paulo)
}

export type TipoEvento =
  | 'status'
  | 'dominio'
  | 'prioridade'
  | 'sessao_criada'
  | 'sessao_editada'
  | 'sessao_excluida'
  | 'ciclo'
  | 'dependencia'
  | 'revisao'
  | 'config'
  | 'importacao';

export interface Evento {
  id: string;
  ts: string; // ISO
  tipo: TipoEvento;
  descricao: string;
  topicoId?: string;
  disciplinaId?: string;
}

export interface UserData {
  topicos: Record<string, TopicoEstado>;
  prioridadeDisciplina: Record<string, Prioridade | undefined>;
  ciclo: Ciclo;
  dependencias: Dependencia[];
  sessoes: Sessao[];
  timer: Timer | null;
  config: Config;
  historico: Evento[];
}

export interface AppData {
  schemaVersion: 1;
  seedVersion: number;
  user: UserData;
}
