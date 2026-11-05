import seedJson from '../data/seed-a01.json';
import { detalhar, resumir } from './acompanhamento';
import { criarDados } from './defaults';
import type { Seed, Sessao, UserData } from './types';

const seed = seedJson as unknown as Seed;
const HOJE = '2026-11-10'; // terça-feira (a semana atual começa na segunda, 09/11)

function base(): UserData {
  const u = criarDados(seed, HOJE, Date.parse('2026-11-10T12:00:00Z')).user;
  u.config.dataProva = '2027-01-17'; // 68 dias depois de HOJE
  return u;
}
const sessao = (data: string, min: number, disciplinaId = 'a01da'): Sessao => ({
  id: `s-${data}-${min}-${disciplinaId}`, data, disciplinaId, topicoId: null, planejadoMin: min, realizadoMin: min, notas: 'texto privado', origem: 'manual', cicloItemId: null, criadoEm: data, atualizadoEm: data,
});

describe('acompanhamento do administrador', () => {
  test('conta nova: nada concluído, sem ritmo e sem último estudo', () => {
    const r = resumir(seed, base(), HOJE);
    expect(r).toMatchObject({ concluidos: 0, pct: 0, minutos7: 0, ultimoEstudo: null, diasSemEstudar: null, ritmoSemanal: 0, projecaoDias: null, situacao: 'sem-ritmo', diasAteProva: 68 });
    expect(r.totalConteudos).toBe(seed.topicos.length);
  });

  test('horas, dias estudados e último estudo seguem as sessões', () => {
    const u = base();
    u.sessoes = [sessao('2026-11-10', 60), sessao('2026-11-09', 90), sessao('2026-11-09', 30), sessao('2026-11-03', 120), sessao('2026-10-20', 45)];
    const r = resumir(seed, u, HOJE);
    expect(r.minutos7).toBe(180); // 03/11 fica fora (janela de 7 dias: 04/11 a 10/11)
    expect(r.minutos30).toBe(345);
    expect(r.diasEstudados7).toBe(2);
    expect(r.ultimoEstudo).toBe('2026-11-10');
    expect(r.diasSemEstudar).toBe(0);
    expect(r.minutosTotais).toBe(345);
    // Sessões futuras não entram.
    u.sessoes.push(sessao('2026-11-20', 500));
    expect(resumir(seed, u, HOJE).minutosTotais).toBe(345);
  });

  test('ritmo, projeção e situação em relação à data da prova', () => {
    const u = base();
    const prio = seed.topicos.slice(0, 8);
    for (const t of prio) u.topicos[t.id] = { status: 'estudado', dominado: false, notas: 'privada', revisoesFeitas: 0, concluidoEm: '2026-11-05', ultimoEstudo: '2026-11-05' };
    const r = resumir(seed, u, HOJE);
    expect(r.concluidos).toBe(8);
    expect(r.ritmoSemanal).toBe(2); // 8 conteúdos em 4 semanas
    const restantes = seed.topicos.length - 8;
    expect(r.projecaoDias).toBe(Math.ceil((restantes / 2) * 7));
    expect(r.situacao).toBe('atras'); // levaria muito mais que os 68 dias

    // Ritmo alto o bastante: no ritmo.
    for (const t of seed.topicos.slice(8, 120)) u.topicos[t.id] = { status: 'estudado', dominado: false, notas: '', revisoesFeitas: 0, concluidoEm: '2026-11-08', ultimoEstudo: '2026-11-08' };
    expect(resumir(seed, u, HOJE).situacao).toBe('ok');

    // Prova já passada: sem projeção contra a data.
    u.config.dataProva = '2026-11-01';
    expect(resumir(seed, u, HOJE).situacao).toBe('sem-prova');
  });

  test('o detalhe traz disciplinas, 8 semanas e aponta a disciplina negligenciada', () => {
    const u = base();
    // 20 h estudadas só em Direito Administrativo; o ciclo previa tempo para as demais.
    u.sessoes = [sessao('2026-11-09', 600), sessao('2026-11-08', 600)];
    const d = detalhar(seed, u, HOJE);
    expect(d.porDisciplina).toHaveLength(14);
    expect(d.semanas).toHaveLength(8);
    expect(d.semanas[7].chave).toBe('2026-11-09'); // segunda-feira da semana atual
    expect(d.semanas[7].min).toBe(600); // terça 09/11 (segunda) ... 08/11 é domingo e fecha a semana anterior
    expect(d.semanas[6]).toMatchObject({ chave: '2026-11-02', min: 600 });
    expect(d.semanas[0].min).toBe(0);
    expect(d.negligenciadas).toContain('Língua Portuguesa');
    expect(d.negligenciadas).not.toContain('Direito Administrativo');
    expect(d.pendentesPrioritarios.length).toBeGreaterThan(0);
    expect(d.pendentesPrioritarios.every((p) => p.prioridade === 'Urgente' || p.prioridade === 'Alta')).toBe(true);
    expect(d.pendentesPrioritarios[0].prioridade).toBe('Urgente');
    // Nenhum texto privado vaza no detalhe nem no resumo.
    expect(JSON.stringify([d, resumir(seed, u, HOJE)])).not.toMatch(/texto privado|privada/);
  });
});
