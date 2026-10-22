import type { AppData, CicloItem, Config, Dependencia, Evento, Prioridade, Seed, Sessao, Status, TipoDependencia, UserData } from './types';
import { STATUS_LABEL } from './types';
import { aplicarStatus, estadoDe } from './progress';
import * as cyc from './cycle';
import * as tm from './timer';
import { criaCiclo } from './deps';
import { registrarRevisao } from './revisions';
import { FUSO_PADRAO, fusoValido, isoDia, uid } from './util';
import { criarDados } from './defaults';

// Todas as mudanças passam por aqui (reducer puro). A interface só despacha ações.

export type Acao =
  | { t: 'status'; topicoId: string; status: Status }
  | { t: 'dominado'; topicoId: string; valor: boolean }
  | { t: 'prioridade'; topicoId: string; valor: Prioridade | null }
  | { t: 'prioridadeDisciplina'; disciplinaId: string; valor: Prioridade | null }
  | { t: 'notas'; topicoId: string; texto: string }
  | { t: 'revisao'; topicoId: string }
  | { t: 'cicloMover'; de: number; para: number }
  | { t: 'cicloMinutos'; itemId: string; minutos: number }
  | { t: 'cicloAtivo'; itemId: string; ativo: boolean }
  | { t: 'cicloAdicionar'; disciplinaId: string; minutos: number }
  | { t: 'cicloRemover'; itemId: string }
  | { t: 'cicloDistribuicao'; minutos: Record<string, number> }
  | { t: 'cicloProximo'; itemId: string }
  | { t: 'cicloPular' }
  | { t: 'timerIniciar'; disciplinaId: string; topicoId: string | null; cicloItemId: string | null; planejadoMin: number; pausado?: boolean }
  | { t: 'timerPausar' }
  | { t: 'timerRetomar' }
  | { t: 'timerDescartar' }
  | { t: 'timerFinalizar'; notas: string; novoStatus: Status | null }
  | { t: 'sessaoSalvar'; sessao: Omit<Sessao, 'criadoEm' | 'atualizadoEm' | 'id'> & { id?: string }; avancarCiclo?: boolean; novoStatus?: Status | null }
  | { t: 'sessaoExcluir'; id: string }
  | { t: 'depAdicionar'; de: string; para: string; tipo: TipoDependencia }
  | { t: 'depRemover'; id: string }
  | { t: 'depTipo'; id: string; tipo: TipoDependencia }
  | { t: 'depRestaurar' }
  | { t: 'config'; valor: Partial<Config> }
  | { t: 'importar'; dados: AppData }
  | { t: 'reiniciar' };

export interface Contexto {
  seed: Seed;
  agora: number; // epoch ms
  // Gera ids novos. O cliente registra os ids que gerou e o servidor reaproveita os mesmos,
  // para que o estado aplicado na tela e o gravado no banco fiquem idênticos.
  gerarId?: (prefixo: string) => string;
}

export class ErroAcao extends Error {}

const novoId = (ctx: Contexto, prefixo: string) => (ctx.gerarId ?? uid)(prefixo);

function log(u: UserData, ev: Omit<Evento, 'id' | 'ts'>, ctx: Contexto): UserData {
  const e: Evento = { ...ev, id: novoId(ctx, 'ev'), ts: new Date(ctx.agora).toISOString() };
  // Mantém os 5.000 eventos mais recentes para o arquivo não crescer sem limite.
  return { ...u, historico: [e, ...u.historico].slice(0, 5000) };
}

export function reduzir(dados: AppData, a: Acao, ctx: Contexto): AppData {
  const u = dados.user;
  const hoje = isoDia(new Date(ctx.agora));
  const nomeT = (id: string) => {
    const t = ctx.seed.topicos.find((x) => x.id === id);
    return t ? `nº ${t.numero} ${t.titulo}` : id;
  };
  const nomeD = (id: string) => ctx.seed.disciplinas.find((x) => x.id === id)?.nomeCurto ?? id;
  const setU = (nu: UserData) => ({ ...dados, user: nu });
  const setTop = (id: string, fn: (e: ReturnType<typeof estadoDe>) => ReturnType<typeof estadoDe>) => ({ ...u.topicos, [id]: fn(estadoDe(u, id)) });

  switch (a.t) {
    case 'status': {
      const antes = estadoDe(u, a.topicoId).status;
      if (antes === a.status) return dados;
      const nu = { ...u, topicos: setTop(a.topicoId, (e) => aplicarStatus(e, a.status, hoje)) };
      return setU(log(nu, { tipo: 'status', topicoId: a.topicoId, descricao: `${nomeT(a.topicoId)}: ${STATUS_LABEL[antes]} → ${STATUS_LABEL[a.status]}` }, ctx));
    }
    case 'dominado': {
      const e = estadoDe(u, a.topicoId);
      if (a.valor && !(e.status === 'estudado' || e.status === 'em_revisao')) throw new ErroAcao('Marque o tópico como estudado antes de indicar que o domina.');
      const nu = { ...u, topicos: setTop(a.topicoId, (x) => ({ ...x, dominado: a.valor })) };
      return setU(log(nu, { tipo: 'dominio', topicoId: a.topicoId, descricao: `${nomeT(a.topicoId)}: ${a.valor ? 'marcado como dominado' : 'domínio desmarcado'}` }, ctx));
    }
    case 'prioridade': {
      const nu = { ...u, topicos: setTop(a.topicoId, (x) => { const c = { ...x }; if (a.valor) c.prioridade = a.valor; else delete c.prioridade; return c; }) };
      return setU(log(nu, { tipo: 'prioridade', topicoId: a.topicoId, descricao: `${nomeT(a.topicoId)}: prioridade ${a.valor ?? 'da planilha'}` }, ctx));
    }
    case 'prioridadeDisciplina': {
      const p = { ...u.prioridadeDisciplina };
      if (a.valor) p[a.disciplinaId] = a.valor; else delete p[a.disciplinaId];
      return setU(log({ ...u, prioridadeDisciplina: p }, { tipo: 'prioridade', disciplinaId: a.disciplinaId, descricao: `${nomeD(a.disciplinaId)}: prioridade da disciplina ${a.valor ?? 'removida'}` }, ctx));
    }
    case 'notas':
      return setU({ ...u, topicos: setTop(a.topicoId, (x) => ({ ...x, notas: a.texto.slice(0, 5000) })) });
    case 'revisao': {
      const e = estadoDe(u, a.topicoId);
      if (!(e.status === 'estudado' || e.status === 'em_revisao')) throw new ErroAcao('Só é possível registrar revisão de um tópico já estudado.');
      const nu = { ...u, topicos: setTop(a.topicoId, (x) => registrarRevisao(x, hoje)) };
      return setU(log(nu, { tipo: 'revisao', topicoId: a.topicoId, descricao: `${nomeT(a.topicoId)}: revisão nº ${e.revisoesFeitas + 1} registrada` }, ctx));
    }
    case 'cicloMover': {
      const it = u.ciclo.itens[a.de];
      const c = cyc.mover(u.ciclo, a.de, a.para);
      if (c === u.ciclo) return dados;
      return setU(log({ ...u, ciclo: c }, { tipo: 'ciclo', disciplinaId: it.disciplinaId, descricao: `Ciclo: ${nomeD(it.disciplinaId)} movida da posição ${a.de + 1} para ${a.para + 1}` }, ctx));
    }
    case 'cicloMinutos': {
      const m = Math.round(a.minutos);
      if (!(m >= 5 && m <= 600)) throw new ErroAcao('O tempo da sessão deve ficar entre 5 e 600 minutos.');
      return setU({ ...u, ciclo: { ...u.ciclo, itens: u.ciclo.itens.map((i) => (i.id === a.itemId ? { ...i, minutos: m } : i)) } });
    }
    case 'cicloAtivo': {
      const it = u.ciclo.itens.find((i) => i.id === a.itemId);
      if (!it) return dados;
      return setU(log({ ...u, ciclo: cyc.definirAtivo(u.ciclo, a.itemId, a.ativo) }, { tipo: 'ciclo', disciplinaId: it.disciplinaId, descricao: `Ciclo: ${nomeD(it.disciplinaId)} ${a.ativo ? 'ativada' : 'desativada'}` }, ctx));
    }
    case 'cicloAdicionar': {
      if (!ctx.seed.disciplinas.some((d) => d.id === a.disciplinaId)) throw new ErroAcao('Disciplina desconhecida.');
      const item: CicloItem = { id: novoId(ctx, 'ci'), disciplinaId: a.disciplinaId, minutos: Math.max(5, Math.round(a.minutos)), ativo: true };
      return setU(log({ ...u, ciclo: cyc.adicionar(u.ciclo, item) }, { tipo: 'ciclo', disciplinaId: a.disciplinaId, descricao: `Ciclo: sessão de ${nomeD(a.disciplinaId)} adicionada` }, ctx));
    }
    case 'cicloRemover': {
      const it = u.ciclo.itens.find((i) => i.id === a.itemId);
      if (!it) return dados;
      // As sessões guardam disciplinaId, então o histórico continua completo mesmo sem o item.
      return setU(log({ ...u, ciclo: cyc.remover(u.ciclo, a.itemId) }, { tipo: 'ciclo', disciplinaId: it.disciplinaId, descricao: `Ciclo: sessão de ${nomeD(it.disciplinaId)} removida (histórico mantido)` }, ctx));
    }
    case 'cicloDistribuicao': {
      const itens = u.ciclo.itens.map((i) => (a.minutos[i.id] ? { ...i, minutos: a.minutos[i.id] } : i));
      return setU(log({ ...u, ciclo: { ...u.ciclo, itens } }, { tipo: 'ciclo', descricao: 'Ciclo: distribuição de tempo ajustada' }, ctx));
    }
    case 'cicloProximo': {
      if (!u.ciclo.itens.some((i) => i.id === a.itemId && i.ativo)) return dados;
      return setU({ ...u, ciclo: { ...u.ciclo, proximoItemId: a.itemId } });
    }
    case 'cicloPular': {
      const p = cyc.proximoItem(u.ciclo);
      if (!p) return dados;
      return setU(log({ ...u, ciclo: cyc.avancar(u.ciclo, p.id) }, { tipo: 'ciclo', disciplinaId: p.disciplinaId, descricao: `Ciclo: ${nomeD(p.disciplinaId)} pulada` }, ctx));
    }
    case 'timerIniciar': {
      if (u.timer) throw new ErroAcao('Já existe um cronômetro em andamento. Finalize ou descarte antes de iniciar outro.');
      const t = tm.iniciar({ id: novoId(ctx, 's'), disciplinaId: a.disciplinaId, topicoId: a.topicoId, cicloItemId: a.cicloItemId, planejadoMin: a.planejadoMin }, ctx.agora, a.pausado);
      let topicos = u.topicos;
      if (a.topicoId && estadoDe(u, a.topicoId).status === 'nao_iniciado') topicos = setTop(a.topicoId, (e) => aplicarStatus(e, 'em_andamento', hoje));
      return setU({ ...u, timer: t, topicos });
    }
    case 'timerPausar':
      return u.timer ? setU({ ...u, timer: tm.pausar(u.timer, ctx.agora) }) : dados;
    case 'timerRetomar':
      return u.timer ? setU({ ...u, timer: tm.retomar(u.timer, ctx.agora) }) : dados;
    case 'timerDescartar':
      return setU({ ...u, timer: null });
    case 'timerFinalizar': {
      if (!u.timer) return dados;
      const s = tm.finalizar(u.timer, ctx.agora, a.notas);
      if (s.realizadoMin < 1) throw new ErroAcao('A sessão tem menos de 1 minuto estudado. Continue ou descarte o cronômetro.');
      return registrarSessao({ ...u, timer: null }, s, true, a.novoStatus);
    }
    case 'sessaoSalvar': {
      const s0 = a.sessao;
      if (!ctx.seed.disciplinas.some((d) => d.id === s0.disciplinaId)) throw new ErroAcao('Escolha uma disciplina.');
      if (s0.topicoId && !ctx.seed.topicos.some((t) => t.id === s0.topicoId && t.disciplinaId === s0.disciplinaId)) throw new ErroAcao('O conteúdo escolhido não pertence à disciplina.');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s0.data)) throw new ErroAcao('Data inválida.');
      if (!(s0.realizadoMin >= 1 && s0.realizadoMin <= 1440)) throw new ErroAcao('A duração estudada deve ficar entre 1 e 1440 minutos.');
      if (!(s0.planejadoMin >= 0 && s0.planejadoMin <= 1440)) throw new ErroAcao('O tempo planejado deve ficar entre 0 e 1440 minutos.');
      const iso = new Date(ctx.agora).toISOString();
      const existente = s0.id ? u.sessoes.find((x) => x.id === s0.id) : undefined;
      const s: Sessao = { ...s0, id: s0.id ?? novoId(ctx, 's'), criadoEm: existente?.criadoEm ?? iso, atualizadoEm: iso } as Sessao;
      if (existente) {
        const nu = { ...u, sessoes: tm.upsertSessao(u.sessoes, s) };
        return setU(log(nu, { tipo: 'sessao_editada', disciplinaId: s.disciplinaId, topicoId: s.topicoId ?? undefined, descricao: `Sessão de ${nomeD(s.disciplinaId)} em ${s.data} corrigida (${s.realizadoMin} min)` }, ctx));
      }
      return registrarSessao(u, s, !!a.avancarCiclo, a.novoStatus ?? null);
    }
    case 'sessaoExcluir': {
      const s = u.sessoes.find((x) => x.id === a.id);
      if (!s) return dados;
      const nu = { ...u, sessoes: u.sessoes.filter((x) => x.id !== a.id) };
      return setU(log(nu, { tipo: 'sessao_excluida', disciplinaId: s.disciplinaId, descricao: `Sessão de ${nomeD(s.disciplinaId)} em ${s.data} excluída (${s.realizadoMin} min)` }, ctx));
    }
    case 'depAdicionar': {
      if (a.de === a.para) throw new ErroAcao('Um conteúdo não pode ser pré-requisito de si mesmo.');
      if (u.dependencias.some((d) => d.de === a.de && d.para === a.para)) throw new ErroAcao('Essa dependência já existe.');
      if (criaCiclo(u.dependencias, a.de, a.para)) throw new ErroAcao('Essa dependência criaria um ciclo entre os conteúdos.');
      const d: Dependencia = { id: novoId(ctx, 'd'), de: a.de, para: a.para, tipo: a.tipo, origem: 'usuario' };
      return setU(log({ ...u, dependencias: [...u.dependencias, d] }, { tipo: 'dependencia', topicoId: a.para, descricao: `${nomeT(a.de)} agora é pré-requisito ${a.tipo} de ${nomeT(a.para)}` }, ctx));
    }
    case 'depRemover': {
      const d = u.dependencias.find((x) => x.id === a.id);
      if (!d) return dados;
      return setU(log({ ...u, dependencias: u.dependencias.filter((x) => x.id !== a.id) }, { tipo: 'dependencia', topicoId: d.para, descricao: `Dependência removida: ${nomeT(d.de)} → ${nomeT(d.para)}` }, ctx));
    }
    case 'depTipo':
      return setU({ ...u, dependencias: u.dependencias.map((d) => (d.id === a.id ? { ...d, tipo: a.tipo } : d)) });
    case 'depRestaurar': {
      const proprias = u.dependencias.filter((d) => d.origem === 'usuario');
      const sug = ctx.seed.dependenciasSugeridas.filter((s) => !proprias.some((p) => p.de === s.de && p.para === s.para));
      return setU(log({ ...u, dependencias: [...sug, ...proprias] }, { tipo: 'dependencia', descricao: 'Dependências sugeridas restauradas (as suas foram mantidas)' }, ctx));
    }
    case 'config': {
      const c = { ...u.config, ...a.valor };
      if (!(c.metaDiariaMin >= 0 && c.metaDiariaMin <= 1440)) throw new ErroAcao('Meta diária inválida.');
      if (!(c.metaSemanalMin >= 0 && c.metaSemanalMin <= 10080)) throw new ErroAcao('Meta semanal inválida.');
      if (!(c.duracaoPadraoMin >= 5 && c.duracaoPadraoMin <= 600)) throw new ErroAcao('Duração padrão deve ficar entre 5 e 600 minutos.');
      if (!c.revisaoDias.length || c.revisaoDias.some((d) => !(d >= 1 && d <= 365))) throw new ErroAcao('Os intervalos de revisão devem ser dias entre 1 e 365.');
      if (c.dataProva && (!/^\d{4}-\d{2}-\d{2}$/.test(c.dataProva) || Number.isNaN(Date.parse(c.dataProva)))) throw new ErroAcao('Data da prova inválida.');
      if (c.fusoHorario !== undefined && !fusoValido(c.fusoHorario)) throw new ErroAcao('Fuso horário desconhecido.');
      return setU(log({ ...u, config: c }, { tipo: 'config', descricao: 'Configurações atualizadas' }, ctx));
    }
    case 'importar': {
      // Backups de versões anteriores não têm fuso horário: assume o padrão.
      const ud = { ...a.dados.user, config: { fusoHorario: FUSO_PADRAO, ...a.dados.user.config } };
      return { ...a.dados, user: log(ud, { tipo: 'importacao', descricao: 'Dados restaurados de um arquivo de backup' }, ctx) };
    }
    case 'reiniciar': {
      const novo = criarDados(ctx.seed, hoje, ctx.agora);
      return { ...novo, user: log(novo.user, { tipo: 'importacao', descricao: 'Todos os dados foram apagados e o plano voltou ao estado inicial' }, ctx) };
    }
  }

  function registrarSessao(base: UserData, s: Sessao, avancar: boolean, novoStatus: Status | null | undefined): AppData {
    let nu: UserData = { ...base, sessoes: tm.upsertSessao(base.sessoes, s) };
    if (avancar && s.cicloItemId) nu = { ...nu, ciclo: cyc.avancar(nu.ciclo, s.cicloItemId) };
    nu = log(nu, { tipo: 'sessao_criada', disciplinaId: s.disciplinaId, topicoId: s.topicoId ?? undefined, descricao: `Sessão de ${nomeD(s.disciplinaId)}: ${s.realizadoMin} min estudados (${s.planejadoMin} planejados)` }, ctx);
    if (s.topicoId) {
      const tid = s.topicoId;
      const e = estadoDe(nu, tid);
      if (novoStatus && novoStatus !== e.status) {
        nu = { ...nu, topicos: { ...nu.topicos, [tid]: aplicarStatus(e, novoStatus, s.data) } };
        nu = log(nu, { tipo: 'status', topicoId: tid, descricao: `${nomeT(tid)}: ${STATUS_LABEL[e.status]} → ${STATUS_LABEL[novoStatus]}` }, ctx);
      } else if (e.status === 'nao_iniciado') {
        nu = { ...nu, topicos: { ...nu.topicos, [tid]: aplicarStatus(e, 'em_andamento', s.data) } };
      }
    }
    return setU(nu);
  }
}
