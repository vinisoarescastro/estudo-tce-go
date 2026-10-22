import { describe, expect, it } from 'vitest';
import { ESTADO_VAZIO, POMODORO_PADRAO, fase, fmtRelogio, limparCfg, proximoPasso } from './pomodoro';

const MIN = 60000;
const cfg = POMODORO_PADRAO;
const est = { ...ESTADO_VAZIO, timerId: 'a' };

describe('pomodoro', () => {
  it('limita valores fora da faixa e usa o padrão para lixo', () => {
    expect(limparCfg({ focoMin: 0, pausaMin: 999, pausaLongaMin: Number.NaN, ciclosLonga: 1 })).toEqual({
      focoMin: 1, pausaMin: 60, pausaLongaMin: 15, ciclosLonga: 2, som: true,
    });
  });

  it('mostra o tempo que falta no foco atual', () => {
    const f = fase(10 * MIN, cfg, est, 0);
    expect(f.tipo).toBe('foco');
    expect(f.restanteMs).toBe(15 * MIN);
    expect(f.aguardando).toBe(false);
  });

  it('ao completar o foco, para o cronômetro e espera a pessoa iniciar o descanso', () => {
    const p = proximoPasso(25 * MIN, cfg, est, 1000, false)!;
    expect(p.acao).toBe('pausar');
    expect(p.estado.espera).toBe('descanso');
    expect(p.estado.ate).toBeNull();
    const f = fase(25 * MIN, cfg, p.estado, 2000);
    expect(f).toMatchObject({ tipo: 'pausa', aguardando: true, restanteMs: 5 * MIN });
  });

  it('o quarto foco leva ao descanso longo', () => {
    const p = proximoPasso(100 * MIN, cfg, { ...est, tomadas: 3 }, 1000, false)!;
    expect(p.estado.longa).toBe(true);
    expect(fase(100 * MIN, cfg, p.estado, 1000)).toMatchObject({ tipo: 'pausaLonga', restanteMs: 15 * MIN, naSerie: 4 });
  });

  it('não repete o descanso para o mesmo foco', () => {
    expect(proximoPasso(25 * MIN + 5000, cfg, { ...est, tomadas: 1 }, 0, false)).toBeNull();
  });

  it('descanso em andamento conta o tempo e, ao acabar, espera a pessoa voltar a estudar', () => {
    const correndo = { ...est, tomadas: 1, ate: 5000, inicio: 0, longa: false };
    expect(fase(25 * MIN, cfg, correndo, 1000)).toMatchObject({ tipo: 'pausa', aguardando: false, restanteMs: 4000 });
    expect(proximoPasso(25 * MIN, cfg, correndo, 4000, true)).toBeNull();
    const p = proximoPasso(25 * MIN, cfg, correndo, 5000, true)!;
    expect(p.acao).toBeNull();
    expect(p.estado.espera).toBe('estudo');
    expect(p.avisar).toBe(true);
    expect(fase(25 * MIN, cfg, p.estado, 6000)).toMatchObject({ tipo: 'foco', aguardando: true });
  });

  it('nada avança enquanto espera a pessoa', () => {
    const esperando = { ...est, tomadas: 1, espera: 'estudo' as const, inicio: 0 };
    expect(proximoPasso(25 * MIN, cfg, esperando, 60 * MIN, true)).toBeNull();
  });

  it('retomar à mão durante o descanso ou a espera cancela essa etapa', () => {
    const descansando = { ...est, tomadas: 1, ate: 300000, inicio: 0, longa: false };
    const p = proximoPasso(25 * MIN, cfg, descansando, 10000, false)!;
    expect(p.estado).toMatchObject({ ate: null, espera: null });
    const esperando = { ...est, tomadas: 1, espera: 'descanso' as const, inicio: 0 };
    expect(proximoPasso(25 * MIN, cfg, esperando, 10000, false)!.estado.espera).toBeNull();
  });

  it('formata o relógio em mm:ss', () => {
    expect(fmtRelogio(25 * MIN)).toBe('25:00');
    expect(fmtRelogio(61 * 1000 - 1)).toBe('01:01');
    expect(fmtRelogio(-5)).toBe('00:00');
  });
});
