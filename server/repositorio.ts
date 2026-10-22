import type { AppData, Config, Evento, Prioridade, Sessao, Timer, TopicoEstado, UserData } from '../src/domain/types';
import { FUSO_PADRAO } from '../src/domain/util';
import type { BD } from './sqlite';
import { prep } from './db';

// Conversão entre o documento do domínio (AppData) e as tabelas normalizadas.
// A regra de negócio continua toda em src/domain; aqui só se lê e grava.

type Linha = Record<string, string | number | null>;

export function temDados(db: BD, usuarioId: number): boolean {
  return !!prep(db, 'SELECT 1 FROM configuracoes WHERE usuario_id = ?').get(usuarioId);
}

export function carregarDados(db: BD, usuarioId: number): AppData | null {
  const cfg = prep(db, 'SELECT * FROM configuracoes WHERE usuario_id = ?').get(usuarioId) as Linha | undefined;
  if (!cfg) return null;
  const todas = (sql: string) => prep(db, sql).all(usuarioId) as Linha[];
  const ciclo = prep(db, 'SELECT * FROM ciclos WHERE usuario_id = ?').get(usuarioId) as Linha | undefined;
  const cron = prep(db, 'SELECT * FROM cronometros WHERE usuario_id = ?').get(usuarioId) as Linha | undefined;

  const topicos: Record<string, TopicoEstado> = {};
  for (const r of todas('SELECT * FROM estados_topico WHERE usuario_id = ? ORDER BY topico_id')) topicos[r.topico_id as string] = estadoDeLinha(r);

  const prioridadeDisciplina: Record<string, Prioridade | undefined> = {};
  for (const r of todas('SELECT * FROM prioridades_disciplina WHERE usuario_id = ? ORDER BY disciplina_id')) prioridadeDisciplina[r.disciplina_id as string] = r.prioridade as Prioridade;

  const config: Config = {
    metaDiariaMin: cfg.meta_diaria_min as number,
    metaSemanalMin: cfg.meta_semanal_min as number,
    duracaoPadraoMin: cfg.duracao_padrao_min as number,
    revisaoDias: JSON.parse(cfg.revisao_dias as string),
    dataProva: cfg.data_prova as string,
    fusoHorario: cfg.fuso_horario as string,
  };

  const user: UserData = {
    topicos,
    prioridadeDisciplina,
    ciclo: {
      itens: todas('SELECT * FROM ciclo_itens WHERE usuario_id = ? ORDER BY posicao').map((r) => ({
        id: r.id as string,
        disciplinaId: r.disciplina_id as string,
        minutos: r.minutos as number,
        ativo: r.ativo === 1,
      })),
      proximoItemId: (ciclo?.proximo_item_id as string | null) ?? null,
      numero: (ciclo?.numero as number) ?? 1,
    },
    dependencias: todas('SELECT * FROM dependencias WHERE usuario_id = ? ORDER BY posicao').map((r) => ({
      id: r.id as string,
      de: r.de_topico as string,
      para: r.para_topico as string,
      tipo: r.tipo as 'obrigatorio' | 'recomendado',
      origem: r.origem as 'sugestao' | 'usuario',
    })),
    sessoes: todas('SELECT * FROM sessoes_estudo WHERE usuario_id = ? ORDER BY seq').map(sessaoDeLinha),
    timer: cron ? timerDeLinha(cron) : null,
    config,
    historico: todas('SELECT * FROM historico WHERE usuario_id = ? ORDER BY seq DESC').map(eventoDeLinha),
  };
  return { schemaVersion: 1, seedVersion: cfg.seed_versao as number, user };
}

function estadoDeLinha(r: Linha): TopicoEstado {
  const e: TopicoEstado = { status: r.status as TopicoEstado['status'], dominado: r.dominado === 1, notas: r.notas as string, revisoesFeitas: r.revisoes_feitas as number };
  if (r.prioridade) e.prioridade = r.prioridade as Prioridade;
  if (r.concluido_em) e.concluidoEm = r.concluido_em as string;
  if (r.ultimo_estudo) e.ultimoEstudo = r.ultimo_estudo as string;
  return e;
}

function sessaoDeLinha(r: Linha): Sessao {
  return {
    id: r.id as string,
    data: r.data as string,
    disciplinaId: r.disciplina_id as string,
    topicoId: (r.topico_id as string | null) ?? null,
    planejadoMin: r.planejado_min as number,
    realizadoMin: r.realizado_min as number,
    notas: r.notas as string,
    origem: r.origem as Sessao['origem'],
    cicloItemId: (r.ciclo_item_id as string | null) ?? null,
    criadoEm: r.criado_em as string,
    atualizadoEm: r.atualizado_em as string,
  };
}

function timerDeLinha(r: Linha): Timer {
  return {
    id: r.id as string,
    disciplinaId: r.disciplina_id as string,
    topicoId: (r.topico_id as string | null) ?? null,
    cicloItemId: (r.ciclo_item_id as string | null) ?? null,
    planejadoMin: r.planejado_min as number,
    iniciadoEm: r.iniciado_em as number,
    acumuladoMs: r.acumulado_ms as number,
    rodandoDesde: (r.rodando_desde as number | null) ?? null,
  };
}

function eventoDeLinha(r: Linha): Evento {
  const e: Evento = { id: r.id as string, ts: r.ts as string, tipo: r.tipo as Evento['tipo'], descricao: r.descricao as string };
  if (r.topico_id) e.topicoId = r.topico_id as string;
  if (r.disciplina_id) e.disciplinaId = r.disciplina_id as string;
  return e;
}

const TABELAS_USUARIO = ['historico', 'cronometros', 'sessoes_estudo', 'dependencias', 'prioridades_disciplina', 'estados_topico', 'ciclo_itens', 'ciclos', 'configuracoes'];

// Grava o novo estado. Com `antes`, grava só a diferença; sem ele (primeira gravação,
// importação ou reinício), substitui todos os dados de estudo do usuário.
// Deve ser chamada dentro de uma transação.
export function gravarDados(db: BD, usuarioId: number, antes: AppData | null, depois: AppData): void {
  if (!antes) for (const t of TABELAS_USUARIO) prep(db, `DELETE FROM ${t} WHERE usuario_id = ?`).run(usuarioId);
  const a = antes?.user;
  const u = depois.user;
  const json = JSON.stringify;

  // Configurações e ciclo (uma linha por usuário)
  if (!a || json(a.config) !== json(u.config) || antes!.seedVersion !== depois.seedVersion) {
    const c = u.config;
    prep(db, `INSERT INTO configuracoes (usuario_id, meta_diaria_min, meta_semanal_min, duracao_padrao_min, revisao_dias, data_prova, fuso_horario, schema_dados, seed_versao)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(usuario_id) DO UPDATE SET meta_diaria_min = excluded.meta_diaria_min, meta_semanal_min = excluded.meta_semanal_min, duracao_padrao_min = excluded.duracao_padrao_min,
        revisao_dias = excluded.revisao_dias, data_prova = excluded.data_prova, fuso_horario = excluded.fuso_horario, schema_dados = excluded.schema_dados, seed_versao = excluded.seed_versao`)
      .run(usuarioId, c.metaDiariaMin, c.metaSemanalMin, c.duracaoPadraoMin, json(c.revisaoDias), c.dataProva ?? '', c.fusoHorario ?? FUSO_PADRAO, depois.schemaVersion, depois.seedVersion);
  }
  if (!a || a.ciclo.proximoItemId !== u.ciclo.proximoItemId || a.ciclo.numero !== u.ciclo.numero) {
    prep(db, `INSERT INTO ciclos (usuario_id, proximo_item_id, numero) VALUES (?, ?, ?)
      ON CONFLICT(usuario_id) DO UPDATE SET proximo_item_id = excluded.proximo_item_id, numero = excluded.numero`).run(usuarioId, u.ciclo.proximoItemId, u.ciclo.numero);
  }
  if (!a || json(a.timer) !== json(u.timer)) {
    prep(db, 'DELETE FROM cronometros WHERE usuario_id = ?').run(usuarioId);
    const t = u.timer;
    if (t)
      prep(db, 'INSERT INTO cronometros (usuario_id, id, disciplina_id, topico_id, ciclo_item_id, planejado_min, iniciado_em, acumulado_ms, rodando_desde) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(usuarioId, t.id, t.disciplinaId, t.topicoId, t.cicloItemId, t.planejadoMin, t.iniciadoEm, t.acumuladoMs, t.rodandoDesde);
  }

  // Itens do ciclo (a posição faz parte da linha: reordenar atualiza só o que mudou de lugar)
  sincronizar(
    mapa(a?.ciclo.itens ?? [], (i, k) => [i.id, { ...i, posicao: k }]),
    mapa(u.ciclo.itens, (i, k) => [i.id, { ...i, posicao: k }]),
    (id, i) => prep(db, `INSERT INTO ciclo_itens (usuario_id, id, posicao, disciplina_id, minutos, ativo) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(usuario_id, id) DO UPDATE SET posicao = excluded.posicao, disciplina_id = excluded.disciplina_id, minutos = excluded.minutos, ativo = excluded.ativo`)
      .run(usuarioId, id, i.posicao, i.disciplinaId, i.minutos, i.ativo ? 1 : 0),
    (id) => prep(db, 'DELETE FROM ciclo_itens WHERE usuario_id = ? AND id = ?').run(usuarioId, id),
  );

  // Pré-requisitos (a ordem importa: define qual base é recomendada primeiro)
  sincronizar(
    mapa(a?.dependencias ?? [], (d, k) => [d.id, { ...d, posicao: k }]),
    mapa(u.dependencias, (d, k) => [d.id, { ...d, posicao: k }]),
    (id, d) => prep(db, `INSERT INTO dependencias (usuario_id, id, posicao, de_topico, para_topico, tipo, origem) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(usuario_id, id) DO UPDATE SET posicao = excluded.posicao, de_topico = excluded.de_topico, para_topico = excluded.para_topico, tipo = excluded.tipo, origem = excluded.origem`)
      .run(usuarioId, id, d.posicao, d.de, d.para, d.tipo, d.origem),
    (id) => prep(db, 'DELETE FROM dependencias WHERE usuario_id = ? AND id = ?').run(usuarioId, id),
  );

  // Situação dos conteúdos
  sincronizar(
    new Map(Object.entries(a?.topicos ?? {})),
    new Map(Object.entries(u.topicos)),
    (id, e) => prep(db, `INSERT INTO estados_topico (usuario_id, topico_id, status, dominado, prioridade, notas, concluido_em, ultimo_estudo, revisoes_feitas) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(usuario_id, topico_id) DO UPDATE SET status = excluded.status, dominado = excluded.dominado, prioridade = excluded.prioridade, notas = excluded.notas,
        concluido_em = excluded.concluido_em, ultimo_estudo = excluded.ultimo_estudo, revisoes_feitas = excluded.revisoes_feitas`)
      .run(usuarioId, id, e.status, e.dominado ? 1 : 0, e.prioridade ?? null, e.notas ?? '', e.concluidoEm ?? null, e.ultimoEstudo ?? null, e.revisoesFeitas ?? 0),
    (id) => prep(db, 'DELETE FROM estados_topico WHERE usuario_id = ? AND topico_id = ?').run(usuarioId, id),
  );

  sincronizar(
    new Map(Object.entries(a?.prioridadeDisciplina ?? {}).filter(([, p]) => p)),
    new Map(Object.entries(u.prioridadeDisciplina).filter(([, p]) => p)),
    (id, p) => prep(db, `INSERT INTO prioridades_disciplina (usuario_id, disciplina_id, prioridade) VALUES (?, ?, ?)
      ON CONFLICT(usuario_id, disciplina_id) DO UPDATE SET prioridade = excluded.prioridade`).run(usuarioId, id, p as string),
    (id) => prep(db, 'DELETE FROM prioridades_disciplina WHERE usuario_id = ? AND disciplina_id = ?').run(usuarioId, id),
  );

  // Sessões de estudo: as novas recebem um seq crescente, mantendo a ordem de inclusão.
  let seqS = proximoSeq(db, 'sessoes_estudo', usuarioId);
  const sAntes = mapa(a?.sessoes ?? [], (s) => [s.id, s]);
  sincronizar(
    sAntes,
    mapa(u.sessoes, (s) => [s.id, s]),
    (id, s) => {
      const params = [s.data, s.disciplinaId, s.topicoId, s.planejadoMin, s.realizadoMin, s.notas ?? '', s.origem, s.cicloItemId, s.criadoEm, s.atualizadoEm] as const;
      if (sAntes.has(id))
        prep(db, `UPDATE sessoes_estudo SET data = ?, disciplina_id = ?, topico_id = ?, planejado_min = ?, realizado_min = ?, notas = ?, origem = ?, ciclo_item_id = ?, criado_em = ?, atualizado_em = ?
          WHERE usuario_id = ? AND id = ?`).run(...params, usuarioId, id);
      else
        prep(db, `INSERT INTO sessoes_estudo (data, disciplina_id, topico_id, planejado_min, realizado_min, notas, origem, ciclo_item_id, criado_em, atualizado_em, usuario_id, id, seq)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(...params, usuarioId, id, seqS++);
    },
    (id) => prep(db, 'DELETE FROM sessoes_estudo WHERE usuario_id = ? AND id = ?').run(usuarioId, id),
  );

  // Histórico: a lista vem do mais novo para o mais antigo; os novos recebem seq a partir do mais antigo.
  let seqH = proximoSeq(db, 'historico', usuarioId);
  const hAntes = mapa(a?.historico ?? [], (e) => [e.id, e]);
  const hNovo = mapa([...u.historico].reverse(), (e) => [e.id, e]);
  sincronizar(
    hAntes,
    hNovo,
    (id, e) => {
      if (hAntes.has(id))
        prep(db, 'UPDATE historico SET ts = ?, tipo = ?, descricao = ?, topico_id = ?, disciplina_id = ? WHERE usuario_id = ? AND id = ?')
          .run(e.ts, e.tipo, e.descricao, e.topicoId ?? null, e.disciplinaId ?? null, usuarioId, id);
      else
        prep(db, 'INSERT INTO historico (usuario_id, id, seq, ts, tipo, descricao, topico_id, disciplina_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .run(usuarioId, id, seqH++, e.ts, e.tipo, e.descricao, e.topicoId ?? null, e.disciplinaId ?? null);
    },
    (id) => prep(db, 'DELETE FROM historico WHERE usuario_id = ? AND id = ?').run(usuarioId, id),
  );
}

function mapa<T, V>(lista: T[], f: (x: T, i: number) => [string, V]): Map<string, V> {
  return new Map(lista.map((x, i) => f(x, i)));
}

function sincronizar<V>(antes: Map<string, V>, depois: Map<string, V>, gravar: (id: string, v: V) => void, remover: (id: string) => void): void {
  for (const id of antes.keys()) if (!depois.has(id)) remover(id);
  for (const [id, v] of depois) {
    const velho = antes.get(id);
    if (velho === undefined || JSON.stringify(velho) !== JSON.stringify(v)) gravar(id, v);
  }
}

function proximoSeq(db: BD, tabela: 'sessoes_estudo' | 'historico', usuarioId: number): number {
  const r = prep(db, `SELECT COALESCE(MAX(seq), 0) AS m FROM ${tabela} WHERE usuario_id = ?`).get(usuarioId) as { m: number };
  return r.m + 1;
}
