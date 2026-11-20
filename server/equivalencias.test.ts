import { createServer, type Server } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { abrirBanco } from './db';
import { prepararEditais, SEEDS } from './cargos';
import { EQUIVALENCIAS, lerEquivalencias, sincronizarEquivalencias } from './equivalencias';
import { criarApp, VALOR_CSRF } from './app';
import { lerConfig } from './config';
import * as auth from './auth';
import { configurarLog } from './log';
import type { BD } from './sqlite';

configurarLog('erro', true);

// Pares próprios do teste: crase e concordância (B02 × IFG, e crase também no A01) e LGPD (um × um).
const PARES = [
  { a: 't003', b: 'i008' }, // crase
  { a: 'a003', b: 'i008' },
  { a: 'a003', b: 't003' },
  { a: 't015', b: 'i015' }, // concordância
  { a: 't239', b: 'i031' }, // LGPD
];

describe('lista de equivalências', () => {
  test('a lista do repositório é válida: conteúdos existentes, de editais diferentes, sem repetição', () => {
    const db = abrirBanco(':memory:');
    prepararEditais(db);
    const n = (db.prepare('SELECT COUNT(*) AS n FROM equivalencias').get() as { n: number }).n;
    expect(n).toBe(EQUIVALENCIAS.length);
    expect(sincronizarEquivalencias(db)).toBe(false); // nada mudou
    db.close();
  });

  test('recusa pares inválidos e regrava a tabela quando a lista muda', () => {
    const db = abrirBanco(':memory:');
    prepararEditais(db, SEEDS, PARES);
    expect(() => sincronizarEquivalencias(db, [{ a: 't001', b: 't002' }])).toThrow(/mesmo edital/);
    expect(() => sincronizarEquivalencias(db, [{ a: 't001', b: 'zzz' }])).toThrow(/desconhecido/);
    expect(lerEquivalencias(db).get('i008')).toEqual([{ topicoId: 'a003', cargoId: 'A01' }, { topicoId: 't003', cargoId: 'B02' }]);
    expect(sincronizarEquivalencias(db, [{ a: 'i008', b: 't003' }])).toBe(true); // a ordem do par não importa
    expect(lerEquivalencias(db).get('t003')).toEqual([{ topicoId: 'i008', cargoId: 'IFG308' }]);
    db.close();
  });
});

describe('progresso compartilhado entre editais da mesma conta (API)', () => {
  let pasta: string;
  let db: BD;
  let srv: Server;
  let base: string;

  beforeAll(async () => {
    pasta = mkdtempSync(join(tmpdir(), 'estudo-equiv-'));
    db = abrirBanco(join(pasta, 'estudo.db'));
    const cfg = { ...lerConfig({}), cookieSeguro: false, pastaDados: pasta, pastaBackups: join(pasta, 'backups'), pastaWeb: join(pasta, 'web') };
    srv = createServer(criarApp(db, prepararEditais(db, SEEDS, PARES).porCargo, cfg));
    await new Promise<void>((ok) => srv.listen(0, '127.0.0.1', ok));
    base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
    await auth.criarUsuario(db, { email: 'gestor@exemplo.com', nome: 'Admin', senha: 'cofre-de-aco-1234', cargoId: 'B02', papel: 'admin' });
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
    return { status: r.status, json: await r.json().catch(() => null), cookie: r.headers.get('set-cookie')?.split(';')[0] };
  };
  let ck = '';
  const acao = (a: unknown, edital?: string) => req('/api/acoes', { metodo: 'POST', cookie: ck, edital, corpo: { acao: a } });
  const topicos = async (edital?: string) => (await req('/api/dados', { cookie: ck, edital })).json.dados.user.topicos;
  const inscrever = (cargoId: string, ativa = true) => req('/api/admin/usuarios/editais', { metodo: 'POST', cookie: ck, corpo: { id: 1, cargoId, ativa } });

  test('o progresso passa para o equivalente; a prioridade e o "pular" ficam em cada edital', async () => {
    ck = (await req('/api/auth/entrar', { metodo: 'POST', corpo: { email: 'gestor@exemplo.com', senha: 'cofre-de-aco-1234' } })).cookie!;
    // Um conteúdo estudado no B02 antes de a conta ter o IFG.
    expect((await acao({ t: 'status', topicoId: 't015', status: 'estudado' })).status).toBe(200);
    expect((await inscrever('IFG308')).status).toBe(200);
    // O plano novo do IFG já começa com o progresso do equivalente.
    const inicio = await topicos('IFG308');
    expect(inicio.i015).toMatchObject({ status: 'estudado' });
    expect(inicio.i015.concluidoEm).toBe((await topicos()).t015.concluidoEm);

    // Situação, dominado, anotações e revisões vão do B02 para o IFG...
    expect((await acao({ t: 'status', topicoId: 't003', status: 'estudado' })).status).toBe(200);
    expect((await acao({ t: 'dominado', topicoId: 't003', valor: true })).status).toBe(200);
    expect((await acao({ t: 'notas', topicoId: 't003', texto: 'crase antes de palavra feminina' })).status).toBe(200);
    expect((await acao({ t: 'revisao', topicoId: 't003' })).status).toBe(200);
    // ...mas a prioridade não.
    expect((await acao({ t: 'prioridade', topicoId: 't003', valor: 'Baixa' })).status).toBe(200);
    const b = (await topicos()).t003;
    const i = (await topicos('IFG308')).i008;
    expect(i).toMatchObject({ status: b.status, dominado: true, notas: 'crase antes de palavra feminina', revisoesFeitas: b.revisoesFeitas, concluidoEm: b.concluidoEm, ultimoEstudo: b.ultimoEstudo });
    expect(b.prioridade).toBe('Baixa');
    expect(i.prioridade).toBeUndefined();

    // E no sentido contrário: do IFG para o B02, sem levar a prioridade do IFG.
    expect((await acao({ t: 'prioridade', topicoId: 'i008', valor: 'Urgente' }, 'IFG308')).status).toBe(200);
    expect((await acao({ t: 'status', topicoId: 'i008', status: 'em_revisao' }, 'IFG308')).status).toBe(200);
    expect((await topicos()).t003).toMatchObject({ status: 'em_revisao', prioridade: 'Baixa' });
    expect((await topicos('IFG308')).i008.prioridade).toBe('Urgente');

    // Uma sessão de estudo que marca o conteúdo também conta para o equivalente.
    const sessao = { data: '2026-11-20', disciplinaId: 'legti', topicoId: 't239', planejadoMin: 30, realizadoMin: 30, notas: '', origem: 'manual', cicloItemId: null };
    expect((await acao({ t: 'sessaoSalvar', sessao, novoStatus: 'estudado' })).status).toBe(200);
    expect((await topicos('IFG308')).i031).toMatchObject({ status: 'estudado' });
    // As horas não: a sessão fica só no edital em que foi registrada.
    expect((await req('/api/dados', { cookie: ck, edital: 'IFG308' })).json.dados.user.sessoes).toEqual([]);
  });

  test('a tela recebe os equivalentes com a prioridade e a situação do outro edital', async () => {
    const r = (await req('/api/equivalentes', { cookie: ck, edital: 'IFG308' })).json;
    expect(r.i008).toEqual([{ cargoId: 'B02', topicoId: 't003', titulo: 'Emprego do sinal indicativo de crase', prioridade: 'Baixa', status: 'em_revisao' }]);
    expect(r.i001).toBeUndefined();
    // O A01 não está na conta: não aparece.
    expect(Object.values(r).flat().some((e) => (e as { cargoId: string }).cargoId === 'A01')).toBe(false);
    const doB02 = (await req('/api/equivalentes', { cookie: ck })).json;
    expect(doB02.t003).toMatchObject([{ cargoId: 'IFG308', topicoId: 'i008', prioridade: 'Urgente' }]);
  });

  test('não copia para edital retirado; importar e reiniciar não mexem nos outros editais', async () => {
    expect((await inscrever('IFG308', false)).status).toBe(200);
    expect((await acao({ t: 'status', topicoId: 't015', status: 'nao_iniciado' })).status).toBe(200);
    expect((await inscrever('IFG308')).status).toBe(200);
    expect((await topicos('IFG308')).i015.status).toBe('estudado');

    const antes = await topicos('IFG308');
    expect((await acao({ t: 'reiniciar' })).status).toBe(200);
    expect((await topicos()).t003).toBeUndefined();
    expect(await topicos('IFG308')).toEqual(antes);

    // Com três editais, uma mudança chega aos dois equivalentes.
    expect((await inscrever('A01')).status).toBe(200);
    expect((await acao({ t: 'status', topicoId: 'i008', status: 'em_andamento' }, 'IFG308')).status).toBe(200);
    expect((await topicos()).t003.status).toBe('em_andamento');
    expect((await topicos('A01')).a003.status).toBe('em_andamento');
  });
});
