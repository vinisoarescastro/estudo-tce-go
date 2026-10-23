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
    expect(f.excedido).toBe(false);
  });

  it('ao completar o foco, avisa mas não para o cronômetro: o excedente continua contando', () => {
    const p = proximoPasso(25 * MIN, cfg, est, 1000, false)!;
    expect(p.avisar).toBe(true);
    expect(p.estado).toMatchObject({ tomadas: 1, espera: 'descanso', ate: null });
    expect(fase(25 * MIN, cfg, p.estado, 2000)).toMatchObject({ tipo: 'foco', excedido: true, excedidoMs: 0, restanteMs: 0 });
    expect(fase(32 * MIN, cfg, p.estado, 2000)).toMatchObject({ tipo: 'foco', excedido: true, excedidoMs: 7 * MIN });
    // cronômetro rodando e já avisado: nada novo a fazer, nem avisar de novo
    expect(proximoPasso(32 * MIN, cfg, p.estado, 9000, false)).toBeNull();
  });

  it('o quarto foco leva ao descanso longo', () => {
    const p = proximoPasso(100 * MIN, cfg, { ...est, tomadas: 3 }, 1000, false)!;
    expect(p.estado.longa).toBe(true);
    expect(fase(100 * MIN, cfg, p.estado, 1000)).toMatchObject({ concluidos: 4, naSerie: 4 });
  });

  it('não avisa antes da hora nem com o cronômetro pausado', () => {
    expect(proximoPasso(24 * MIN, cfg, est, 0, false)).toBeNull();
    expect(proximoPasso(26 * MIN, cfg, est, 0, true)).toBeNull();
  });

  it('o foco seguinte conta a partir de onde o descanso começou, sem herdar o excedente', () => {
    const depois = { ...est, tomadas: 1, base: 32 * MIN };
    expect(fase(40 * MIN, cfg, depois, 0)).toMatchObject({ tipo: 'foco', excedido: false, restanteMs: 17 * MIN });
    expect(proximoPasso(56 * MIN, cfg, depois, 0, false)).toBeNull();
    expect(proximoPasso(57 * MIN, cfg, depois, 0, false)!.estado.tomadas).toBe(2);
  });

  it('descanso em andamento conta o tempo e, ao acabar, avisa e segue contando o excedente', () => {
    const correndo = { ...est, tomadas: 1, ate: 5000, inicio: 0, base: 25 * MIN, longa: false };
    expect(fase(25 * MIN, cfg, correndo, 1000)).toMatchObject({ tipo: 'pausa', excedido: false, restanteMs: 4000 });
    expect(proximoPasso(25 * MIN, cfg, correndo, 4000, true)).toBeNull();
    const p = proximoPasso(25 * MIN, cfg, correndo, 5000, true)!;
    expect(p.avisar).toBe(true);
    expect(p.estado.espera).toBe('estudo');
    expect(fase(25 * MIN, cfg, p.estado, 65000)).toMatchObject({ tipo: 'pausa', excedido: true, excedidoMs: 60000, restanteMs: 0 });
    // já avisado: não repete
    expect(proximoPasso(25 * MIN, cfg, p.estado, 65000, true)).toBeNull();
  });

  it('retomar à mão durante o descanso cancela essa etapa e recomeça o foco dali', () => {
    const descansando = { ...est, tomadas: 1, ate: 300000, inicio: 0, base: 25 * MIN, longa: false };
    const p = proximoPasso(25 * MIN, cfg, descansando, 10000, false)!;
    expect(p.estado).toMatchObject({ ate: null, espera: null, base: 25 * MIN });
    expect(p.avisar).toBe(false);
  });

  it('formata o relógio em mm:ss', () => {
    expect(fmtRelogio(25 * MIN)).toBe('25:00');
    expect(fmtRelogio(61 * 1000 - 1)).toBe('01:01');
    expect(fmtRelogio(-5)).toBe('00:00');
  });
});
