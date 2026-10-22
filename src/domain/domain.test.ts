import seedJson from '../data/seed.json';
import type { AppData, Seed } from './types';
import { criarDados } from './defaults';
import { reduzir, ErroAcao, type Acao } from './actions';
import { contar, topicosDaDisciplina, topicosDoNucleo, serieConclusao } from './progress';
import { proximoItem, mover, avancar, definirAtivo, ativos, distribuicaoSugerida, prioridadeDisciplina } from './cycle';
import * as tm from './timer';
import { proximoTopico, recomendacoes } from './recommend';
import { criaCiclo } from './deps';
import { proximaRevisao, revisoesDevidas } from './revisions';
import { somaMin, porDisciplina, porNucleo, seriePorSemana, medias, seriePorMes, cumprimentoMetas } from './stats';
import { validarAppData } from './validate';

const seed = seedJson as unknown as Seed;
const T0 = new Date(2026, 9, 26, 9, 0).getTime(); // 26/10/2026 09:00
const ctx = (agora = T0) => ({ seed, agora });
const novo = (): AppData => {
  const d = criarDados(seed, '2026-10-21');
  d.user.topicos = {}; // começa sem os "Estudando" da planilha para os testes ficarem previsíveis
  return d;
};
const run = (d: AppData, ...acoes: Acao[]) => acoes.reduce((acc, a) => reduzir(acc, a, ctx()), d);

describe('estrutura do edital', () => {
  it('tem 14 disciplinas, 253 tópicos únicos e só dois núcleos', () => {
    expect(seed.disciplinas).toHaveLength(14);
    expect(new Set(seed.topicos.map((t) => t.id)).size).toBe(253);
    expect(new Set(seed.disciplinas.map((d) => d.nucleo))).toEqual(new Set(['CG', 'CE']));
    expect(topicosDoNucleo(seed.topicos, seed.disciplinas, 'CG')).toHaveLength(51);
    expect(topicosDoNucleo(seed.topicos, seed.disciplinas, 'CE')).toHaveLength(202);
  });
  it('todo tópico aponta para páginas do Anexo II (19 a 22)', () => {
    for (const t of seed.topicos) {
      expect(t.ref.paginas.length).toBeGreaterThan(0);
      for (const p of t.ref.paginas) expect(p >= 19 && p <= 22).toBe(true);
    }
  });
  it('trechos citados existem literalmente no texto oficial da disciplina', () => {
    for (const t of seed.topicos) {
      if (!t.ref.trecho) continue;
      const d = seed.disciplinas.find((x) => x.id === t.disciplinaId)!;
      expect(d.textoOficial.includes(t.ref.trecho)).toBe(true);
    }
  });
  it('dependências sugeridas não têm ciclos', () => {
    const deps = seed.dependenciasSugeridas;
    for (const d of deps) {
      const resto = deps.filter((x) => x !== d);
      expect(criaCiclo(resto, d.de, d.para)).toBe(false);
    }
  });
});

describe('cálculo de progresso', () => {
  it('concluído = Estudado ou Em revisão; Em andamento não conta', () => {
    const d = run(novo(), { t: 'status', topicoId: 't141', status: 'estudado' }, { t: 'status', topicoId: 't142', status: 'em_revisao' }, { t: 'status', topicoId: 't143', status: 'em_andamento' });
    const bd = contar(topicosDaDisciplina(seed.topicos, 'bd'), d.user);
    expect(bd.total).toBe(16);
    expect(bd.concluidos).toBe(2);
    expect(bd.emAndamento).toBe(1);
    expect(bd.pendentes).toBe(14);
    expect(bd.pct).toBeCloseTo(2 / 16);
    const geral = contar(seed.topicos, d.user);
    expect(geral.concluidos).toBe(2);
    expect(geral.pct).toBeCloseTo(2 / 253);
    const ce = contar(topicosDoNucleo(seed.topicos, seed.disciplinas, 'CE'), d.user);
    const cg = contar(topicosDoNucleo(seed.topicos, seed.disciplinas, 'CG'), d.user);
    expect(ce.concluidos + cg.concluidos).toBe(geral.concluidos);
  });
  it('dominado não infla a conclusão e exige tópico estudado', () => {
    let d = novo();
    expect(() => run(d, { t: 'dominado', topicoId: 't141', valor: true })).toThrow(ErroAcao);
    d = run(d, { t: 'status', topicoId: 't141', status: 'estudado' }, { t: 'dominado', topicoId: 't141', valor: true });
    const c = contar(seed.topicos, d.user);
    expect(c.concluidos).toBe(1);
    expect(c.dominados).toBe(1);
  });
  it('reabrir um tópico tira da conclusão mas mantém sessões e histórico', () => {
    let d = run(novo(), { t: 'sessaoSalvar', sessao: { data: '2026-10-26', disciplinaId: 'bd', topicoId: 't141', planejadoMin: 60, realizadoMin: 55, notas: '', origem: 'manual', cicloItemId: null }, novoStatus: 'estudado' });
    expect(contar(seed.topicos, d.user).concluidos).toBe(1);
    const hist = d.user.historico.length;
    d = run(d, { t: 'status', topicoId: 't141', status: 'em_andamento' });
    expect(contar(seed.topicos, d.user).concluidos).toBe(0);
    expect(d.user.sessoes).toHaveLength(1);
    expect(d.user.historico.length).toBe(hist + 1);
    expect(d.user.topicos.t141.concluidoEm).toBeUndefined();
  });
  it('série de conclusão é acumulada por data', () => {
    const d = novo();
    d.user.topicos = {
      t001: { status: 'estudado', dominado: false, notas: '', revisoesFeitas: 0, concluidoEm: '2026-10-26' },
      t002: { status: 'em_revisao', dominado: false, notas: '', revisoesFeitas: 1, concluidoEm: '2026-10-28' },
    };
    const s = serieConclusao(seed.topicos, d.user, ['2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28']);
    expect(s.map((x) => x.concluidos)).toEqual([0, 1, 1, 2]);
  });
});

describe('cronômetro', () => {
  const base = { id: 's1', disciplinaId: 'bd', topicoId: 't141', cicloItemId: null, planejadoMin: 60 };
  it('não conta tempo pausado', () => {
    let t = tm.iniciar(base, 0);
    t = tm.pausar(t, 10 * 60000); // 10 min
    t = tm.retomar(t, 40 * 60000); // 30 min pausado
    expect(tm.decorridoMs(t, 55 * 60000)).toBe(25 * 60000);
    expect(tm.finalizar(t, 55 * 60000).realizadoMin).toBe(25);
  });
  it('pausar duas vezes não muda o acumulado', () => {
    let t = tm.iniciar(base, 0);
    t = tm.pausar(t, 5000);
    t = tm.pausar(t, 999999);
    expect(t.acumuladoMs).toBe(5000);
  });
  it('finalizar duas vezes não duplica a sessão', () => {
    const t = tm.iniciar(base, 0);
    const s1 = tm.finalizar(t, 30 * 60000);
    const s2 = tm.finalizar(t, 31 * 60000);
    const lista = tm.upsertSessao(tm.upsertSessao([], s1), s2);
    expect(lista).toHaveLength(1);
    expect(lista[0].realizadoMin).toBe(31);
  });
  it('fluxo pelo reducer: iniciar, pausar, finalizar avança o ciclo', () => {
    let d = novo();
    const item = proximoItem(d.user.ciclo)!;
    d = reduzir(d, { t: 'timerIniciar', disciplinaId: item.disciplinaId, topicoId: null, cicloItemId: item.id, planejadoMin: item.minutos }, ctx(T0));
    d = reduzir(d, { t: 'timerPausar' }, ctx(T0 + 20 * 60000));
    d = reduzir(d, { t: 'timerRetomar' }, ctx(T0 + 50 * 60000));
    d = reduzir(d, { t: 'timerFinalizar', notas: 'ok', novoStatus: null }, ctx(T0 + 80 * 60000));
    expect(d.user.timer).toBeNull();
    expect(d.user.sessoes).toHaveLength(1);
    expect(d.user.sessoes[0].realizadoMin).toBe(50);
    expect(d.user.sessoes[0].planejadoMin).toBe(item.minutos);
    expect(proximoItem(d.user.ciclo)!.id).not.toBe(item.id);
  });
  it('não deixa iniciar dois cronômetros', () => {
    const d = run(novo(), { t: 'timerIniciar', disciplinaId: 'bd', topicoId: null, cicloItemId: null, planejadoMin: 60 });
    expect(() => run(d, { t: 'timerIniciar', disciplinaId: 'lp', topicoId: null, cicloItemId: null, planejadoMin: 60 })).toThrow(ErroAcao);
  });
});

describe('ciclo de estudos', () => {
  it('reordenar mantém o próximo item e não toca nas sessões', () => {
    let d = run(novo(), { t: 'sessaoSalvar', sessao: { data: '2026-10-26', disciplinaId: 'es', topicoId: null, planejadoMin: 90, realizadoMin: 90, notas: '', origem: 'manual', cicloItemId: 'ci01' }, avancarCiclo: true });
    const prox = proximoItem(d.user.ciclo)!.id;
    const sessoes = d.user.sessoes;
    d = run(d, { t: 'cicloMover', de: 5, para: 0 });
    expect(d.user.ciclo.itens[0].id).toBe('ci06');
    expect(proximoItem(d.user.ciclo)!.id).toBe(prox);
    expect(d.user.sessoes).toBe(sessoes);
  });
  it('mover fora dos limites não altera', () => {
    const c = novo().user.ciclo;
    expect(mover(c, 0, 99)).toBe(c);
  });
  it('avançar dá a volta e incrementa o número do ciclo', () => {
    let c = novo().user.ciclo;
    const n = ativos(c).length;
    for (let i = 0; i < n; i++) c = avancar(c, proximoItem(c)!.id);
    expect(c.numero).toBe(2);
    expect(proximoItem(c)!.id).toBe('ci01');
  });
  it('sessão fora de ordem não avança o ciclo', () => {
    const c = novo().user.ciclo;
    expect(avancar(c, 'ci05')).toBe(c);
  });
  it('desativar o próximo passa para o seguinte ativo; reativar mantém histórico', () => {
    let c = novo().user.ciclo;
    c = definirAtivo(c, 'ci01', false);
    expect(proximoItem(c)!.id).toBe('ci02');
    c = definirAtivo(c, 'ci01', true);
    expect(c.itens.find((i) => i.id === 'ci01')!.ativo).toBe(true);
  });
  it('remover item do ciclo mantém as sessões da disciplina', () => {
    let d = run(novo(), { t: 'sessaoSalvar', sessao: { data: '2026-10-26', disciplinaId: 'ing', topicoId: null, planejadoMin: 30, realizadoMin: 30, notas: '', origem: 'manual', cicloItemId: 'ci22' } });
    d = run(d, { t: 'cicloRemover', itemId: 'ci22' });
    expect(d.user.ciclo.itens.some((i) => i.id === 'ci22')).toBe(false);
    expect(porDisciplina(d.user.sessoes).ing).toBe(30);
  });
});

describe('distribuição de tempo', () => {
  it('reparte o total em blocos de 15 min e dá mais tempo a Específicos', () => {
    const d = novo();
    const m = distribuicaoSugerida(d.user.ciclo, seed.disciplinas, seed.topicos, d.user, 1800);
    expect(Object.keys(m)).toHaveLength(ativos(d.user.ciclo).length);
    expect(Object.values(m).every((v) => v >= 15 && v % 15 === 0)).toBe(true);
    const soma = Object.values(m).reduce((a, b) => a + b, 0);
    expect(Math.abs(soma - 1800)).toBeLessThanOrEqual(15 * ativos(d.user.ciclo).length);
    const ing = m.ci22, es = m.ci01;
    expect(es).toBeGreaterThan(ing);
  });
  it('prioridade da disciplina definida pelo usuário aumenta a fatia dela', () => {
    let d = novo();
    const antes = distribuicaoSugerida(d.user.ciclo, seed.disciplinas, seed.topicos, d.user, 1800).ci22;
    d = run(d, { t: 'prioridadeDisciplina', disciplinaId: 'ing', valor: 'Urgente' });
    expect(prioridadeDisciplina(seed.disciplinas.find((x) => x.id === 'ing')!, seed.topicos, d.user)).toEqual({ p: 'Urgente', propria: true });
    expect(distribuicaoSugerida(d.user.ciclo, seed.disciplinas, seed.topicos, d.user, 1800).ci22).toBeGreaterThan(antes);
  });
});

describe('pré-requisitos e recomendações', () => {
  it('recomenda o pré-requisito obrigatório antes do tópico mais prioritário', () => {
    // t144 (SQL consultas, Urgente) depende obrigatoriamente de t143 (SQL DDL/DML/DCL).
    // Com t141 e t142 concluídos, o candidato de maior prioridade é t143 ou t144; forçamos t144 em andamento.
    let d = run(novo(), { t: 'status', topicoId: 't141', status: 'estudado' }, { t: 'status', topicoId: 't142', status: 'estudado' }, { t: 'status', topicoId: 't144', status: 'em_andamento' });
    const r = proximoTopico(seed.topicos, seed.disciplinas, d.user, d.user.dependencias, 'bd')!;
    expect(r.topico.id).toBe('t143');
    expect(r.tipo).toBe('prerequisito');
    d = run(d, { t: 'status', topicoId: 't143', status: 'estudado' });
    expect(proximoTopico(seed.topicos, seed.disciplinas, d.user, d.user.dependencias, 'bd')!.topico.id).toBe('t144');
  });
  it('pré-requisito recomendado não redireciona, só avisa', () => {
    const d = run(novo(), { t: 'status', topicoId: 't146', status: 'em_andamento' });
    // t149 (PostgreSQL) recomenda t146; t146 em andamento vem primeiro de qualquer forma
    const r = proximoTopico(seed.topicos, seed.disciplinas, d.user, d.user.dependencias, 'bd')!;
    expect(r.topico.id).toBe('t146');
  });
  it('prioridade editada pelo usuário muda a recomendação sem perder registros', () => {
    let d = run(novo(), { t: 'sessaoSalvar', sessao: { data: '2026-10-26', disciplinaId: 'mat', topicoId: 't034', planejadoMin: 60, realizadoMin: 60, notas: '', origem: 'manual', cicloItemId: null } });
    d = run(d, { t: 'status', topicoId: 't034', status: 'estudado' });
    const antes = proximoTopico(seed.topicos, seed.disciplinas, d.user, d.user.dependencias, 'mat')!.topico.id;
    d = run(d, { t: 'prioridade', topicoId: 't033', valor: 'Urgente' });
    expect(proximoTopico(seed.topicos, seed.disciplinas, d.user, d.user.dependencias, 'mat')!.topico.id).toBe('t033');
    expect(antes).not.toBe('t033');
    expect(d.user.sessoes).toHaveLength(1);
  });
  it('bloqueia dependência circular', () => {
    const d = novo();
    expect(() => run(d, { t: 'depAdicionar', de: 't144', para: 't143', tipo: 'obrigatorio' })).toThrow(/ciclo/);
  });
  it('recomendações explicam o motivo e incluem a próxima do ciclo', () => {
    const d = novo();
    const rs = recomendacoes(seed.topicos, seed.disciplinas, d.user, '2026-10-26');
    expect(rs.length).toBeGreaterThan(0);
    expect(rs[0].disciplina.id).toBe(proximoItem(d.user.ciclo)!.disciplinaId);
    expect(rs[0].motivos.join(' ')).toMatch(/próxima disciplina do ciclo/);
  });
});

describe('revisões', () => {
  it('calcula vencimento pelos intervalos configurados', () => {
    let d = run(novo(), { t: 'status', topicoId: 't141', status: 'estudado' });
    const e = d.user.topicos.t141;
    expect(proximaRevisao(e, d.user.config)).toBe('2026-10-27');
    d = reduzir(d, { t: 'revisao', topicoId: 't141' }, ctx(new Date(2026, 9, 27, 9).getTime()));
    expect(proximaRevisao(d.user.topicos.t141, d.user.config)).toBe('2026-11-03');
    expect(d.user.topicos.t141.status).toBe('em_revisao');
    expect(revisoesDevidas(seed.topicos, d.user, '2026-11-03').map((r) => r.topico.id)).toEqual(['t141']);
  });
});

describe('horas e correções', () => {
  const s = (id: string, data: string, disc: string, min: number) => ({ id, data, disciplinaId: disc, topicoId: null, planejadoMin: 60, realizadoMin: min, notas: '', origem: 'manual' as const, cicloItemId: null });
  it('editar e excluir sessões recalcula os totais', () => {
    let d = run(novo(), { t: 'sessaoSalvar', sessao: s('a', '2026-10-26', 'bd', 50) }, { t: 'sessaoSalvar', sessao: s('b', '2026-10-27', 'lp', 70) });
    expect(somaMin(d.user.sessoes)).toBe(120);
    expect(porNucleo(d.user.sessoes, seed.disciplinas)).toEqual({ CG: 70, CE: 50 });
    d = run(d, { t: 'sessaoSalvar', sessao: s('a', '2026-10-26', 'bd', 30) });
    expect(d.user.sessoes).toHaveLength(2);
    expect(somaMin(d.user.sessoes)).toBe(100);
    d = run(d, { t: 'sessaoExcluir', id: 'b' });
    expect(somaMin(d.user.sessoes)).toBe(30);
    expect(porNucleo(d.user.sessoes, seed.disciplinas)).toEqual({ CG: 0, CE: 30 });
  });
  it('rejeita duração inválida', () => {
    expect(() => run(novo(), { t: 'sessaoSalvar', sessao: s('x', '2026-10-26', 'bd', 0) })).toThrow(ErroAcao);
  });
  it('séries semanais e médias', () => {
    const d = run(novo(), { t: 'sessaoSalvar', sessao: s('a', '2026-10-26', 'bd', 60) }, { t: 'sessaoSalvar', sessao: s('b', '2026-11-02', 'bd', 120) });
    const w = seriePorSemana(d.user.sessoes, '2026-10-26', '2026-11-08');
    expect(w.map((x) => x.min)).toEqual([60, 120]);
    expect(w.map((x) => x.planejado)).toEqual([60, 60]);
    const m = medias(d.user.sessoes, '2026-11-04');
    expect(m.dias).toBe(10);
    expect(m.diaria).toBeCloseTo(18);
  });
});

describe('importação', () => {
  it('aceita um backup válido e rejeita um corrompido', () => {
    const d = novo();
    expect(validarAppData(JSON.parse(JSON.stringify(d)), seed)).toEqual([]);
    const ruim = JSON.parse(JSON.stringify(d));
    ruim.user.sessoes = [{ id: 'x', data: 'ontem', disciplinaId: 'zzz', realizadoMin: -1, planejadoMin: 0 }];
    expect(validarAppData(ruim, seed).length).toBeGreaterThan(0);
  });
});

describe('metas e séries mensais', () => {
  const sess = (data: string, min: number) => ({ id: data + min, data, disciplinaId: 'lp', topicoId: null, planejadoMin: 60, realizadoMin: min, notas: '', origem: 'manual' as const, cicloItemId: null, criadoEm: '', atualizadoEm: '' });
  test('série por mês inclui meses sem estudo e vira o ano', () => {
    const r = seriePorMes([sess('2026-11-03', 30), sess('2027-01-10', 45)], '2026-11-01', '2027-01-31');
    expect(r.map((x) => [x.chave, x.min])).toEqual([['2026-11', 30], ['2026-12', 0], ['2027-01', 45]]);
  });
  test('cumprimento de metas conta dias e semanas completas até hoje', () => {
    // Semana de 05/10 a 11/10/2026 (seg a dom) com 300 min; 12/10 é a semana atual.
    const ss = [sess('2026-10-05', 120), sess('2026-10-06', 60), sess('2026-10-07', 120), sess('2026-10-12', 100)];
    const r = cumprimentoMetas(ss, '2026-10-05', '2026-10-20', '2026-10-12', 100, 300);
    expect(r).toEqual({ dias: 8, diasNaMeta: 3, semanas: 1, semanasNaMeta: 1, semanaAtualMin: 100 });
  });
});

describe('reinício e ids determinísticos', () => {
  test('a mesma ação com o mesmo horário e ids gera o mesmo estado', () => {
    const d = criarDados(seed, '2026-10-01', 0);
    const ids = ['ci-fixo', 'ev-fixo'];
    const ctx = () => { const f = [...ids]; return { seed, agora: 1000, gerarId: () => f.shift()! }; };
    const a = reduzir(d, { t: 'cicloAdicionar', disciplinaId: 'ing', minutos: 30 }, ctx());
    const b = reduzir(d, { t: 'cicloAdicionar', disciplinaId: 'ing', minutos: 30 }, ctx());
    expect(a).toEqual(b);
    expect(a.user.ciclo.itens.at(-1)!.id).toBe('ci-fixo');
  });
  test('reiniciar volta ao plano inicial e registra no histórico', () => {
    let d = criarDados(seed, '2026-10-01', 0);
    d = reduzir(d, { t: 'status', topicoId: 't001', status: 'estudado' }, { seed, agora: 1000 });
    const r = reduzir(d, { t: 'reiniciar' }, { seed, agora: 2000 });
    expect(r.user.topicos.t001).toEqual(criarDados(seed).user.topicos.t001);
    expect(r.user.historico[0].descricao).toMatch(/apagados/);
  });
  test('data da prova pode ficar vazia, mas não inválida', () => {
    const d = criarDados(seed);
    expect(reduzir(d, { t: 'config', valor: { dataProva: '' } }, { seed, agora: 0 }).user.config.dataProva).toBe('');
    expect(() => reduzir(d, { t: 'config', valor: { dataProva: '2027-13-45' } }, { seed, agora: 0 })).toThrow(ErroAcao);
    expect(() => reduzir(d, { t: 'config', valor: { fusoHorario: 'Lua/Base' } }, { seed, agora: 0 })).toThrow(ErroAcao);
  });
});
