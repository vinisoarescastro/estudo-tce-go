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

// Estado do descanso, guardado no navegador junto do id do cronômetro a que pertence.
// Nada começa sozinho: ao fim do foco o cronômetro para e espera (espera = 'descanso');
// ao fim do descanso ele espera de novo (espera = 'estudo'). Quem inicia é a pessoa.
export interface PomodoroEstado {
  timerId: string | null;
  tomadas: number; // descansos já oferecidos neste cronômetro
  ate: number | null; // epoch ms do fim do descanso em andamento
  espera: 'descanso' | 'estudo' | null;
  inicio: number | null; // quando o motor parou o cronômetro (evita confundir com retomada à mão)
  longa: boolean;
}

export const ESTADO_VAZIO: PomodoroEstado = { timerId: null, tomadas: 0, ate: null, espera: null, inicio: null, longa: false };

export type TipoFase = 'foco' | 'pausa' | 'pausaLonga';

export interface Fase {
  tipo: TipoFase;
  restanteMs: number;
  totalMs: number;
  aguardando: boolean; // a fase está pronta, mas ainda não foi iniciada
  concluidos: number; // pomodoros de foco completos
  naSerie: number; // pomodoros completos na série atual (0 a ciclosLonga)
}

export function fase(ms: number, cfg: PomodoroCfg, est: PomodoroEstado, agora: number): Fase {
  const focoMs = cfg.focoMin * 60000;
  const concluidos = Math.floor(ms / focoMs);
  const descanso = (aguardando: boolean, restanteMs: number): Fase => {
    const totalMs = (est.longa ? cfg.pausaLongaMin : cfg.pausaMin) * 60000;
    return {
      tipo: est.longa ? 'pausaLonga' : 'pausa',
      restanteMs: aguardando ? totalMs : restanteMs,
      totalMs,
      aguardando,
      concluidos,
      naSerie: est.longa ? cfg.ciclosLonga : concluidos % cfg.ciclosLonga,
    };
  };
  if (est.espera === 'descanso') return descanso(true, 0);
  if (est.ate !== null && agora < est.ate) return descanso(false, est.ate - agora);
  return {
    tipo: 'foco',
    restanteMs: focoMs - (ms % focoMs),
    totalMs: focoMs,
    aguardando: est.espera === 'estudo',
    concluidos,
    naSerie: concluidos % cfg.ciclosLonga,
  };
}

export interface Passo {
  acao: 'pausar' | null; // o que fazer no cronômetro (null = só atualizar o estado)
  estado: PomodoroEstado;
  avisar: boolean; // toca o aviso sonoro
}

// Decide, a cada segundo, se o foco terminou (para o cronômetro e oferece o descanso) ou se
// o descanso terminou (oferece voltar a estudar). Nunca inicia nada por conta própria.
export function proximoPasso(ms: number, cfg: PomodoroCfg, est: PomodoroEstado, agora: number, pausado: boolean): Passo | null {
  const concluidos = Math.floor(ms / (cfg.focoMin * 60000));
  if (est.ate !== null || est.espera !== null) {
    // Retomar o cronômetro à mão durante o descanso ou a espera equivale a pular essa etapa.
    if (!pausado && est.inicio !== null && agora - est.inicio > 3000) {
      return { acao: null, estado: { ...est, ate: null, espera: null, inicio: null }, avisar: false };
    }
    if (est.ate !== null && agora >= est.ate) {
      return { acao: null, estado: { ...est, ate: null, espera: 'estudo', inicio: agora }, avisar: true };
    }
    return null;
  }
  if (!pausado && concluidos > est.tomadas) {
    const longa = concluidos % cfg.ciclosLonga === 0;
    return { acao: 'pausar', estado: { ...est, tomadas: concluidos, ate: null, espera: 'descanso', inicio: agora, longa }, avisar: true };
  }
  return null;
}

export function fmtRelogio(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
