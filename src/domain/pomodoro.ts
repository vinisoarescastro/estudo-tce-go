// Técnica Pomodoro sobre o cronômetro de estudo. O tempo de foco vem do próprio cronômetro
// (só conta enquanto roda); o descanso é um intervalo à parte, durante o qual o cronômetro fica
// parado. Assim o descanso nunca entra no tempo estudado.

export interface PomodoroCfg {
  focoMin: number;
  pausaMin: number;
  pausaLongaMin: number;
  ciclosLonga: number; // pomodoros até o descanso longo
  som: boolean;
}

export const POMODORO_PADRAO: PomodoroCfg = { focoMin: 25, pausaMin: 5, pausaLongaMin: 15, ciclosLonga: 4, som: true };

export const POMODORO_LIMITES = {
  focoMin: [1, 180],
  pausaMin: [1, 60],
  pausaLongaMin: [1, 120],
  ciclosLonga: [2, 8],
} as const;

const limitar = (v: unknown, [min, max]: readonly [number, number], padrao: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : padrao;
};

export function limparCfg(c: Partial<PomodoroCfg>): PomodoroCfg {
  return {
    focoMin: limitar(c.focoMin, POMODORO_LIMITES.focoMin, POMODORO_PADRAO.focoMin),
    pausaMin: limitar(c.pausaMin, POMODORO_LIMITES.pausaMin, POMODORO_PADRAO.pausaMin),
    pausaLongaMin: limitar(c.pausaLongaMin, POMODORO_LIMITES.pausaLongaMin, POMODORO_PADRAO.pausaLongaMin),
    ciclosLonga: limitar(c.ciclosLonga, POMODORO_LIMITES.ciclosLonga, POMODORO_PADRAO.ciclosLonga),
    som: c.som ?? POMODORO_PADRAO.som,
  };
}

// Estado do pomodoro, guardado no navegador junto do id do cronômetro a que pertence.
// Nada termina sozinho: ao fim do tempo previsto o aviso toca uma vez, mas o relógio segue
// contando o excedente até a pessoa tocar em iniciar a próxima etapa.
//  - espera 'descanso': o foco passou do previsto (o cronômetro continua rodando);
//  - ate (epoch ms): descanso em andamento; passado esse instante o descanso também excede,
//    e espera vira 'estudo' para marcar que o aviso já tocou.
export interface PomodoroEstado {
  timerId: string | null;
  tomadas: number; // pomodoros de foco já concluídos neste cronômetro
  base: number | null; // tempo do cronômetro (ms) em que o foco atual começou; null = tomadas × foco
  ate: number | null; // epoch ms do fim previsto do descanso em andamento
  espera: 'descanso' | 'estudo' | null;
  inicio: number | null; // quando o descanso começou (evita confundir com retomada à mão)
  longa: boolean;
}

export const ESTADO_VAZIO: PomodoroEstado = { timerId: null, tomadas: 0, base: null, ate: null, espera: null, inicio: null, longa: false };

export type TipoFase = 'foco' | 'pausa' | 'pausaLonga';

export interface Fase {
  tipo: TipoFase;
  restanteMs: number; // 0 quando o tempo previsto já acabou
  totalMs: number;
  excedidoMs: number; // quanto passou do previsto
  excedido: boolean; // o tempo previsto acabou e falta a pessoa iniciar a próxima etapa
  concluidos: number; // pomodoros de foco completos
  naSerie: number; // pomodoros completos na série atual (0 a ciclosLonga)
}

export const inicioFoco = (cfg: PomodoroCfg, est: PomodoroEstado) => est.base ?? est.tomadas * cfg.focoMin * 60000;

export function fase(ms: number, cfg: PomodoroCfg, est: PomodoroEstado, agora: number): Fase {
  const focoMs = cfg.focoMin * 60000;
  const naSerie = est.longa && (est.ate !== null || est.espera === 'descanso') ? cfg.ciclosLonga : est.tomadas % cfg.ciclosLonga;
  if (est.ate !== null) {
    const totalMs = (est.longa ? cfg.pausaLongaMin : cfg.pausaMin) * 60000;
    const resta = est.ate - agora;
    return {
      tipo: est.longa ? 'pausaLonga' : 'pausa',
      restanteMs: Math.max(0, resta),
      totalMs,
      excedidoMs: Math.max(0, -resta),
      excedido: resta <= 0,
      concluidos: est.tomadas,
      naSerie,
    };
  }
  const noFoco = Math.max(0, ms - inicioFoco(cfg, est));
  return {
    tipo: 'foco',
    restanteMs: Math.max(0, focoMs - noFoco),
    totalMs: focoMs,
    excedidoMs: Math.max(0, noFoco - focoMs),
    excedido: est.espera === 'descanso' || noFoco >= focoMs,
    concluidos: est.tomadas,
    naSerie,
  };
}

export interface Passo {
  estado: PomodoroEstado;
  avisar: boolean; // toca o aviso sonoro
}

// Decide, a cada segundo, se o foco ou o descanso chegou ao fim previsto. Só marca o estado e
// manda avisar: nunca pausa nem inicia nada por conta própria.
export function proximoPasso(ms: number, cfg: PomodoroCfg, est: PomodoroEstado, agora: number, pausado: boolean): Passo | null {
  if (est.ate !== null) {
    // Retomar o cronômetro à mão durante o descanso equivale a pular essa etapa.
    if (!pausado && est.inicio !== null && agora - est.inicio > 3000) {
      return { estado: { ...est, ate: null, espera: null, inicio: null, base: ms }, avisar: false };
    }
    if (est.espera !== 'estudo' && agora >= est.ate) {
      return { estado: { ...est, espera: 'estudo' }, avisar: true };
    }
    return null;
  }
  if (est.espera === null && !pausado && ms - inicioFoco(cfg, est) >= cfg.focoMin * 60000) {
    const tomadas = est.tomadas + 1;
    return { estado: { ...est, tomadas, base: inicioFoco(cfg, est), espera: 'descanso', longa: tomadas % cfg.ciclosLonga === 0 }, avisar: true };
  }
  return null;
}

export function fmtRelogio(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
