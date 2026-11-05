import { createServer, type Server } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import seedJson from '../src/data/seed.json';
import seedA01Json from '../src/data/seed-a01.json';
import type { Seed } from '../src/domain/types';
import { criarDados } from '../src/domain/defaults';
import type { Acao } from '../src/domain/actions';
import { abrirBanco, migrar, MIGRACOES } from './db';
import { lerEdital, sincronizarEdital } from './edital';
import { prepararEditais } from './cargos';
import { criarApp, VALOR_CSRF } from './app';
import { lerConfig } from './config';
import * as auth from './auth';
import { configurarLog } from './log';
import { DatabaseSync, type BD } from './sqlite';

const seed = seedJson as unknown as Seed;
const seedA01 = seedA01Json as unknown as Seed;
configurarLog('erro', true);

describe('vários usuários e cargos (API)', () => {
  let pasta: string;
  let db: BD;
  let srv: Server;
  let base: string;

  beforeAll(async () => {
    pasta = mkdtempSync(join(tmpdir(), 'estudo-cargos-'));
    db = abrirBanco(join(pasta, 'estudo.db'));
    const cfg = { ...lerConfig({}), cookieSeguro: false, pastaDados: pasta, pastaBackups: join(pasta, 'backups'), pastaWeb: join(pasta, 'web') };
    srv = createServer(criarApp(db, prepararEditais(db).porCargo, cfg));
    await new Promise<void>((ok) => srv.listen(0, '127.0.0.1', ok));
    base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
    await auth.criarUsuario(db, { email: 'gestor@exemplo.com', nome: 'Admin', senha: 'cofre-de-aco-1234', cargoId: 'B02', papel: 'admin' });
  });
  afterAll(async () => {
    await new Promise((ok) => srv.close(ok));
    db.close();
    rmSync(pasta, { recursive: true, force: true });
  });

  const req = async (caminho: string, o: { metodo?: string; corpo?: unknown; cookie?: string } = {}) => {
    const h: Record<string, string> = {};
    if (o.corpo !== undefined) h['content-type'] = 'application/json';
    if ((o.metodo ?? 'GET') !== 'GET') h['x-requested-with'] = VALOR_CSRF;
    if (o.cookie) h.cookie = o.cookie;
    const r = await fetch(base + caminho, { method: o.metodo ?? 'GET', headers: h, body: o.corpo === undefined ? undefined : JSON.stringify(o.corpo) });
    const txt = await r.text();
    let json: any = null;
    try { json = JSON.parse(txt); } catch { /* não é JSON */ }
    return { status: r.status, json, cookie: r.headers.get('set-cookie')?.split(';')[0] };
  };
  const entrar = (senha: string, email = 'gestor@exemplo.com') => req('/api/auth/entrar', { metodo: 'POST', corpo: { email, senha } });
  const adminCk = async () => (await entrar('cofre-de-aco-1234')).cookie!;
  const criarConta = (ck: string, corpo: Record<string, unknown>) => req('/api/admin/usuarios', { metodo: 'POST', cookie: ck, corpo });
  const acoes = (ck: string, acao: unknown, versaoBase?: number) => req('/api/acoes', { metodo: 'POST', cookie: ck, corpo: { acao, versaoBase } });

  test('só o administrador gerencia contas', async () => {
    const adm = await adminCk();
    const lista = await req('/api/admin/usuarios', { cookie: adm });
    expect(lista.status).toBe(200);
    expect(lista.json.cargos.map((c: { id: string }) => c.id)).toEqual(['A01', 'B02']);
    const comum = await auth.criarUsuario(db, { email: 'pessoa@exemplo.com', nome: 'Comum', senha: 'senha-comum-123456', cargoId: 'B02' });
    expect(comum.papel).toBe('usuario');
    const ck = (await entrar('senha-comum-123456', 'pessoa@exemplo.com')).cookie!;
    expect((await req('/api/admin/usuarios', { cookie: ck })).status).toBe(403);
    expect((await criarConta(ck, { email: 'x@y.com', nome: 'X', senha: 'senha-longa-1234', cargoId: 'B02' })).status).toBe(403);
    expect((await req('/api/admin/usuarios/ativo', { metodo: 'POST', cookie: ck, corpo: { id: 1, ativo: false } })).status).toBe(403);
    expect((await req('/api/admin/usuarios/senha', { metodo: 'POST', cookie: ck, corpo: { id: 1, nova: 'senha-longa-1234' } })).status).toBe(403);
    expect((await req('/api/admin/usuarios')).status).toBe(401);
  });

  test('conta criada pelo administrador: cargo fixo, senha provisória e validações', async () => {
    const adm = await adminCk();
    expect((await criarConta(adm, { email: 'maria@exemplo.com', nome: 'Maria', senha: 'curta', cargoId: 'A01' })).status).toBe(400);
    expect((await criarConta(adm, { email: 'maria@exemplo.com', nome: 'Maria', senha: 'senha-provisoria-1', cargoId: 'Z99' })).json.erro).toMatch(/Cargo desconhecido/);
    expect((await criarConta(adm, { email: 'invalido', nome: 'Maria', senha: 'senha-provisoria-1', cargoId: 'A01' })).status).toBe(400);
    expect((await criarConta(adm, { email: 'maria@exemplo.com', nome: '', senha: 'senha-provisoria-1', cargoId: 'A01' })).status).toBe(400);
    const ok = await criarConta(adm, { email: 'Maria@Exemplo.com', nome: 'Maria', senha: 'senha-provisoria-1', cargoId: 'A01', papel: 'admin' });
    expect(ok.status).toBe(200);
    // O papel enviado pelo cliente é ignorado: contas criadas pela tela nunca são administradoras.
    expect(ok.json.usuario).toMatchObject({ email: 'maria@exemplo.com', cargoId: 'A01', papel: 'usuario', ativo: true, senhaProvisoria: true });
    expect((await criarConta(adm, { email: 'maria@exemplo.com', nome: 'Maria', senha: 'senha-provisoria-1', cargoId: 'B02' })).json.erro).toMatch(/Já existe/);

    const eu = await entrar('senha-provisoria-1', 'maria@exemplo.com');
    expect(eu.json.usuario).toMatchObject({ cargoId: 'A01', senhaProvisoria: true });
    expect((await req('/api/auth/senha', { metodo: 'POST', cookie: eu.cookie, corpo: { atual: 'senha-provisoria-1', nova: 'minha-senha-propria-77' } })).status).toBe(200);
    expect((await req('/api/auth/eu', { cookie: eu.cookie })).json.usuario.senhaProvisoria).toBe(false);
    // Não existe rota para trocar o cargo de uma conta.
    expect((await req('/api/admin/usuarios/cargo', { metodo: 'POST', cookie: adm, corpo: { id: ok.json.usuario.id, cargoId: 'B02' } })).status).toBe(404);
    expect(auth.buscarUsuario(db, ok.json.usuario.id)!.cargoId).toBe('A01');
  });

  test('cada conta enxerga só o edital e os dados do seu cargo', async () => {
    const adm = await adminCk();
    const maria = (await entrar('minha-senha-propria-77', 'maria@exemplo.com')).cookie!;
    const edB = (await req('/api/edital', { cookie: adm })).json;
    const edA = (await req('/api/edital', { cookie: maria })).json;
    expect(edB.cargo.id).toBe('B02');
    expect(edB.topicos).toHaveLength(253);
    expect(edA.cargo.id).toBe('A01');
    expect(edA.topicos).toHaveLength(seedA01.topicos.length);
    expect(edA.disciplinas.map((d: { id: string }) => d.id)).toEqual(seedA01.disciplinas.map((d) => d.id));
    expect(edA.nucleos.find((n: { id: string }) => n.id === 'CE').descricao).toMatch(/cargo A01/);
    expect(edB.nucleos.find((n: { id: string }) => n.id === 'CE').descricao).toMatch(/cargo B02/);
    expect(edA.topicos.every((t: { id: string }) => /^a\d{3}$/.test(t.id))).toBe(true);
    expect(edA.fatos.some((f: { id: string }) => f.id === 'vagas')).toBe(false);

    const dA = (await req('/api/dados', { cookie: maria })).json;
    const dB = (await req('/api/dados', { cookie: adm })).json;
    expect(dA.dados.user.ciclo.itens).toHaveLength(seedA01.cargo!.cicloInicial.length);
    expect(dA.dados.user.ciclo.itens.every((i: { disciplinaId: string }) => i.disciplinaId.startsWith('a01'))).toBe(true);
    expect(dB.dados.user.ciclo.itens).toHaveLength(22);

    // Uma sessão da Maria não aparece para o administrador.
    const acao: Acao = { t: 'sessaoSalvar', sessao: { data: '2026-10-20', disciplinaId: 'a01da', topicoId: 'a052', planejadoMin: 60, realizadoMin: 55, notas: 'só da Maria', origem: 'manual', cicloItemId: null }, novoStatus: 'estudado' };
    expect((await acoes(maria, acao, dA.versao)).status).toBe(200);
    const aposA = (await req('/api/dados', { cookie: maria })).json.dados;
    const aposB = (await req('/api/dados', { cookie: adm })).json;
    expect(aposA.user.sessoes.map((s: { notas: string }) => s.notas)).toEqual(['só da Maria']);
    expect(aposA.user.topicos.a052.status).toBe('estudado');
    expect(aposB.dados.user.sessoes.some((s: { notas: string }) => s.notas === 'só da Maria')).toBe(false);
    expect(aposB.versao).toBe(dB.versao);
    expect(aposB.dados).toEqual(dB.dados);

    // Ids de outro cargo são recusados, nas duas direções.
    const outro: Acao = { t: 'sessaoSalvar', sessao: { data: '2026-10-20', disciplinaId: 'bd', topicoId: null, planejadoMin: 60, realizadoMin: 55, notas: '', origem: 'manual', cicloItemId: null } };
    expect((await acoes(maria, outro)).status).toBe(422);
    expect((await acoes(adm, { t: 'status', topicoId: 'a052', status: 'estudado' })).status).toBe(422);

    // Um backup do B02 não pode ser importado numa conta do A01.
    const imp = await acoes(maria, { t: 'importar', dados: criarDados(seed) });
    expect(imp.status).toBe(422);
    expect(imp.json.erro).toMatch(/Arquivo recusado/);
    expect((await req('/api/dados', { cookie: maria })).json.dados.user.sessoes).toHaveLength(1);
    // Nem o inverso.
    expect((await acoes(adm, { t: 'importar', dados: criarDados(seedA01) })).status).toBe(422);
  });

  test('desativar uma conta bloqueia o acesso e preserva os dados; reativar devolve tudo', async () => {
    const adm = await adminCk();
    const id = auth.buscarPorEmail(db, 'maria@exemplo.com')!.id;
    const maria = (await entrar('minha-senha-propria-77', 'maria@exemplo.com')).cookie!;
    expect((await req('/api/admin/usuarios/ativo', { metodo: 'POST', cookie: adm, corpo: { id, ativo: false } })).status).toBe(200);
    expect((await req('/api/dados', { cookie: maria })).status).toBe(401);
    expect((await entrar('minha-senha-propria-77', 'maria@exemplo.com')).status).toBe(401);
    expect((await req('/api/admin/usuarios/ativo', { metodo: 'POST', cookie: adm, corpo: { id, ativo: true } })).status).toBe(200);
    const volta = (await entrar('minha-senha-propria-77', 'maria@exemplo.com')).cookie!;
    expect((await req('/api/dados', { cookie: volta })).json.dados.user.sessoes[0].notas).toBe('só da Maria');
    const meuId = auth.buscarPorEmail(db, 'gestor@exemplo.com')!.id;
    expect((await req('/api/admin/usuarios/ativo', { metodo: 'POST', cookie: adm, corpo: { id: meuId, ativo: false } })).status).toBe(400);
    expect(() => auth.definirAtivo(db, meuId, false)).toThrow(/único administrador/);
    expect((await req('/api/admin/usuarios/ativo', { metodo: 'POST', cookie: adm, corpo: { id: 99999, ativo: false } })).status).toBe(404);
  });

  test('com senha provisória, o servidor bloqueia tudo até a pessoa criar a própria senha', async () => {
    const adm = await adminCk();
    expect((await criarConta(adm, { email: 'luiza@exemplo.com', nome: 'Luiza', senha: 'provisoria-alfa-5555', cargoId: 'A01' })).status).toBe(200);
    const ck = (await entrar('provisoria-alfa-5555', 'luiza@exemplo.com')).cookie!;
    for (const c of ['/api/edital', '/api/dados', '/api/preferencias', '/api/exportar']) {
      const r = await req(c, { cookie: ck });
      expect(r.status, c).toBe(403);
      expect(r.json.senhaProvisoria).toBe(true);
    }
    expect((await acoes(ck, { t: 'cicloPular' })).status).toBe(403);
    expect((await req('/api/perfil/foto/remover', { metodo: 'POST', cookie: ck, corpo: {} })).status).toBe(403);
    expect((await req('/api/auth/eu', { cookie: ck })).json.usuario.senhaProvisoria).toBe(true);
    expect((await req('/api/auth/senha', { metodo: 'POST', cookie: ck, corpo: { atual: 'provisoria-alfa-5555', nova: 'frase-longa-segura-2026' } })).status).toBe(200);
    expect((await req('/api/auth/eu', { cookie: ck })).json.usuario.senhaProvisoria).toBe(false);
    expect((await req('/api/edital', { cookie: ck })).status).toBe(200);
  });

  test('o usuário envia, troca e remove a própria foto, com validação do arquivo', async () => {
    const ck = (await entrar('minha-senha-propria-77', 'maria@exemplo.com')).cookie!;
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';
    expect((await req('/api/perfil/foto', { cookie: ck })).status).toBe(404);
    const ok = await req('/api/perfil/foto', { metodo: 'POST', cookie: ck, corpo: { imagem: `data:image/png;base64,${png}` } });
    expect(ok.status).toBe(200);
    expect(typeof ok.json.usuario.foto).toBe('number');
    expect((await req('/api/perfil/foto', { cookie: ck })).status).toBe(200);
    // Conteúdo que não é imagem é recusado, mesmo declarado como PNG; outros formatos também.
    const falso = Buffer.from('<script>alert(1)</script>').toString('base64');
    expect((await req('/api/perfil/foto', { metodo: 'POST', cookie: ck, corpo: { imagem: `data:image/png;base64,${falso}` } })).status).toBe(400);
    expect((await req('/api/perfil/foto', { metodo: 'POST', cookie: ck, corpo: { imagem: `data:image/svg+xml;base64,${falso}` } })).status).toBe(400);
    expect((await req('/api/perfil/foto', { metodo: 'POST', cookie: ck, corpo: { imagem: 'qualquer coisa' } })).status).toBe(400);
    // A foto é de cada conta: o administrador não ganha a da Maria.
    expect((await req('/api/perfil/foto', { cookie: await adminCk() })).status).toBe(404);
    const rem = await req('/api/perfil/foto/remover', { metodo: 'POST', cookie: ck, corpo: {} });
    expect(rem.json.usuario.foto).toBeNull();
    expect((await req('/api/perfil/foto', { cookie: ck })).status).toBe(404);
  });

  test('o administrador redefine senhas e não vê dados de estudo alheios', async () => {
    const adm = await adminCk();
    const id = auth.buscarPorEmail(db, 'maria@exemplo.com')!.id;
    const maria = (await entrar('minha-senha-propria-77', 'maria@exemplo.com')).cookie!;
    expect((await req('/api/admin/usuarios/senha', { metodo: 'POST', cookie: adm, corpo: { id, nova: 'curta' } })).status).toBe(400);
    expect((await req('/api/admin/usuarios/senha', { metodo: 'POST', cookie: adm, corpo: { id, nova: 'nova-provisoria-2026' } })).status).toBe(200);
    expect((await req('/api/dados', { cookie: maria })).status).toBe(401);
    expect((await entrar('nova-provisoria-2026', 'maria@exemplo.com')).json.usuario.senhaProvisoria).toBe(true);
    const meuId = auth.buscarPorEmail(db, 'gestor@exemplo.com')!.id;
    expect((await req('/api/admin/usuarios/senha', { metodo: 'POST', cookie: adm, corpo: { id: meuId, nova: 'nova-provisoria-2026' } })).status).toBe(400);
    const lista = (await req('/api/admin/usuarios', { cookie: adm })).json.usuarios;
    expect(JSON.stringify(lista)).not.toMatch(/sessoes|topicos|ciclo|historico/);
  });
});

describe('migração e seeds por cargo', () => {
  test('a migração 3 só acrescenta: contas, edital e dados de estudo existentes continuam intactos e pertencem ao B02', () => {
    const db: BD = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON');
    // Banco como estava antes: só as migrações 1 e 2.
    db.exec('CREATE TABLE schema_migracoes (versao INTEGER PRIMARY KEY, nome TEXT NOT NULL, aplicada_em TEXT NOT NULL)');
    for (const m of MIGRACOES.filter((x) => x.versao <= 2)) {
      db.exec(m.sql);
      db.prepare('INSERT INTO schema_migracoes VALUES (?, ?, ?)').run(m.versao, m.nome, 'antes');
    }
    const agora = new Date().toISOString();
    db.exec(`INSERT INTO meta VALUES ('seed_versao', '1'), ('fonte', '{}');
      INSERT INTO nucleos VALUES ('CG', 'Conhecimentos Gerais', 'Núcleo comum', 'desc CG', 19, 0);
      INSERT INTO disciplinas VALUES ('lp', 'Língua Portuguesa', 'LP', 'CG', 1, '[19]', 'texto', 0);
      INSERT INTO topicos VALUES ('t001', 1, 'lp', 'Redação Oficial', 0, 'Média', 'x', 'Não estudado', 0);
      INSERT INTO fatos VALUES ('data', 'Data', '17/01/2027', 'ref', 23, 0);`);
    db.prepare('INSERT INTO usuarios (email, senha_hash, senha_alterada_em, criado_em, atualizado_em, versao_dados) VALUES (?, ?, ?, ?, ?, 7)').run('antigo@exemplo.com', 'hash', agora, agora, agora);
    db.exec(`INSERT INTO configuracoes VALUES (1, 111, 222, 33, '[1,7,30]', '2027-01-17', 'America/Sao_Paulo', 1, 1);
      INSERT INTO sessoes_estudo (usuario_id, id, seq, data, disciplina_id, topico_id, planejado_min, realizado_min, origem, criado_em, atualizado_em)
        VALUES (1, 's1', 1, '2026-10-01', 'lp', 't001', 60, 50, 'manual', '${agora}', '${agora}');`);

    expect(migrar(db)).toEqual([3]);

    expect(db.prepare('SELECT email, cargo_id, senha_provisoria, versao_dados FROM usuarios').get()).toMatchObject({ email: 'antigo@exemplo.com', cargo_id: 'B02', senha_provisoria: 0, versao_dados: 7 });
    expect(db.prepare('SELECT cargo_id FROM disciplinas').all()).toMatchObject([{ cargo_id: 'B02' }]);
    expect(db.prepare('SELECT cargo_id FROM fatos').all()).toMatchObject([{ cargo_id: 'B02' }]);
    expect(db.prepare('SELECT id, seed_versao FROM cargos').all()).toMatchObject([{ id: 'B02', seed_versao: 1 }]);
    expect(db.prepare('SELECT cargo_id, nucleo_id, descricao FROM cargo_nucleos').all()).toMatchObject([{ cargo_id: 'B02', nucleo_id: 'CG', descricao: 'desc CG' }]);
    expect(db.prepare('SELECT meta_diaria_min, meta_semanal_min FROM configuracoes').get()).toMatchObject({ meta_diaria_min: 111, meta_semanal_min: 222 });
    expect(db.prepare('SELECT id, realizado_min FROM sessoes_estudo').all()).toMatchObject([{ id: 's1', realizado_min: 50 }]);

    // Rodar de novo não faz nada; a versão do edital do B02 já gravada não é regravada, e o A01 entra sem tocar no B02.
    expect(migrar(db)).toEqual([]);
    expect(sincronizarEdital(db, seed)).toBe(false);
    expect(db.prepare('SELECT nome FROM cargos WHERE id = ?').get('B02')).toMatchObject({ nome: seed.cargo!.nome });
    expect(sincronizarEdital(db, seedA01)).toBe(true);
    expect(db.prepare("SELECT COUNT(*) AS n FROM disciplinas WHERE cargo_id = 'B02'").get()).toMatchObject({ n: 1 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM topicos WHERE id LIKE 'a%'").get()).toMatchObject({ n: seedA01.topicos.length });
    expect(db.prepare('SELECT valor FROM meta WHERE chave = ?').get('seed_versao')).toMatchObject({ valor: '1' });
    db.close();
  });

  test('o edital de cada cargo volta do banco idêntico ao seed e um não vaza no outro', () => {
    const db = abrirBanco(':memory:');
    prepararEditais(db);
    expect(lerEdital(db, 'B02')).toEqual(seed);
    expect(lerEdital(db, 'A01')).toEqual(seedA01);
    const idsB = new Set(seed.topicos.map((t) => t.id));
    expect(seedA01.topicos.some((t) => idsB.has(t.id))).toBe(false);
    expect(seedA01.disciplinas.some((d) => seed.disciplinas.some((x) => x.id === d.id))).toBe(false);
    expect(() => lerEdital(db, 'XYZ')).toThrow(/ainda não foi gravada/);
    db.close();
  });

  test('o seed do A01 é coerente: referências, dependências, ciclo e prioridades', () => {
    const disc = new Set(seedA01.disciplinas.map((d) => d.id));
    const top = new Set(seedA01.topicos.map((t) => t.id));
    expect(seedA01.disciplinas).toHaveLength(14);
    expect(seedA01.topicos.every((t) => disc.has(t.disciplinaId))).toBe(true);
    expect(seedA01.dependenciasSugeridas.every((d) => top.has(d.de) && top.has(d.para) && d.de !== d.para)).toBe(true);
    expect(seedA01.cargo!.cicloInicial.every(([d, m]) => disc.has(d) && m >= 5 && m <= 600)).toBe(true);
    expect(new Set(seedA01.cargo!.cicloInicial.map(([d]) => d))).toEqual(disc);
    expect(seedA01.topicos.every((t) => ['Urgente', 'Alta', 'Média', 'Baixa'].includes(t.prioridadePlanilha) && t.incidencia.length > 10)).toBe(true);
    expect(seedA01.topicos.every((t) => t.ref.documento && t.ref.paginas.length > 0)).toBe(true);
    const d = criarDados(seedA01);
    expect(d.user.ciclo.itens).toHaveLength(seedA01.cargo!.cicloInicial.length);
    expect(d.user.dependencias).toHaveLength(seedA01.dependenciasSugeridas.length);
    expect(d.user.config.dataProva).toBe('2027-01-17');
  });
});
