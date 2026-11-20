import seedJson from '../data/seed-ifg308.json';
import { calcularRitmo, RETA_FINAL_DIAS } from './ritmo';
import { criarDados } from './defaults';
import type { Seed, Sessao, TopicoEstado, UserData } from './types';

const seed = seedJson as unknown as Seed; // 133 conteúdos
const HOJE = '2026-11-20';

function base(prova = '2026-12-23'): UserData {
  const u = criarDados(seed, HOJE, Date.parse('2026-11-20T12:00:00Z')).user;
  u.config.dataProva = prova; // alvo: 20/12, 31 dias contando hoje
  return u;
}
const concluido = (data: string): TopicoEstado => ({ status: 'estudado', dominado: false, notas: '', revisoesFeitas: 0, concluidoEm: data, ultimoEstudo: data });
const sessao = (data: string): Sessao => ({ id: `s-${data}`, data, disciplinaId: 'ifgqui', topicoId: null, planejadoMin: 60, realizadoMin: 60, notas: '', origem: 'manual', cicloItemId: null, criadoEm: data, atualizadoEm: data });

describe('ritmo para terminar o edital', () => {
  test('primeiro dia de estudo: meta do dia, mas sem projeção', () => {
    const u = base();
    u.topicos[seed.topicos[0].id] = concluido(HOJE);
    expect(calcularRitmo(seed.topicos, u, HOJE)).toMatchObject({ historicoDias: 1, concluidosHoje: 1, metaHoje: 5, projecaoDias: null, situacao: 'sem-ritmo' });
  });

  test('conta nova: o necessário por dia vai até a data-alvo, alguns dias antes da prova; sem ritmo atual', () => {
    const r = calcularRitmo(seed.topicos, base(), HOJE);
    expect(RETA_FINAL_DIAS).toBe(3);
    expect(r).toMatchObject({ total: 133, concluidos: 0, restantes: 133, dataAlvo: '2026-12-20', diasDisponiveis: 31, atualDia: 0, projecaoDias: null, situacao: 'sem-ritmo' });
    expect(r.necessarioDia).toBeCloseTo(133 / 31);
    expect(r.metaHoje).toBe(5);
  });

  test('o necessário e a meta de hoje não mudam ao concluir conteúdos durante o dia', () => {
    const u = base();
    const antes = calcularRitmo(seed.topicos, u, HOJE);
    for (const t of seed.topicos.slice(0, 3)) u.topicos[t.id] = concluido(HOJE);
    const depois = calcularRitmo(seed.topicos, u, HOJE);
    expect(depois.concluidosHoje).toBe(3);
    expect(depois.restantes).toBe(130);
    expect(depois.necessarioDia).toBe(antes.necessarioDia);
    expect(depois.metaHoje).toBe(antes.metaHoje);
  });

  test('quem começou há pouco tem o ritmo medido desde o primeiro estudo (mínimo de 7 dias)', () => {
    const u = base();
    for (const t of seed.topicos.slice(0, 20)) u.topicos[t.id] = concluido('2026-11-15');
    u.sessoes = [sessao('2026-11-11')]; // primeiro estudo há 10 dias
    expect(calcularRitmo(seed.topicos, u, HOJE)).toMatchObject({ janelaDias: 10, atualDia: 2 });
    u.sessoes = [sessao('2026-11-19')]; // conteúdos de 15/11: 6 dias de histórico, janela mínima de 7 e ainda sem projeção
    expect(calcularRitmo(seed.topicos, u, HOJE)).toMatchObject({ historicoDias: 6, janelaDias: 7, projecaoDias: null, situacao: 'sem-ritmo' });
    u.sessoes = [sessao('2026-08-01')]; // estuda há meses: últimas 4 semanas
    expect(calcularRitmo(seed.topicos, u, HOJE)).toMatchObject({ janelaDias: 28, atualDia: 20 / 28 });
  });

  test('projeção, folga e situação contra a data-alvo', () => {
    const u = base();
    u.sessoes = [sessao('2026-11-11')];
    for (const t of seed.topicos.slice(0, 50)) u.topicos[t.id] = concluido('2026-11-15'); // 5 por dia em 10 dias
    const r = calcularRitmo(seed.topicos, u, HOJE);
    expect(r.projecaoDias).toBe(Math.ceil(83 / 5)); // 17 dias
    expect(r.projecaoData).toBe('2026-12-07');
    expect(r.folgaDias).toBe(13);
    expect(r.situacao).toBe('ok');

    u.config.dataProva = '2026-12-05'; // alvo 02/12: termina 5 dias depois
    expect(calcularRitmo(seed.topicos, u, HOJE)).toMatchObject({ folgaDias: -5, situacao: 'atras' });
    u.config.dataProva = '2026-11-22'; // alvo 19/11 já passou
    expect(calcularRitmo(seed.topicos, u, HOJE)).toMatchObject({ diasDisponiveis: 0, necessarioDia: null, situacao: 'prazo-encerrado' });
    u.config.dataProva = '';
    expect(calcularRitmo(seed.topicos, u, HOJE)).toMatchObject({ dataAlvo: null, necessarioDia: null, situacao: 'sem-prova' });
    for (const t of seed.topicos) u.topicos[t.id] = concluido('2026-11-15');
    expect(calcularRitmo(seed.topicos, u, HOJE)).toMatchObject({ restantes: 0, metaHoje: null, situacao: 'concluido' });
  });
});
