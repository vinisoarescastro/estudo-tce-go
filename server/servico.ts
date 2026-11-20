import type { AppData, Prioridade, Seed, Status, TopicoEstado } from '../src/domain/types';
import { ESTADO_PADRAO } from '../src/domain/progress';
import { prioridadeTopico } from '../src/domain/cycle';
import { reduzir, ErroAcao, type Acao } from '../src/domain/actions';
import { criarDados } from '../src/domain/defaults';
import { validarAppData } from '../src/domain/validate';
import { definirFuso, isoDia, uid } from '../src/domain/util';
import type { BD } from './sqlite';
import { prep, transacao } from './db';
import { carregarDados, gravarDados } from './repositorio';
import { lerEquivalencias, type MapaEquivalencias } from './equivalencias';

// Camada de negócio do servidor: aplica as mesmas ações do domínio (src/domain/actions.ts)
// que a interface usa e grava o resultado no banco, numa transação.

const ACOES = new Set<Acao['t']>([
  'status', 'dominado', 'prioridade', 'prioridadeDisciplina', 'notas', 'revisao', 'topicoPular',
  'cicloMover', 'cicloMinutos', 'cicloAtivo', 'cicloAdicionar', 'cicloRemover', 'cicloDistribuicao', 'cicloProximo', 'cicloPular',
  'timerIniciar', 'timerPausar', 'timerRetomar', 'timerDescartar', 'timerFinalizar',
  'sessaoSalvar', 'sessaoExcluir', 'depAdicionar', 'depRemover', 'depTipo', 'depRestaurar', 'config', 'importar', 'reiniciar',
]);

// Ações que substituem todos os dados: gravadas por inteiro, com cópia de segurança antes.
export const ACOES_SUBSTITUTIVAS = new Set<Acao['t']>(['importar', 'reiniciar']);

// O cliente pode informar o horário e os ids que usou ao aplicar a ação localmente.
// O servidor aceita se forem plausíveis, para que os dois estados fiquem idênticos.
const TOLERANCIA_RELOGIO_MS = 5 * 60_000;
const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;

interface Cache { versao: number; dados: AppData }

// Edital em que a conta está inscrita (ativa), com o nome para a interface.
export interface EditalConta { cargoId: string; codigo: string; nomeCurto: string; concursoId: string; principal: boolean }

// Conteúdo equivalente em outro edital da conta, como a tela mostra.
export interface EquivalenteTela { cargoId: string; topicoId: string; titulo: string; prioridade: Prioridade; status: Status }

// Campos de progresso que valem para os conteúdos equivalentes. Prioridade e "pular" são de cada edital.
type Progresso = Pick<TopicoEstado, 'status' | 'dominado' | 'notas' | 'revisoesFeitas' | 'concluidoEm' | 'ultimoEstudo'>;
function progressoDe(e: TopicoEstado | undefined): Progresso {
  const x = e ?? ESTADO_PADRAO;
  return { status: x.status, dominado: x.dominado, notas: x.notas, revisoesFeitas: x.revisoesFeitas, concluidoEm: x.concluidoEm, ultimoEstudo: x.ultimoEstudo };
}
const mesmoProgresso = (a: Progresso, b: Progresso) =>
  a.status === b.status && a.dominado === b.dominado && a.notas === b.notas && a.revisoesFeitas === b.revisoesFeitas && a.concluidoEm === b.concluidoEm && a.ultimoEstudo === b.ultimoEstudo;
// Aplica o progresso sobre o estado do conteúdo no outro edital, mantendo a prioridade e o "pular" de lá.
function comProgresso(destino: TopicoEstado | undefined, p: Progresso): TopicoEstado {
  const e: TopicoEstado = { ...(destino ?? ESTADO_PADRAO), status: p.status, dominado: p.dominado, notas: p.notas, revisoesFeitas: p.revisoesFeitas };
  if (p.concluidoEm) e.concluidoEm = p.concluidoEm;
  else delete e.concluidoEm;
  if (p.ultimoEstudo) e.ultimoEstudo = p.ultimoEstudo;
  else delete e.ultimoEstudo;
  return e;
}
const RANK_STATUS: Record<Status, number> = { nao_iniciado: 0, em_andamento: 1, estudado: 2, em_revisao: 3 };

export class ServicoDados {
  // Um documento por conta e edital: a chave do cache é "usuario:cargo".
  private cache = new Map<string, Cache>();
  private equivalencias: MapaEquivalencias;
  // `seeds`: o edital verticalizado de cada cargo, por id do cargo. As equivalências entre editais são
  // lidas do banco (gravadas por prepararEditais).
  constructor(private db: BD, private seeds: Record<string, Seed>) {
    this.equivalencias = lerEquivalencias(db);
  }

  // Edital principal da conta (o cargo com que ela foi criada, ou o escolhido depois pelo administrador).
  principal(usuarioId: number): string {
    const r = prep(this.db, 'SELECT cargo_id FROM usuarios WHERE id = ?').get(usuarioId) as { cargo_id: string } | undefined;
    if (!r) throw new Error(`Usuário ${usuarioId} não encontrado.`);
    return r.cargo_id;
  }

  // Editais ativos da conta, o principal primeiro.
  editais(usuarioId: number): EditalConta[] {
    const principal = this.principal(usuarioId);
    const linhas = prep(this.db, `SELECT i.cargo_id, c.codigo, c.nome_curto, c.concurso_id FROM inscricoes i JOIN cargos c ON c.id = i.cargo_id
      WHERE i.usuario_id = ? AND i.ativa = 1 ORDER BY i.criada_em, i.cargo_id`).all(usuarioId) as { cargo_id: string; codigo: string; nome_curto: string; concurso_id: string }[];
    return linhas
      .map((r) => ({ cargoId: r.cargo_id, codigo: r.codigo, nomeCurto: r.nome_curto, concursoId: r.concurso_id, principal: r.cargo_id === principal }))
      .sort((a, b) => Number(b.principal) - Number(a.principal));
  }

  inscrito(usuarioId: number, cargoId: string): boolean {
    return !!prep(this.db, 'SELECT 1 FROM inscricoes WHERE usuario_id = ? AND cargo_id = ? AND ativa = 1').get(usuarioId, cargoId);
  }

  // Edital em que a requisição trabalha: o pedido (se a conta estiver inscrita nele) ou o principal.
  editalDe(usuarioId: number, pedido?: string | null): string {
    if (!pedido) return this.principal(usuarioId);
    if (!this.inscrito(usuarioId, pedido)) throw new ErroEdital(pedido);
    return pedido;
  }

  seedDe(usuarioId: number, cargoId = this.principal(usuarioId)): Seed {
    const seed = this.seeds[cargoId];
    if (!seed) throw new Error(`Cargo sem edital carregado: ${cargoId} (usuário ${usuarioId}).`);
    return seed;
  }

  // A versão é da conta (sobe a cada alteração em qualquer edital). Um cliente com a versão de antes de
  // uma mudança em outro edital recebe os dados completos, o que é sempre seguro.
  versao(usuarioId: number): number {
    return (prep(this.db, 'SELECT versao_dados FROM usuarios WHERE id = ?').get(usuarioId) as { versao_dados: number } | undefined)?.versao_dados ?? 0;
  }

  // Lê os dados da conta no edital; na primeira vez, cria o plano inicial desse edital.
  obter(usuarioId: number, cargoId = this.principal(usuarioId)): Cache {
    const v = this.versao(usuarioId);
    const chave = `${usuarioId}:${cargoId}`;
    const c = this.cache.get(chave);
    if (c && c.versao === v) return c;
    let dados = carregarDados(this.db, usuarioId, cargoId);
    if (!dados) {
      definirFuso(null);
      dados = criarDados(this.seedDe(usuarioId, cargoId));
      // O fuso horário é da pessoa: um edital novo herda o que ela já usa nos outros.
      const fuso = prep(this.db, 'SELECT fuso_horario FROM configuracoes WHERE usuario_id = ? ORDER BY cargo_id = (SELECT cargo_id FROM usuarios WHERE id = ?) DESC LIMIT 1')
        .get(usuarioId, usuarioId) as { fuso_horario: string } | undefined;
      if (fuso) dados = { ...dados, user: { ...dados.user, config: { ...dados.user.config, fusoHorario: fuso.fuso_horario } } };
      dados = this.herdarProgresso(usuarioId, cargoId, dados);
      const d = dados;
      transacao(this.db, () => {
        gravarDados(this.db, usuarioId, cargoId, null, d);
        prep(this.db, 'UPDATE usuarios SET versao_dados = versao_dados + 1 WHERE id = ?').run(usuarioId);
      });
      return this.obter(usuarioId, cargoId);
    }
    const novo = { versao: v, dados };
    this.cache.set(chave, novo);
    return novo;
  }

  // Leitura para o acompanhamento do administrador: nunca cria o plano inicial de quem ainda não entrou.
  lerSemCriar(usuarioId: number, cargoId = this.principal(usuarioId)): AppData | null {
    const c = this.cache.get(`${usuarioId}:${cargoId}`);
    if (c && c.versao === this.versao(usuarioId)) return c.dados;
    return carregarDados(this.db, usuarioId, cargoId);
  }

  // Cronômetro da conta em outro edital (a conta tem um só cronômetro).
  cronometroEmOutro(usuarioId: number, cargoId: string): { cargoId: string; nomeCurto: string; rodando: boolean } | null {
    const r = prep(this.db, 'SELECT t.cargo_id, t.rodando_desde, c.nome_curto FROM cronometros t JOIN cargos c ON c.id = t.cargo_id WHERE t.usuario_id = ? AND t.cargo_id <> ?')
      .get(usuarioId, cargoId) as { cargo_id: string; rodando_desde: number | null; nome_curto: string } | undefined;
    return r ? { cargoId: r.cargo_id, nomeCurto: r.nome_curto, rodando: r.rodando_desde !== null } : null;
  }

  // Aplica uma ação no documento do edital. Devolve a nova versão e, quando o resultado pode diferir do que o
  // cliente calculou (versão desatualizada, ids ou relógio recusados), os dados completos.
  aplicar(
    usuarioId: number,
    cargoId: string,
    entrada: { acao: unknown; versaoBase?: unknown; agora?: unknown; ids?: unknown },
    antesDeSubstituir?: () => void,
  ): { versao: number; dados?: AppData; alterou: boolean } {
    const acao = entrada.acao as Acao;
    if (!acao || typeof acao !== 'object' || !ACOES.has(acao.t)) throw new ErroAcao('Ação desconhecida.');
    const seed = this.seedDe(usuarioId, cargoId);
    if (acao.t === 'importar') {
      const erros = validarAppData(acao.dados, seed);
      if (erros.length) throw new ErroAcao(`Arquivo recusado: ${erros.slice(0, 3).join(' ')}${erros.length > 3 ? ` (+${erros.length - 3} problemas)` : ''}`);
    }
    if (acao.t === 'timerIniciar') {
      const outro = this.cronometroEmOutro(usuarioId, cargoId);
      if (outro) throw new ErroAcao(`Já há um cronômetro em andamento no edital ${outro.nomeCurto}. Finalize ou descarte esse cronômetro antes de iniciar outro.`);
    }
    const atual = this.obter(usuarioId, cargoId);
    let divergiu = entrada.versaoBase !== atual.versao;

    const agoraServidor = Date.now();
    let agora = agoraServidor;
    if (typeof entrada.agora === 'number' && Math.abs(entrada.agora - agoraServidor) <= TOLERANCIA_RELOGIO_MS) agora = entrada.agora;
    else if (entrada.agora !== undefined) divergiu = true;

    const usados = idsExistentes(atual.dados);
    const fila = Array.isArray(entrada.ids) ? entrada.ids.slice(0, 50) : [];
    const gerarId = (prefixo: string) => {
      const proposto = fila.shift();
      if (typeof proposto === 'string' && ID_VALIDO.test(proposto) && proposto.startsWith(prefixo) && !usados.has(proposto)) {
        usados.add(proposto);
        return proposto;
      }
      divergiu = true;
      const id = uid(prefixo);
      usados.add(id);
      return id;
    };

    definirFuso(atual.dados.user.config.fusoHorario);
    const novo = reduzir(atual.dados, acao, { seed, agora, gerarId });
    if (novo === atual.dados) return { versao: atual.versao, alterou: false, dados: divergiu ? atual.dados : undefined };

    const substitui = ACOES_SUBSTITUTIVAS.has(acao.t);
    if (substitui) antesDeSubstituir?.();
    // Importar e reiniciar substituem o edital inteiro e não mexem nos outros editais.
    const copias = substitui ? [] : this.copiasDeProgresso(usuarioId, cargoId, atual.dados, novo);
    const versao = transacao(this.db, () => {
      gravarDados(this.db, usuarioId, cargoId, substitui ? null : atual.dados, novo);
      for (const c of copias) gravarDados(this.db, usuarioId, c.cargoId, c.antes, c.depois);
      prep(this.db, 'UPDATE usuarios SET versao_dados = versao_dados + 1, atualizado_em = ? WHERE id = ?').run(new Date().toISOString(), usuarioId);
      return this.versao(usuarioId);
    });
    this.cache.set(`${usuarioId}:${cargoId}`, { versao, dados: novo });
    for (const c of copias) this.cache.set(`${usuarioId}:${c.cargoId}`, { versao, dados: c.depois });
    return { versao, alterou: true, dados: divergiu || substitui ? novo : undefined };
  }

  // Conteúdos cujo progresso mudou nesta ação, levados aos equivalentes nos outros editais ativos da conta.
  private copiasDeProgresso(usuarioId: number, cargoId: string, antes: AppData, depois: AppData): { cargoId: string; antes: AppData; depois: AppData }[] {
    if (!this.equivalencias.size) return [];
    const outros = new Set(this.editais(usuarioId).map((e) => e.cargoId).filter((c) => c !== cargoId));
    if (!outros.size) return [];
    const porCargo = new Map<string, Map<string, Progresso>>();
    for (const id of new Set([...Object.keys(antes.user.topicos), ...Object.keys(depois.user.topicos)])) {
      const p = progressoDe(depois.user.topicos[id]);
      if (mesmoProgresso(progressoDe(antes.user.topicos[id]), p)) continue;
      for (const eq of this.equivalencias.get(id) ?? []) {
        if (!outros.has(eq.cargoId)) continue;
        if (!porCargo.has(eq.cargoId)) porCargo.set(eq.cargoId, new Map());
        porCargo.get(eq.cargoId)!.set(eq.topicoId, p);
      }
    }
    const copias: { cargoId: string; antes: AppData; depois: AppData }[] = [];
    for (const [cargo, mudancas] of porCargo) {
      const doc = this.obter(usuarioId, cargo).dados;
      const topicos = { ...doc.user.topicos };
      let mudou = false;
      for (const [tid, p] of mudancas) {
        if (mesmoProgresso(progressoDe(topicos[tid]), p)) continue;
        topicos[tid] = comProgresso(topicos[tid], p);
        mudou = true;
      }
      if (mudou) copias.push({ cargoId: cargo, antes: doc, depois: { ...doc, user: { ...doc.user, topicos } } });
    }
    return copias;
  }

  // Plano novo de um edital: cada conteúdo com equivalente já estudado em outro edital ativo da conta
  // começa com esse progresso (o mais avançado, se houver mais de um).
  private herdarProgresso(usuarioId: number, cargoId: string, dados: AppData): AppData {
    if (!this.equivalencias.size) return dados;
    const outros = this.editais(usuarioId).map((e) => e.cargoId).filter((c) => c !== cargoId);
    const docs = new Map<string, AppData>();
    for (const c of outros) {
      const d = carregarDados(this.db, usuarioId, c);
      if (d) docs.set(c, d);
    }
    if (!docs.size) return dados;
    const topicos = { ...dados.user.topicos };
    let mudou = false;
    for (const t of this.seedDe(usuarioId, cargoId).topicos) {
      let melhor: Progresso | null = null;
      for (const eq of this.equivalencias.get(t.id) ?? []) {
        const e = docs.get(eq.cargoId)?.user.topicos[eq.topicoId];
        if (!e) continue;
        const p = progressoDe(e);
        if (!melhor || RANK_STATUS[p.status] > RANK_STATUS[melhor.status] || (RANK_STATUS[p.status] === RANK_STATUS[melhor.status] && (p.ultimoEstudo ?? '') > (melhor.ultimoEstudo ?? ''))) melhor = p;
      }
      if (melhor && !mesmoProgresso(progressoDe(topicos[t.id]), melhor)) {
        topicos[t.id] = comProgresso(topicos[t.id], melhor);
        mudou = true;
      }
    }
    return mudou ? { ...dados, user: { ...dados.user, topicos } } : dados;
  }

  // Para a tela: os equivalentes de cada conteúdo do edital nos outros editais ativos da conta, com a
  // prioridade e a situação de lá. Não cria o plano de um edital que a pessoa ainda não abriu.
  equivalentes(usuarioId: number, cargoId: string): Record<string, EquivalenteTela[]> {
    const outros = new Set(this.editais(usuarioId).map((e) => e.cargoId).filter((c) => c !== cargoId));
    const out: Record<string, EquivalenteTela[]> = {};
    if (!outros.size || !this.equivalencias.size) return out;
    const docs = new Map<string, AppData | null>();
    for (const t of this.seedDe(usuarioId, cargoId).topicos) {
      for (const eq of this.equivalencias.get(t.id) ?? []) {
        if (!outros.has(eq.cargoId)) continue;
        if (!docs.has(eq.cargoId)) docs.set(eq.cargoId, this.lerSemCriar(usuarioId, eq.cargoId));
        const top = this.seeds[eq.cargoId]?.topicos.find((x) => x.id === eq.topicoId);
        if (!top) continue;
        const user = docs.get(eq.cargoId)?.user;
        (out[t.id] ??= []).push({
          cargoId: eq.cargoId,
          topicoId: eq.topicoId,
          titulo: top.titulo,
          prioridade: user ? prioridadeTopico(top, user) : top.prioridadePlanilha,
          status: (user?.topicos[eq.topicoId] ?? ESTADO_PADRAO).status,
        });
      }
    }
    return out;
  }

  hoje(usuarioId: number, cargoId = this.principal(usuarioId)): string {
    definirFuso(this.obter(usuarioId, cargoId).dados.user.config.fusoHorario);
    return isoDia();
  }
}

// O edital pedido não está entre os editais ativos da conta (foi retirado, ou nunca esteve).
export class ErroEdital extends Error {
  constructor(public cargoId: string) {
    super(`O edital ${cargoId} não está disponível nesta conta. Recarregue a página.`);
  }
}

function idsExistentes(d: AppData): Set<string> {
  const u = d.user;
  const s = new Set<string>();
  for (const x of u.sessoes) s.add(x.id);
  for (const x of u.historico) s.add(x.id);
  for (const x of u.dependencias) s.add(x.id);
  for (const x of u.ciclo.itens) s.add(x.id);
  if (u.timer) s.add(u.timer.id);
  return s;
}
