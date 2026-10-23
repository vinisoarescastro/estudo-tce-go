import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useApp } from '../store/AppStore';
import { decorridoMs } from '../domain/timer';
import {
  ESTADO_VAZIO, fmtRelogio, fase, limparCfg, proximoPasso,
  type PomodoroCfg, type PomodoroEstado,
} from '../domain/pomodoro';

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

// Um único AudioContext, liberado no primeiro toque ou tecla na página: o navegador só deixa
// tocar som em segundo plano numa página que já teve interação.
let ctxAudio: AudioContext | null = null;
function audio(): AudioContext | null {
  try {
    ctxAudio ??= new AudioContext();
    return ctxAudio;
  } catch {
    return null;
  }
}
if (typeof window !== 'undefined') {
  for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, () => void audio()?.resume().catch(() => undefined), { passive: true });
}

// Bip duplo ("bi-bip") repetido 5 vezes, um por segundo: dura cerca de 4,5 s. A onda triangular
// é nítida sem ser estridente, e o volume sobe e desce rápido em cada bip para não dar estalo.
const DURACAO_AVISO_MS = 4500;
const FREQ_AVISO = 880;
let tocandoAte = 0;

function bip() {
  const ctx = audio();
  if (!ctx || Date.now() < tocandoAte) return; // nunca dois avisos sobrepostos
  tocandoAte = Date.now() + DURACAO_AVISO_MS;
  void ctx.resume().catch(() => undefined);
  const t0 = ctx.currentTime + 0.05;
  for (let grupo = 0; grupo < 5; grupo++) {
    for (const atraso of [0, 0.28]) {
      const inicio = t0 + grupo + atraso;
      const osc = ctx.createOscillator();
      const ganho = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = FREQ_AVISO;
      ganho.gain.setValueAtTime(0.0001, inicio);
      ganho.gain.exponentialRampToValueAtTime(0.35, inicio + 0.02);
      ganho.gain.setValueAtTime(0.35, inicio + 0.15);
      ganho.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.2);
      osc.connect(ganho);
      ganho.connect(ctx.destination);
      osc.start(inicio);
      osc.stop(inicio + 0.22);
    }
  }
}

// Garante um único aviso por etapa mesmo com o app aberto em mais de uma aba ou o efeito
// rodando duas vezes: a primeira aba a registrar a chave é a que toca.
function reivindicarAviso(chave: string): boolean {
  try {
    if (localStorage.getItem('estudo:pomodoro-aviso') === chave) return false;
    localStorage.setItem('estudo:pomodoro-aviso', chave);
  } catch {
    /* sem armazenamento local: vale a trava desta aba */
  }
  return true;
}

// Relógio do motor: bate num worker para não atrasar com a aba em segundo plano e confere de
// novo assim que a aba volta a ficar visível.
function useAgoraSegundoPlano(ativo: boolean): number {
  const [t, setT] = useState(Date.now());
  useEffect(() => {
    if (!ativo) return;
    const bater = () => setT(Date.now());
    let parar: () => void;
    const alternativa = () => {
      const id = window.setInterval(bater, 1000);
      parar = () => window.clearInterval(id);
    };
    try {
      const w = new Worker(new URL('./relogio.worker.ts', import.meta.url), { type: 'module' });
      w.onmessage = bater;
      w.onerror = () => {
        w.terminate();
        alternativa();
      };
      parar = () => w.terminate();
    } catch {
      alternativa();
    }
    document.addEventListener('visibilitychange', bater);
    return () => {
      document.removeEventListener('visibilitychange', bater);
      parar();
    };
  }, [ativo]);
  return t;
}

// Ações manuais que passam de uma etapa para a próxima. Nada disso acontece sozinho.
export function useAcoesPomodoro() {
  const { dados, despachar } = useApp();
  const cfg = usePomodoroCfg();
  const t = dados.user.timer;
  return {
    // Encerra o foco (o cronômetro para, o descanso não entra no tempo estudado) e começa a pausa.
    iniciarDescanso() {
      if (!t) return;
      const agora = Date.now();
      const est = estadoStore.get();
      despachar({ t: 'timerPausar' });
      estadoStore.set({ ate: agora + (est.longa ? cfg.pausaLongaMin : cfg.pausaMin) * 60000, inicio: agora, espera: null, base: decorridoMs(t, agora) });
    },
    // Encerra o descanso (ou o pula) e volta a contar o foco.
    iniciarEstudo() {
      if (!t) return;
      estadoStore.set({ ate: null, espera: null, inicio: null, base: decorridoMs(t, Date.now()) });
      despachar({ t: 'timerRetomar' });
    },
  };
}

// Fica montado o tempo todo: avisa o fim de cada etapa e mostra o relógio no título da aba,
// mesmo com a tela de foco fechada ou em outra aba.
export function PomodoroMotor() {
  const { dados } = useApp();
  const t = dados.user.timer;
  const agora = useAgoraSegundoPlano(!!t);
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
    if (passo.avisar && cfg.som && reivindicarAviso(`${t.id}:${passo.estado.tomadas}:${passo.estado.espera}`)) bip();
  }, [agora, t, cfg, est]);

  const tituloOriginal = useRef<string | null>(null);
  useEffect(() => {
    if (!t) {
      if (tituloOriginal.current !== null) document.title = tituloOriginal.current;
      tituloOriginal.current = null;
      return;
    }
    tituloOriginal.current ??= document.title;
    const f = fase(decorridoMs(t, agora), cfg, est, agora);
    const rotulo = f.tipo !== 'foco' ? 'Descanso' : t.rodandoDesde === null ? 'Pausado' : 'Foco';
    document.title = f.excedido
      ? `⏰ +${fmtRelogio(f.excedidoMs)} · ${f.tipo === 'foco' ? 'Hora do descanso' : 'Volte a estudar'}`
      : `${fmtRelogio(f.restanteMs)} · ${rotulo}`;
  }, [t, agora, cfg, est]);

  return null;
}
