import { useEffect, useRef, useState } from 'react';
import { useApp, seed } from '../store/AppStore';
import { decorridoMs, fmtCronometro } from '../domain/timer';
import { fase, fmtRelogio } from '../domain/pomodoro';
import { fmtMin } from '../domain/util';
import { Icone, useAgora, type NomeIcone } from '../ui/primitives';
import { useUi } from '../ui/UiContext';
import { FinalizarSessao } from '../ui/FinalizarSessao';
import { definirEstadoPomodoro, usePomodoroCfg, usePomodoroEstado } from '../ui/pomodoro';

const RAIO = 132;
const CIRC = 2 * Math.PI * RAIO;

// Tela cheia de estudo: só o relógio e uma ação por vez. Fechar a tela não para o
// cronômetro; ele segue no rodapé do app.
export function Foco() {
  const { dados, despachar } = useApp();
  const { confirmar, navegar } = useUi();
  const t = dados.user.timer;
  const agora = useAgora(1000, !!t);
  const cfg = usePomodoroCfg();
  const est = usePomodoroEstado();
  const [finalizando, setFinalizando] = useState(false);
  const principal = useRef<(() => void) | null>(null);

  // Mantém a tela acesa enquanto o foco está aberto e sai da tela cheia ao fechar.
  useEffect(() => {
    let trava: WakeLockSentinel | null = null;
    const pedir = () => {
      if (document.visibilityState === 'visible' && 'wakeLock' in navigator) navigator.wakeLock.request('screen').then((w) => { trava = w; }).catch(() => undefined);
    };
    pedir();
    document.addEventListener('visibilitychange', pedir);
    return () => {
      document.removeEventListener('visibilitychange', pedir);
      void trava?.release().catch(() => undefined);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    };
  }, []);

  // Espaço aciona a ação principal, desde que o foco do teclado não esteja num controle.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat || finalizando) return;
      if ((e.target as HTMLElement).closest('button, a, input, textarea, select, [role="dialog"]')) return;
      e.preventDefault();
      principal.current?.();
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [finalizando]);

  if (!t) return null;
  const ms = decorridoMs(t, agora);
  const disc = seed.disciplinas.find((d) => d.id === t.disciplinaId);
  const top = t.topicoId ? seed.topicos.find((x) => x.id === t.topicoId) : null;
  const pausado = t.rodandoDesde === null;
  const f = fase(ms, cfg, est, agora);
  const emPausa = f.tipo !== 'foco';
  const novo = !emPausa && !f.aguardando && pausado && ms === 0;
  const aguardando = f.aguardando || novo; // a etapa está pronta, falta a pessoa iniciar
  const progresso = aguardando ? 0 : Math.min(1, Math.max(0, 1 - f.restanteMs / f.totalMs));
  const parado = !emPausa && pausado && !aguardando;

  const rotulo = emPausa
    ? f.aguardando ? 'Hora de descansar' : f.tipo === 'pausaLonga' ? 'Pausa longa' : 'Pausa curta'
    : f.aguardando ? 'Descanso concluído' : novo ? 'Pronto para começar' : pausado ? 'Em pausa' : 'Foco';

  // Nada começa sozinho: cada etapa espera a pessoa tocar em iniciar.
  const iniciarDescanso = () => {
    const agoraMs = Date.now();
    definirEstadoPomodoro({ ate: agoraMs + f.totalMs, inicio: agoraMs, espera: null });
  };
  const pularDescanso = () => definirEstadoPomodoro({ ate: null, espera: 'estudo', inicio: Date.now() });
  const iniciarEstudo = () => {
    definirEstadoPomodoro({ espera: null, inicio: null });
    despachar({ t: 'timerRetomar' });
  };

  let acao: { rotulo: string; icone: NomeIcone; fazer: () => void };
  if (emPausa && f.aguardando) acao = { rotulo: 'Iniciar descanso', icone: 'play', fazer: iniciarDescanso };
  else if (emPausa) acao = { rotulo: 'Pular descanso', icone: 'pular', fazer: pularDescanso };
  else if (aguardando) acao = { rotulo: 'Iniciar estudo', icone: 'play', fazer: iniciarEstudo };
  else if (pausado) acao = { rotulo: 'Retomar', icone: 'play', fazer: iniciarEstudo };
  else acao = { rotulo: 'Pausar', icone: 'pause', fazer: () => despachar({ t: 'timerPausar' }) };
  principal.current = acao.fazer;

  const classes = ['foco', `foco-${f.tipo}`, parado ? 'foco-parado' : ''].join(' ');

  return (
    <div className={classes}>
      <header className="foco-topo">
        <button className="foco-link" onClick={() => navegar('inicio')}><Icone nome="esquerda" tam={16} /> Sair do foco</button>
        <a className="foco-link foco-link-ic" href="#/config/pomodoro" title="Ajustar tempos" aria-label="Ajustar tempos do pomodoro"><Icone nome="config" tam={17} /></a>
      </header>

      <main className="foco-centro">
        <div className="foco-tarefa">
          <span className="foco-disc">{disc?.nome}</span>
          {top && <b>nº {top.numero} · {top.titulo}</b>}
        </div>

        <div className="foco-anel" role="timer" aria-label={`${rotulo}: faltam ${fmtRelogio(f.restanteMs)}`}>
          <svg viewBox="0 0 300 300" aria-hidden="true">
            <circle className="foco-trilha" cx="150" cy="150" r={RAIO} />
            <circle className="foco-prog" cx="150" cy="150" r={RAIO} strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - progresso)} />
          </svg>
          <div className="foco-relogio">
            <b>{fmtRelogio(f.restanteMs)}</b>
            <span>{rotulo}</span>
          </div>
        </div>

        <div className="foco-acoes">
          <button className="foco-cta" onClick={acao.fazer}><Icone nome={acao.icone} tam={18} /> {acao.rotulo}</button>
          <div className="foco-sec">
            {emPausa && f.aguardando && <button className="foco-texto" onClick={pularDescanso}><Icone nome="pular" tam={15} /> Pular descanso</button>}
            <button className="foco-texto" onClick={() => { despachar({ t: 'timerPausar' }); setFinalizando(true); }}><Icone nome="check" tam={15} /> Finalizar</button>
            <button
              className="foco-texto perigo"
              onClick={async () => {
                if (await confirmar('Descartar cronômetro?', `Os ${fmtMin(Math.round(ms / 60000))} desta sessão não serão registrados.`, 'Descartar')) despachar({ t: 'timerDescartar' }, 'Cronômetro descartado.');
              }}
            >
              <Icone nome="lixeira" tam={15} /> Descartar
            </button>
          </div>
        </div>
      </main>

      <footer className="foco-rodape">
        {fmtCronometro(ms)} estudados · Pomodoro {Math.min(f.naSerie + (emPausa ? 0 : 1), cfg.ciclosLonga)} de {cfg.ciclosLonga}
      </footer>

      <FinalizarSessao aberto={finalizando} onFechar={() => setFinalizando(false)} />
    </div>
  );
}
