import { createServer, type Server } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import seedJson from '../src/data/seed.json';
import seedIfgJson from '../src/data/seed-ifg308.json';
import type { Seed } from '../src/domain/types';
import { abrirBanco, migrar, MIGRACOES } from './db';
import { prepararEditais } from './cargos';
import { sincronizarEdital } from './edital';
import { carregarDados } from './repositorio';
import { criarApp, VALOR_CSRF } from './app';
import { lerConfig } from './config';
import * as auth from './auth';
import { configurarLog } from './log';
import { DatabaseSync, type BD } from './sqlite';

const seed = seedJson as unknown as Seed;
const seedIfg = seedIfgJson as unknown as Seed;
configurarLog('erro', true);

describe('migração 6: inscrições e dados por edital', () => {
  test('os dados de estudo existentes passam inteiros para o edital da conta, e cada conta ganha a sua inscrição', () => {
    const db: BD = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON');
    db.exec('CREATE TABLE schema_migracoes (versao INTEGER PRIMARY KEY, nome TEXT NOT NULL, aplicada_em TEXT NOT NULL)');
    for (const m of MIGRACOES.filter((x) => x.versao <= 5)) {
      db.exec(m.sql);
      db.prepare('INSERT INTO schema_migracoes VALUES (?, ?, ?)').run(m.versao, m.nome, 'antes');
    }
    // Banco como está em produção antes desta versão: editais gravados e uma conta B02 com dados de todos os tipos.
    for (const x of [seed, seedIfg]) sincronizarEdital(db, x);
    const agora = '2026-11-20T10:00:00.000Z';
    db.prepare("INSERT INTO usuarios (email, senha_hash, senha_alterada_em, criado_em, atualizado_em, versao_dados, cargo_id) VALUES ('b@x.com', 'h', ?, ?, ?, 9, 'B02')").run(agora, agora, agora);
    db.exec(`
      INSERT INTO configuracoes VALUES (1, 300, 1800, 60, '[1,7,30]', '2027-01-17', 'America/Manaus', 1, 1);
      INSERT INTO ciclos VALUES (1, 'ci02', 3);
      INSERT INTO ciclo_itens VALUES (1, 'ci01', 0, 'es', 90, 1), (1, 'ci02', 1, 'lp', 60, 0);
      INSERT INTO estados_topico (usuario_id, topico_id, status, dominado, prioridade, notas, concluido_em, ultimo_estudo, revisoes_feitas, pulado_item_id, pulado_volta)
        VALUES (1, 't001', 'estudado', 1, 'Urgente', 'minha nota', '2026-11-01', '2026-11-02', 2, 'ci01', 3);
      INSERT INTO prioridades_disciplina VALUES (1, 'lp', 'Alta');
      INSERT INTO dependencias VALUES (1, 'd-52-53', 0, 't052', 't053', 'recomendado', 'sugestao');
      INSERT INTO sessoes_estudo (usuario_id, id, seq, data, disciplina_id, topico_id, planejado_min, realizado_min, notas, origem, ciclo_item_id, criado_em, atualizado_em)
        VALUES (1, 's-1', 1, '2026-11-02', 'lp', 't001', 60, 55, 'sessão antiga', 'manual', 'ci02', '${agora}', '${agora}');
      INSERT INTO cronometros VALUES (1, 'tm-1', 'es', NULL, 'ci01', 90, 1000, 5000, NULL);
      INSERT INTO historico VALUES (1, 'ev-inicio', 1, '${agora}', 'importacao', 'Plano criado', NULL, NULL);
    `);

    expect(migrar(db)).toEqual([6]);

    expect(db.prepare('SELECT usuario_id, cargo_id, ativa FROM inscricoes').all()).toMatchObject([{ usuario_id: 1, cargo_id: 'B02', ativa: 1 }]);
    expect(db.prepare('SELECT versao_dados FROM usuarios').get()).toMatchObject({ versao_dados: 9 });
    const d = carregarDados(db, 1, 'B02')!;
    expect(d.user.config).toEqual({ metaDiariaMin: 300, metaSemanalMin: 1800, duracaoPadraoMin: 60, revisaoDias: [1, 7, 30], dataProva: '2027-01-17', fusoHorario: 'America/Manaus' });
    expect(d.user.ciclo).toEqual({ itens: [{ id: 'ci01', disciplinaId: 'es', minutos: 90, ativo: true }, { id: 'ci02', disciplinaId: 'lp', minutos: 60, ativo: false }], proximoItemId: 'ci02', numero: 3 });
    expect(d.user.topicos.t001).toEqual({ status: 'estudado', dominado: true, prioridade: 'Urgente', notas: 'minha nota', concluidoEm: '2026-11-01', ultimoEstudo: '2026-11-02', revisoesFeitas: 2, pulado: { itemId: 'ci01', volta: 3 } });
    expect(d.user.prioridadeDisciplina).toEqual({ lp: 'Alta' });
    expect(d.user.dependencias).toEqual([{ id: 'd-52-53', de: 't052', para: 't053', tipo: 'recomendado', origem: 'sugestao' }]);
    expect(d.user.sessoes).toMatchObject([{ id: 's-1', realizadoMin: 55, notas: 'sessão antiga', cicloItemId: 'ci02' }]);
    expect(d.user.timer).toMatchObject({ id: 'tm-1', disciplinaId: 'es', acumuladoMs: 5000 });
    expect(d.user.historico).toMatchObject([{ id: 'ev-inicio', descricao: 'Plano criado' }]);
    // No outro edital, a conta ainda não tem nada.
    expect(carregarDados(db, 1, 'IFG308')).toBeNull();
    expect(migrar(db)).toEqual([]);
    db.close();
  });
});

describe('conta inscrita em dois editais (API)', () => {
  let pasta: string;
  let db: BD;
  let srv: Server;
  let base: string;

  beforeAll(async () => {
    pasta = mkdtempSync(join(tmpdir(), 'estudo-inscricoes-'));
    db = abrirBanco(join(pasta, 'estudo.db'));
    const cfg = { ...lerConfig({}), cookieSeguro: false, pastaDados: pasta, pastaBackups: join(pasta, 'backups'), pastaWeb: join(pasta, 'web') };
    srv = createServer(criarApp(db, prepararEditais(db).porCargo, cfg));
    await new Promise<void>((ok) => srv.listen(0, '127.0.0.1', ok));
    base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
    await auth.criarUsuario(db, { email: 'gestor@exemplo.com', nome: 'Admin', senha: 'cofre-de-aco-1234', cargoId: 'B02', papel: 'admin' });
    await auth.criarUsuario(db, { email: 'pessoa@exemplo.com', nome: 'Comum', senha: 'senha-comum-123456', cargoId: 'A01' });
  });
  afterAll(async () => {
    await new Promise((ok) => srv.close(ok));
    db.close();
    rmSync(pasta, { recursive: true, force: true });
  });

  const req = async (caminho: string, o: { metodo?: string; corpo?: unknown; cookie?: string; edital?: string } = {}) => {
    const h: Record<string, string> = {};
    if (o.corpo !== undefined) h['content-type'] = 'application/json';
    if ((o.metodo ?? 'GET') !== 'GET') h['x-requested-with'] = VALOR_CSRF;
    if (o.cookie) h.cookie = o.cookie;
    if (o.edital) h['x-edital'] = o.edital;
    const r = await fetch(base + caminho, { method: o.metodo ?? 'GET', headers: h, body: o.corpo === undefined ? undefined : JSON.stringify(o.corpo) });
    const txt = await r.text();
    let json: any = null;
    try { json = JSON.parse(txt); } catch { /* não é JSON */ }
    return { status: r.status, json, headers: r.headers, cookie: r.headers.get('set-cookie')?.split(';')[0] };
  };
  const entrar = async (email: string, senha: string) => (await req('/api/auth/entrar', { metodo: 'POST', corpo: { email, senha } })).cookie!;
  const acao = (ck: string, a: unknown, edital?: string, versaoBase?: number) => req('/api/acoes', { metodo: 'POST', cookie: ck, edital, corpo: { acao: a, versaoBase } });
  const editais = (ck: string, corpo: unknown) => req('/api/admin/usuarios/editais', { metodo: 'POST', cookie: ck, corpo });

  test('só o administrador inscreve contas; o principal não pode ser retirado', async () => {
    const adm = await entrar('gestor@exemplo.com', 'cofre-de-aco-1234');
    const comum = await entrar('pessoa@exemplo.com', 'senha-comum-123456');
    expect((await editais(comum, { id: 1, cargoId: 'IFG308', ativa: true })).status).toBe(403);
    expect((await req('/api/admin/usuarios/principal', { metodo: 'POST', cookie: comum, corpo: { id: 2, cargoId: 'B02' } })).status).toBe(403);
    expect((await editais(adm, { id: 1, cargoId: 'XYZ', ativa: true })).json.erro).toMatch(/Cargo desconhecido/);
    expect((await editais(adm, { id: 1, cargoId: 'B02', ativa: false })).json.erro).toMatch(/edital principal/);
    expect((await req('/api/admin/usuarios/principal', { metodo: 'POST', cookie: adm, corpo: { id: 1, cargoId: 'IFG308' } })).json.erro).toMatch(/precisa estar inscrita/);
    // Sem inscrição, o edital é recusado com 409 e a indicação para a tela recarregar.
    const r = await req('/api/edital', { cookie: adm, edital: 'IFG308' });
    expect(r.status).toBe(409);
    expect(r.json.editalInvalido).toBe(true);
    expect((await req('/api/edital', { cookie: comum, edital: 'B02' })).status).toBe(409);
  });

  test('cada edital tem os seus dados; um não vaza no outro', async () => {
    const adm = await entrar('gestor@exemplo.com', 'cofre-de-aco-1234');
    // O administrador inscreve a própria conta no IFG.
    const ins = await editais(adm, { id: 1, cargoId: 'IFG308', ativa: true });
    expect(ins.status).toBe(200);
    expect(ins.json.inscricoes).toMatchObject([{ cargoId: 'B02', ativa: true, principal: true }, { cargoId: 'IFG308', ativa: true, principal: false }]);
    const eu = (await req('/api/auth/eu', { cookie: adm })).json.usuario;
    expect(eu.cargoId).toBe('B02');
    expect(eu.editais.map((e: { cargoId: string }) => e.cargoId)).toEqual(['B02', 'IFG308']);

    // Sem cabeçalho: o principal. Com cabeçalho: o pedido.
    expect((await req('/api/edital', { cookie: adm })).json.cargo.id).toBe('B02');
    expect((await req('/api/edital', { cookie: adm, edital: 'IFG308' })).json.cargo.id).toBe('IFG308');
    const dB = (await req('/api/dados', { cookie: adm })).json;
    const dI = (await req('/api/dados', { cookie: adm, edital: 'IFG308' })).json;
    expect(dB.dados.user.config.dataProva).toBe('2027-01-17');
    expect(dI.dados.user.config.dataProva).toBe('2027-02-14');
    expect(dI.dados.user.ciclo.itens.every((i: { disciplinaId: string }) => i.disciplinaId.startsWith('ifg'))).toBe(true);
    // Os ids dos itens do ciclo se repetem entre editais (ci01…): cada edital tem o seu ciclo.
    expect(dB.dados.user.ciclo.itens[0].id).toBe(dI.dados.user.ciclo.itens[0].id);

    // Alterações em um edital não aparecem no outro.
    const vI = (await req('/api/dados', { cookie: adm, edital: 'IFG308' })).json.versao;
    expect((await acao(adm, { t: 'status', topicoId: 'i060', status: 'estudado' }, 'IFG308', vI)).status).toBe(200);
    expect((await acao(adm, { t: 'cicloMinutos', itemId: 'ci01', minutos: 45 }, 'IFG308')).status).toBe(200);
    expect((await acao(adm, { t: 'config', valor: { metaDiariaMin: 200 } }, 'IFG308')).status).toBe(200);
    const sessao = { data: '2026-11-20', disciplinaId: 'ifgqui', topicoId: 'i060', planejadoMin: 90, realizadoMin: 80, notas: 'só do IFG', origem: 'manual', cicloItemId: null };
    expect((await acao(adm, { t: 'sessaoSalvar', sessao }, 'IFG308')).status).toBe(200);
    const aposI = (await req('/api/dados', { cookie: adm, edital: 'IFG308' })).json.dados.user;
    const aposB = (await req('/api/dados', { cookie: adm })).json.dados.user;
    expect(aposI.topicos.i060.status).toBe('estudado');
    expect(aposI.ciclo.itens[0].minutos).toBe(45);
    expect(aposI.config.metaDiariaMin).toBe(200);
    expect(aposI.sessoes.map((s: { notas: string }) => s.notas)).toEqual(['só do IFG']);
    expect(aposB.topicos.i060).toBeUndefined();
    expect(aposB.ciclo.itens[0].minutos).toBe(dB.dados.user.ciclo.itens[0].minutos);
    expect(aposB.config.metaDiariaMin).toBe(dB.dados.user.config.metaDiariaMin);
    expect(aposB.sessoes).toEqual([]);
    expect(aposB.historico.some((h: { descricao: string }) => /IFG/.test(h.descricao))).toBe(false);

    // Ids de um edital são recusados no outro.
    expect((await acao(adm, { t: 'status', topicoId: 'i001', status: 'estudado' })).status).toBe(422);
    expect((await acao(adm, { t: 'status', topicoId: 't001', status: 'estudado' }, 'IFG308')).status).toBe(422);

    // A exportação é do edital ativo.
    const exp = await req('/api/exportar', { cookie: adm, edital: 'IFG308' });
    expect(exp.headers.get('content-disposition')).toMatch(/estudo-backup-ifg308-/);
    expect(exp.json.user.sessoes).toHaveLength(1);

    // O acompanhamento do administrador traz os dois editais.
    const ac = (await req('/api/admin/acompanhamento', { cookie: adm })).json;
    expect(Object.keys(ac.porEdital[1])).toEqual(['B02', 'IFG308']);
    expect(ac.porEdital[1].IFG308.minutos7).toBe(80);
    expect(ac.resumos[1].minutos7).toBe(0);
    const det = (await req('/api/admin/acompanhamento/detalhe?id=1&cargo=IFG308', { cookie: adm })).json;
    expect(det.cargoId).toBe('IFG308');
    expect(det.resumo.minutos7).toBe(80);
  });

  test('a conta tem um só cronômetro: não se inicia outro em outro edital', async () => {
    const adm = await entrar('gestor@exemplo.com', 'cofre-de-aco-1234');
    const iniciar = (disciplinaId: string, edital?: string) => acao(adm, { t: 'timerIniciar', disciplinaId, topicoId: null, cicloItemId: null, planejadoMin: 30 }, edital);
    expect((await iniciar('lp')).status).toBe(200);
    const r = await iniciar('ifgqui', 'IFG308');
    expect(r.status).toBe(422);
    expect(r.json.erro).toMatch(/cronômetro em andamento no edital/);
    // O outro edital é avisado de que há um cronômetro em andamento.
    expect((await req('/api/dados', { cookie: adm, edital: 'IFG308' })).json.cronometroOutro).toMatchObject({ cargoId: 'B02', rodando: true });
    expect((await req('/api/dados', { cookie: adm })).json.cronometroOutro).toBeNull();
    expect((await acao(adm, { t: 'timerDescartar' })).status).toBe(200);
    expect((await iniciar('ifgqui', 'IFG308')).status).toBe(200);
    expect((await req('/api/dados', { cookie: adm })).json.cronometroOutro).toMatchObject({ cargoId: 'IFG308' });
    expect((await acao(adm, { t: 'timerDescartar' }, 'IFG308')).status).toBe(200);
  });

  test('retirar um edital guarda os dados; inscrever de novo devolve tudo; trocar o principal', async () => {
    const adm = await entrar('gestor@exemplo.com', 'cofre-de-aco-1234');
    const antes = (await req('/api/dados', { cookie: adm, edital: 'IFG308' })).json.dados;
    expect((await editais(adm, { id: 1, cargoId: 'IFG308', ativa: false })).status).toBe(200);
    expect((await req('/api/auth/eu', { cookie: adm })).json.usuario.editais.map((e: { cargoId: string }) => e.cargoId)).toEqual(['B02']);
    expect((await req('/api/dados', { cookie: adm, edital: 'IFG308' })).status).toBe(409);
    expect((await acao(adm, { t: 'status', topicoId: 'i001', status: 'estudado' }, 'IFG308')).status).toBe(409);

    expect((await editais(adm, { id: 1, cargoId: 'IFG308', ativa: true })).status).toBe(200);
    expect((await req('/api/dados', { cookie: adm, edital: 'IFG308' })).json.dados).toEqual(antes);

    // O IFG vira o principal: sem cabeçalho, a conta abre nele; a versão sobe para abas antigas recarregarem.
    const v = (await req('/api/dados', { cookie: adm })).json.versao;
    expect((await req('/api/admin/usuarios/principal', { metodo: 'POST', cookie: adm, corpo: { id: 1, cargoId: 'IFG308' } })).status).toBe(200);
    const depois = (await req('/api/dados', { cookie: adm })).json;
    expect(depois.versao).toBeGreaterThan(v);
    expect(depois.dados.user.config.dataProva).toBe('2027-02-14');
    const eu = (await req('/api/auth/eu', { cookie: adm })).json.usuario;
    expect(eu.cargoId).toBe('IFG308');
    expect(eu.editais[0]).toMatchObject({ cargoId: 'IFG308', principal: true });
    // Agora o B02 pode ser retirado, e o IFG não.
    expect((await editais(adm, { id: 1, cargoId: 'IFG308', ativa: false })).status).toBe(400);
    expect((await editais(adm, { id: 1, cargoId: 'B02', ativa: false })).status).toBe(200);
    expect((await editais(adm, { id: 1, cargoId: 'B02', ativa: true })).status).toBe(200);
    expect((await req('/api/admin/usuarios/principal', { metodo: 'POST', cookie: adm, corpo: { id: 1, cargoId: 'B02' } })).status).toBe(200);
  });

  test('um edital novo herda o fuso horário da conta', async () => {
    const adm = await entrar('gestor@exemplo.com', 'cofre-de-aco-1234');
    expect((await acao(adm, { t: 'config', valor: { fusoHorario: 'America/Manaus' } })).status).toBe(200);
    expect((await editais(adm, { id: 1, cargoId: 'A01', ativa: true })).status).toBe(200);
    expect((await req('/api/dados', { cookie: adm, edital: 'A01' })).json.dados.user.config.fusoHorario).toBe('America/Manaus');
  });
});
