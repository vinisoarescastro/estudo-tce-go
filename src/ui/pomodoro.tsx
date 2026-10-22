import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useApp } from '../store/AppStore';
import { decorridoMs } from '../domain/timer';
import {
  ESTADO_VAZIO, fmtRelogio, fase, limparCfg, proximoPasso,
  type PomodoroCfg, type PomodoroEstado,
} from '../domain/pomodoro';
import { useAgora } from './primitives';

// Os tempos do pomodoro ficam nas preferências da conta (valem em qualquer dispositivo). Já a
// etapa em andamento (descanso ou espera) é só deste navegador, guardada no localStorage.
function criarStore<T extends object>(chave: string, padrao: T, limpar: (v: Partial<T>) => T) {
  const ler = (): T => {
    try {
      const v = localStorage.getItem(chave);
      return v ? limpar(JSON.parse(v) as Partial<T>) : padrao;
    } catch {
      return padrao;
    }
  };
  let atual = ler();
  const ouvintes = new Set<() => void>();
  return {
    get: () => atual,
    set(p: Partial<T>) {
      atual = limpar({ ...atual, ...p });
      try {
        localStorage.setItem(chave, JSON.stringify(atual));
      } catch {
        /* sem armazenamento local: vale só nesta aba */
      }
      ouvintes.forEach((f) => f());
    },
    assinar(f: () => void) {
      ouvintes.add(f);
      return () => ouvintes.delete(f);
    },
  };
}

const estadoStore = criarStore<PomodoroEstado>('estudo:pomodoro-estado', ESTADO_VAZIO, (v) => ({ ...ESTADO_VAZIO, ...v }));

export const definirEstadoPomodoro = (p: Partial<PomodoroEstado>) => estadoStore.set(p);
export const usePomodoroEstado = () => useSyncExternalStore(estadoStore.assinar, estadoStore.get);
export const usePomodoroCfg = (): PomodoroCfg => useApp().prefs.pomodoro;
export function useDefinirPomodoro() {
  const { prefs, definirPrefs } = useApp();
  return (p: Partial<PomodoroCfg>) => definirPrefs({ pomodoro: limparCfg({ ...prefs.pomodoro, ...p }) });
}

function bip() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const ganho = ctx.createGain();
    osc.connect(ganho);
    ganho.connect(ctx.destination);
    osc.frequency.value = 880;
    ganho.gain.setValueAtTime(0.0001, ctx.currentTime);
    ganho.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    ganho.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.7);
    osc.start();
    osc.stop(ctx.currentTime + 0.75);
    osc.onended = () => void ctx.close();
  } catch {
    /* sem áudio: segue só o aviso visual */
  }
}

// Fica montado o tempo todo: leva o cronômetro de foco para a pausa e de volta, e mostra o
// relógio no título da aba, mesmo com a tela de foco fechada.
export function PomodoroMotor() {
  const { dados, despachar } = useApp();
  const t = dados.user.timer;
  const agora = useAgora(1000, !!t);
  const cfg = usePomodoroCfg();
  const est = usePomodoroEstado();

  useEffect(() => {
    if (!t) {
      if (est.timerId !== null) estadoStore.set(ESTADO_VAZIO);
      return;
    }
    const ms = decorridoMs(t, agora);
    if (est.timerId !== t.id) {
      estadoStore.set({ ...ESTADO_VAZIO, timerId: t.id, tomadas: Math.floor(ms / (cfg.focoMin * 60000)) });
      return;
    }
    const passo = proximoPasso(ms, cfg, est, agora, t.rodandoDesde === null);
    if (!passo) return;
    estadoStore.set(passo.estado);
    if (passo.acao) despachar({ t: 'timerPausar' });
    if (passo.avisar && cfg.som) bip();
  }, [agora, t, cfg, est, despachar]);

  const tituloOriginal = useRef<string | null>(null);
  useEffect(() => {
    if (!t) {
      if (tituloOriginal.current !== null) document.title = tituloOriginal.current;
      tituloOriginal.current = null;
      return;
    }
    tituloOriginal.current ??= document.title;
    const f = fase(decorridoMs(t, agora), cfg, est, agora);
    const rotulo = f.tipo !== 'foco' ? 'Descanso' : f.aguardando || t.rodandoDesde === null ? 'Pausado' : 'Foco';
    document.title = `${fmtRelogio(f.restanteMs)} · ${rotulo}`;
  }, [t, agora, cfg, est]);

  return null;
}
