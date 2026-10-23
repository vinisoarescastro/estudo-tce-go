import { useEffect, useRef, useState } from 'react';
import { useApp, seed } from '../store/AppStore';
import { decorridoMs, fmtCronometro } from '../domain/timer';
import { fase, fmtRelogio } from '../domain/pomodoro';
import { fmtMin } from '../domain/util';
import { Icone, useAgora, type NomeIcone } from '../ui/primitives';
import { useUi } from '../ui/UiContext';
import { FinalizarSessao } from '../ui/FinalizarSessao';
import { useAcoesPomodoro, usePomodoroCfg, usePomodoroEstado } from '../ui/pomodoro';

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
  const { iniciarDescanso, iniciarEstudo } = useAcoesPomodoro();
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
  const novo = !emPausa && !f.excedido && pausado && ms === 0;
  const progresso = novo ? 0 : f.excedido ? 1 : Math.min(1, Math.max(0, 1 - f.restanteMs / f.totalMs));
  const parado = !emPausa && pausado && !f.excedido && !novo;

  const rotulo = emPausa
    ? f.excedido ? 'Descanso concluído' : f.tipo === 'pausaLonga' ? 'Pausa longa' : 'Pausa curta'
    : f.excedido ? 'Foco concluído' : novo ? 'Pronto para começar' : pausado ? 'Em pausa' : 'Foco';
  // Passado o tempo previsto o relógio segue contando o excedente, até a pessoa mudar de etapa.
  const relogio = f.excedido ? `+${fmtRelogio(f.excedidoMs)}` : fmtRelogio(f.restanteMs);

  // Nada muda de etapa sozinho: cada transição espera a pessoa tocar no botão.
  let acao: { rotulo: string; icone: NomeIcone; fazer: () => void };
  if (emPausa && f.excedido) acao = { rotulo: 'Iniciar estudo', icone: 'play', fazer: iniciarEstudo };
  else if (emPausa) acao = { rotulo: 'Pular descanso', icone: 'pular', fazer: iniciarEstudo };
  else if (f.excedido) acao = { rotulo: 'Iniciar descanso', icone: 'play', fazer: iniciarDescanso };
  else if (novo) acao = { rotulo: 'Iniciar estudo', icone: 'play', fazer: iniciarEstudo };
  else if (pausado) acao = { rotulo: 'Retomar', icone: 'play', fazer: () => despachar({ t: 'timerRetomar' }) };
  else acao = { rotulo: 'Pausar', icone: 'pause', fazer: () => despachar({ t: 'timerPausar' }) };
  principal.current = acao.fazer;

  const classes = ['foco', `foco-${f.tipo}`, parado ? 'foco-parado' : '', f.excedido ? 'foco-excedido' : ''].join(' ');

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

        <div className="foco-anel" role="timer" aria-label={`${rotulo}: ${f.excedido ? 'excedido em' : 'faltam'} ${relogio}`}>
          <svg viewBox="0 0 300 300" aria-hidden="true">
            <circle className="foco-trilha" cx="150" cy="150" r={RAIO} />
            <circle className="foco-prog" cx="150" cy="150" r={RAIO} strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - progresso)} />
          </svg>
          <div className="foco-relogio">
            <b>{relogio}</b>
            <span>{rotulo}</span>
          </div>
        </div>

        <div className="foco-acoes">
          <button className="foco-cta" onClick={acao.fazer}><Icone nome={acao.icone} tam={18} /> {acao.rotulo}</button>
          <div className="foco-sec">
            {!emPausa && f.excedido && <button className="foco-texto" onClick={iniciarEstudo}><Icone nome="pular" tam={15} /> Pular descanso</button>}
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
        {fmtCronometro(ms)} estudados · Pomodoro {Math.min(f.naSerie + (emPausa || f.excedido ? 0 : 1), cfg.ciclosLonga)} de {cfg.ciclosLonga}
      </footer>

      <FinalizarSessao aberto={finalizando} onFechar={() => setFinalizando(false)} />
    </div>
  );
}
