import { createServer, type Server } from 'node:http';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import seedJson from '../src/data/seed.json';
import type { AppData, Seed } from '../src/domain/types';
import { criarDados } from '../src/domain/defaults';
import { reduzir, type Acao } from '../src/domain/actions';
import { definirFuso, uid } from '../src/domain/util';
import { abrirBanco, transacao } from './db';
import { lerEdital, sincronizarEdital } from './edital';
import { carregarDados, gravarDados } from './repositorio';
import { criarApp, VALOR_CSRF } from './app';
import { lerConfig } from './config';
import * as auth from './auth';
import { configurarLog } from './log';
import type { BD } from './sqlite';

const seed = seedJson as unknown as Seed;
configurarLog('erro', true);

function bancoNovo(arquivo = ':memory:'): BD {
  const db = abrirBanco(arquivo);
  sincronizarEdital(db, seed);
  return db;
}

function criarUsuarioDireto(db: BD, email = 'a@b.com'): number {
  const agora = new Date().toISOString();
  return Number(db.prepare('INSERT INTO usuarios (email, senha_hash, senha_alterada_em, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?)').run(email, 'x', agora, agora, agora).lastInsertRowid);
}

describe('banco de dados', () => {
  test('a estrutura do edital volta do banco idêntica ao seed', () => {
    const db = bancoNovo();
    expect(lerEdital(db)).toEqual(seed);
    expect(sincronizarEdital(db, seed)).toBe(false); // mesma versão: nada a fazer
  });

  test('gravar e ler os dados de estudo não perde nada, inclusive a ordem das listas', () => {
    const db = bancoNovo();
    const id = criarUsuarioDireto(db);
    let d = criarDados(seed, '2026-10-01', Date.parse('2026-10-01T12:00:00Z'));
    transacao(db, () => gravarDados(db, id, null, d));
    expect(carregarDados(db, id)).toEqual(d);

    // Uma sequência de ações de todos os tipos, gravando só a diferença a cada passo.
    const t = seed.topicos;
    const acoes: Acao[] = [
      { t: 'status', topicoId: t[0].id, status: 'estudado' },
      { t: 'dominado', topicoId: t[0].id, valor: true },
      { t: 'prioridade', topicoId: t[1].id, valor: 'Urgente' },
      { t: 'prioridadeDisciplina', disciplinaId: 'lp', valor: 'Alta' },
      { t: 'notas', topicoId: t[2].id, texto: 'resumo "com aspas" e acentuação' },
      { t: 'revisao', topicoId: t[0].id },
      { t: 'cicloMover', de: 0, para: 3 },
      { t: 'cicloMinutos', itemId: 'ci02', minutos: 45 },
      { t: 'cicloAtivo', itemId: 'ci03', ativo: false },
      { t: 'cicloAdicionar', disciplinaId: 'ing', minutos: 30 },
      { t: 'cicloPular' },
      { t: 'timerIniciar', disciplinaId: 'lp', topicoId: t[3].id, cicloItemId: null, planejadoMin: 60 },
      { t: 'timerPausar' },
      { t: 'timerRetomar' },
      { t: 'sessaoSalvar', sessao: { data: '2026-10-02', disciplinaId: 'lp', topicoId: t[4].id, planejadoMin: 60, realizadoMin: 55, notas: 'x', origem: 'manual', cicloItemId: null }, novoStatus: 'estudado' },
      { t: 'depAdicionar', de: t[5].id, para: t[6].id, tipo: 'obrigatorio' },
      { t: 'depRestaurar' },
      { t: 'config', valor: { metaDiariaMin: 120, dataProva: '', fusoHorario: 'America/Manaus' } },
      { t: 'cicloRemover', itemId: 'ci05' },
    ];
    let agora = Date.parse('2026-10-02T12:00:00Z');
    for (const a of acoes) {
      agora += 60_000 * 7;
      const novo = reduzir(d, a, { seed, agora });
      transacao(db, () => gravarDados(db, id, d, novo));
      d = novo;
      expect(carregarDados(db, id), `depois de ${a.t}`).toEqual(d);
    }
    // Finaliza o cronômetro e exclui uma sessão
    d = reduzir(d, { t: 'timerFinalizar', notas: 'fim', novoStatus: null }, { seed, agora: agora + 3_600_000 });
    const s = d.user.sessoes[0];
    const d2 = reduzir(d, { t: 'sessaoExcluir', id: s.id }, { seed, agora: agora + 3_700_000 });
    transacao(db, () => gravarDados(db, id, carregarDados(db, id), d));
    transacao(db, () => gravarDados(db, id, d, d2));
    expect(carregarDados(db, id)).toEqual(d2);
  });

  test('uma falha no meio da gravação desfaz tudo', () => {
    const db = bancoNovo();
    const id = criarUsuarioDireto(db);
    const d = criarDados(seed);
    transacao(db, () => gravarDados(db, id, null, d));
    const ruim = structuredClone(d);
    ruim.user.sessoes.push({ id: 's1', data: '2026-10-02', disciplinaId: 'nao-existe', topicoId: null, planejadoMin: 1, realizadoMin: 1, notas: '', origem: 'manual', cicloItemId: null, criadoEm: '', atualizadoEm: '' });
    ruim.user.config.metaDiariaMin = 1;
    expect(() => transacao(db, () => gravarDados(db, id, d, ruim))).toThrow();
    expect(carregarDados(db, id)).toEqual(d);
  });
});

describe('fuso horário', () => {
  test('o dia da sessão segue o fuso configurado, não o do servidor', () => {
    // 02:30 UTC de 22/10 ainda é 21/10 em São Paulo (UTC-3).
    const agora = Date.parse('2026-10-22T02:30:00Z');
    definirFuso('America/Sao_Paulo');
    let d = criarDados(seed, '2026-10-21', agora);
    d = reduzir(d, { t: 'timerIniciar', disciplinaId: 'lp', topicoId: null, cicloItemId: null, planejadoMin: 30 }, { seed, agora });
    d = reduzir(d, { t: 'timerFinalizar', notas: '', novoStatus: null }, { seed, agora: agora + 20 * 60_000 });
    expect(d.user.sessoes[0].data).toBe('2026-10-21');
    definirFuso('UTC');
    expect(reduzir(criarDados(seed), { t: 'status', topicoId: 't001', status: 'estudado' }, { seed, agora }).user.topicos.t001.concluidoEm).toBe('2026-10-22');
    definirFuso(null);
  });
});

// ---------------------------------------------------------------------------

describe('API e segurança', () => {
  let pasta: string;
  let db: BD;
  let srv: Server;
  let base: string;
  const cfg = () => ({ ...lerConfig({}), cookieSeguro: false, pastaBackups: join(pasta, 'backups'), pastaWeb: join(pasta, 'web') });

  async function subir(arquivo: string) {
    db = bancoNovo(arquivo);
    srv = createServer(criarApp(db, lerEdital(db), cfg()));
    await new Promise<void>((ok) => srv.listen(0, '127.0.0.1', ok));
    base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
  }
  async function descer() {
    await new Promise((ok) => srv.close(ok));
    db.close();
  }

  beforeAll(async () => {
    pasta = mkdtempSync(join(tmpdir(), 'estudo-'));
    await subir(join(pasta, 'estudo.db'));
    await auth.criarUsuario(db, { email: 'eu@exemplo.com', nome: 'Eu', senha: 'senha-bem-forte-123' });
  });
  afterAll(async () => {
    await descer();
    rmSync(pasta, { recursive: true, force: true });
  });

  const req = async (caminho: string, o: { metodo?: string; corpo?: unknown; cookie?: string; csrf?: boolean; origem?: string } = {}) => {
    const h: Record<string, string> = {};
    if (o.corpo !== undefined) h['content-type'] = 'application/json';
    if (o.csrf !== false && (o.metodo ?? 'GET') !== 'GET') h['x-requested-with'] = VALOR_CSRF;
    if (o.cookie) h.cookie = o.cookie;
    if (o.origem) h.origin = o.origem;
    const r = await fetch(base + caminho, { method: o.metodo ?? 'GET', headers: h, body: o.corpo === undefined ? undefined : JSON.stringify(o.corpo) });
    const txt = await r.text();
    let json: any = null;
    try { json = JSON.parse(txt); } catch { /* não é JSON */ }
    return { status: r.status, json, cookie: r.headers.get('set-cookie')?.split(';')[0], headers: r.headers };
  };
  const entrar = async (senha = 'senha-bem-forte-123', email = 'eu@exemplo.com') => req('/api/auth/entrar', { metodo: 'POST', corpo: { email, senha } });

  test('sem login, nenhum dado é acessível', async () => {
    for (const c of ['/api/dados', '/api/edital', '/api/auth/eu', '/api/exportar', '/api/preferencias', '/edital.pdf']) expect((await req(c)).status, c).toBe(401);
    expect((await req('/api/acoes', { metodo: 'POST', corpo: { acao: { t: 'cicloPular' } } })).status).toBe(401);
    expect((await req('/api/saude')).status).toBe(200);
  });

  test('cabeçalhos de segurança estão presentes', async () => {
    const r = await req('/api/saude');
    expect(r.headers.get('content-security-policy')).toContain("default-src 'self'");
    expect(r.headers.get('x-content-type-options')).toBe('nosniff');
  });

  test('requisições de alteração exigem o cabeçalho anti-CSRF e a mesma origem', async () => {
    expect((await req('/api/auth/entrar', { metodo: 'POST', corpo: {}, csrf: false })).status).toBe(403);
    expect((await req('/api/auth/entrar', { metodo: 'POST', corpo: {}, origem: 'https://site-malicioso.com' })).status).toBe(403);
  });

  test('login com senha errada é recusado e não revela se o e-mail existe', async () => {
    const a = await entrar('errada-123456');
    const b = await entrar('errada-123456', 'ninguem@exemplo.com');
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.json.erro).toBe(b.json.erro);
    expect(a.cookie).toBeUndefined();
  });

  test('login, leitura, ações persistidas, versão e logout', async () => {
    const l = await entrar();
    expect(l.status).toBe(200);
    expect(l.cookie).toMatch(/^sid=/);
    const ck = l.cookie!;
    expect((await req('/api/auth/eu', { cookie: ck })).json.usuario.email).toBe('eu@exemplo.com');
    expect((await req('/api/edital', { cookie: ck })).json.topicos).toHaveLength(253);

    const r1 = await req('/api/dados', { cookie: ck });
    expect(r1.status).toBe(200);
    const dados: AppData = r1.json.dados;
    expect(dados.user.ciclo.itens).toHaveLength(22);
    expect((await req(`/api/dados?versao=${r1.json.versao}`, { cookie: ck })).json.inalterado).toBe(true);

    // O cliente aplica a ação localmente com ids e horário próprios; o servidor reaproveita os mesmos.
    const agora = Date.now();
    const ids: string[] = [];
    const gerarId = (p: string) => { const x = uid(p); ids.push(x); return x; };
    const acao: Acao = { t: 'sessaoSalvar', sessao: { data: '2026-10-20', disciplinaId: 'bd', topicoId: null, planejadoMin: 60, realizadoMin: 50, notas: 'a', origem: 'manual', cicloItemId: null } };
    definirFuso(dados.user.config.fusoHorario);
    const local = reduzir(dados, acao, { seed, agora, gerarId });
    definirFuso(null);
    const r2 = await req('/api/acoes', { metodo: 'POST', cookie: ck, corpo: { acao, versaoBase: r1.json.versao, agora, ids } });
    expect(r2.status).toBe(200);
    expect(r2.json.versao).toBe(r1.json.versao + 1);
    expect(r2.json.dados).toBeUndefined(); // nada divergiu: o cliente já tem o estado certo
    expect((await req('/api/dados', { cookie: ck })).json.dados).toEqual(local);

    // Versão desatualizada: o servidor aplica sobre o estado atual e devolve tudo.
    const r3 = await req('/api/acoes', { metodo: 'POST', cookie: ck, corpo: { acao: { t: 'cicloPular' }, versaoBase: 0 } });
    expect(r3.json.dados.user.ciclo.proximoItemId).not.toBe(local.user.ciclo.proximoItemId);

    // Regra de negócio violada: 422 com a mensagem do domínio, nada gravado.
    const r4 = await req('/api/acoes', { metodo: 'POST', cookie: ck, corpo: { acao: { t: 'cicloMinutos', itemId: 'ci01', minutos: 2 } } });
    expect(r4.status).toBe(422);
    expect(r4.json.erro).toMatch(/entre 5 e 600/);
    expect((await req('/api/acoes', { metodo: 'POST', cookie: ck, corpo: { acao: { t: 'apagarTudo' } } })).status).toBe(422);

    expect((await req('/api/auth/sair', { metodo: 'POST', cookie: ck, corpo: {} })).status).toBe(200);
    expect((await req('/api/dados', { cookie: ck })).status).toBe(401);
  });

  test('os dados continuam disponíveis depois de reiniciar o servidor', async () => {
    const ck = (await entrar()).cookie!;
    const antes = (await req('/api/dados', { cookie: ck })).json;
    await descer();
    await subir(join(pasta, 'estudo.db'));
    const depois = (await req('/api/dados', { cookie: ck })).json;
    expect(depois.versao).toBe(antes.versao);
    expect(depois.dados).toEqual(antes.dados);
    expect(depois.dados.user.sessoes.some((s: { notas: string }) => s.notas === 'a')).toBe(true);
  });

  test('importação valida o arquivo e faz cópia de segurança antes de substituir', async () => {
    const ck = (await entrar()).cookie!;
    const ruim = await req('/api/acoes', { metodo: 'POST', cookie: ck, corpo: { acao: { t: 'importar', dados: { schemaVersion: 1, user: { sessoes: 'x' } } } } });
    expect(ruim.status).toBe(422);
    expect(ruim.json.erro).toMatch(/Arquivo recusado/);

    const backup = criarDados(seed);
    backup.user.sessoes.push({ id: 'importada', data: '2026-09-01', disciplinaId: 'es', topicoId: 't055', planejadoMin: 90, realizadoMin: 80, notas: '', origem: 'cronometro', cicloItemId: null, criadoEm: '2026-09-01T10:00:00.000Z', atualizadoEm: '2026-09-01T10:00:00.000Z' });
    delete (backup.user.config as { fusoHorario?: string }).fusoHorario; // backups antigos não têm fuso
    const ok = await req('/api/acoes', { metodo: 'POST', cookie: ck, corpo: { acao: { t: 'importar', dados: backup } } });
    expect(ok.status).toBe(200);
    expect(ok.json.dados.user.sessoes.map((s: { id: string }) => s.id)).toEqual(['importada']);
    expect(ok.json.dados.user.config.fusoHorario).toBe('America/Sao_Paulo');
    expect(readdirSync(join(pasta, 'backups')).some((f) => f.includes('antes-substituir'))).toBe(true);
    const exp = await req('/api/exportar', { cookie: ck });
    expect(exp.headers.get('content-disposition')).toMatch(/attachment/);
    expect(exp.json.user.sessoes[0].id).toBe('importada');
  });

  test('preferências são salvas por usuário e validadas', async () => {
    const ck = (await entrar()).cookie!;
    const padrao = { focoMin: 25, pausaMin: 5, pausaLongaMin: 15, ciclosLonga: 4, som: true };
    expect((await req('/api/preferencias', { cookie: ck })).json).toEqual({ tema: 'sistema', menuRecolhido: false, pomodoro: padrao });
    expect((await req('/api/preferencias', { metodo: 'PUT', cookie: ck, corpo: { tema: 'escuro', menuRecolhido: true } })).json).toEqual({ tema: 'escuro', menuRecolhido: true, pomodoro: padrao });
    const ajustado = (await req('/api/preferencias', { metodo: 'PUT', cookie: ck, corpo: { pomodoro: { focoMin: 50, pausaMin: 999 } } })).json;
    expect(ajustado.pomodoro).toEqual({ ...padrao, focoMin: 50, pausaMin: 60 });
    expect(ajustado.tema).toBe('escuro');
    expect((await req('/api/preferencias', { cookie: ck })).json.pomodoro.focoMin).toBe(50);
    expect((await req('/api/preferencias', { metodo: 'PUT', cookie: ck, corpo: { pomodoro: 'x' } })).status).toBe(400);
    expect((await req('/api/preferencias', { metodo: 'PUT', cookie: ck, corpo: { tema: 'roxo' } })).status).toBe(400);
  });

  test('troca de senha exige a atual e encerra as outras sessões', async () => {
    const a = (await entrar()).cookie!;
    const b = (await entrar()).cookie!;
    expect((await req('/api/auth/sessoes', { cookie: a })).json.sessoes.length).toBeGreaterThanOrEqual(2);
    expect((await req('/api/auth/senha', { metodo: 'POST', cookie: a, corpo: { atual: 'errada-0000', nova: 'outra-senha-forte-9' } })).status).toBe(400);
    expect((await req('/api/auth/senha', { metodo: 'POST', cookie: a, corpo: { atual: 'senha-bem-forte-123', nova: 'curta' } })).status).toBe(400);
    expect((await req('/api/auth/senha', { metodo: 'POST', cookie: a, corpo: { atual: 'senha-bem-forte-123', nova: 'outra-senha-forte-9' } })).status).toBe(200);
    expect((await req('/api/dados', { cookie: a })).status).toBe(200);
    expect((await req('/api/dados', { cookie: b })).status).toBe(401);
    expect((await entrar('senha-bem-forte-123')).status).toBe(401);
    expect((await entrar('outra-senha-forte-9')).status).toBe(200);
  });

  test('tentativas repetidas bloqueiam o login daquele e-mail', async () => {
    await auth.criarUsuario(db, { email: 'alvo@exemplo.com', nome: '', senha: 'cofre-fechado-987' });
    for (let i = 0; i < 5; i++) expect((await entrar('chute-errado-' + i, 'alvo@exemplo.com')).status).toBe(401);
    const r = await entrar('cofre-fechado-987', 'alvo@exemplo.com');
    expect(r.status).toBe(429);
    expect(r.cookie).toBeUndefined();
  });

  test('sessões expiram por inatividade e pela duração máxima', () => {
    const id = auth.buscarPorEmail(db, 'eu@exemplo.com')!.id;
    const pol = { inatividadeMs: 1000, maximaMs: 5000 };
    const t0 = Date.now();
    const tk = auth.criarSessao(db, id, { ip: '', agente: '' }, pol, t0);
    expect(auth.validarSessao(db, tk, pol, t0 + 500)).not.toBeNull();
    expect(auth.validarSessao(db, tk, pol, t0 + 2000)).toBeNull();
    expect(auth.validarSessao(db, 'token-inventado', pol, t0)).toBeNull();
  });

  test('senhas ficam guardadas só como hash scrypt', async () => {
    const r = db.prepare("SELECT senha_hash FROM usuarios WHERE email = 'eu@exemplo.com'").get() as { senha_hash: string };
    expect(r.senha_hash.startsWith('scrypt$')).toBe(true);
    expect(r.senha_hash).not.toContain('outra-senha-forte-9');
    expect(await auth.conferirSenha('outra-senha-forte-9', r.senha_hash)).toBe(true);
    const tokens = db.prepare('SELECT token_hash FROM sessoes_login').all() as { token_hash: string }[];
    expect(tokens.every((t) => /^[0-9a-f]{64}$/.test(t.token_hash))).toBe(true);
  });
});
