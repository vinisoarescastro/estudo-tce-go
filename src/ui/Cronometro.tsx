import { useState } from 'react';
import { useApp, seed } from '../store/AppStore';
import { decorridoMs, fmtCronometro } from '../domain/timer';
import { fase, fmtRelogio } from '../domain/pomodoro';
import { fmtMin } from '../domain/util';
import { Icone, useAgora } from './primitives';
import { useUi } from './UiContext';
import { FinalizarSessao } from './FinalizarSessao';
import { useAcoesPomodoro, usePomodoroCfg, usePomodoroEstado } from './pomodoro';

// Cronômetro flutuante. O estado fica no servidor, então sobrevive a recarregar a página
// e acompanha o usuário em qualquer dispositivo.
export function Cronometro() {
  const { dados, despachar } = useApp();
  const { confirmar, navegar } = useUi();
  const t = dados.user.timer;
  const agora = useAgora(1000, !!t);
  const cfg = usePomodoroCfg();
  const est = usePomodoroEstado();
  const { iniciarDescanso, iniciarEstudo } = useAcoesPomodoro();
  const [finalizando, setFinalizando] = useState(false);
  if (!t) return null;
  const ms = decorridoMs(t, agora);
  const disc = seed.disciplinas.find((d) => d.id === t.disciplinaId);
  const top = t.topicoId ? seed.topicos.find((x) => x.id === t.topicoId) : null;
  const pausado = t.rodandoDesde === null;
  const pct = Math.min(1, ms / (t.planejadoMin * 60000));
  const f = fase(ms, cfg, est, agora);
  const emPausa = f.tipo !== 'foco';
  const estado = emPausa ? (f.excedido ? 'Descanso concluído' : 'Descanso') : f.excedido ? 'Hora do descanso' : pausado ? 'Pausado' : 'Estudando';

  return (
    <div className={`cronometro ${pausado ? 'pausado' : ''} ${emPausa ? 'descanso' : ''}`} role="region" aria-label="Cronômetro de estudo">
      <span className="cr-estado"><span className="ponto" aria-hidden="true" />{estado}</span>
      <span className="cr-tempo" aria-live="off">{fmtCronometro(ms)}</span>
      <span className="cr-pomo" title={f.excedido ? 'Tempo além do previsto' : emPausa ? 'Tempo restante da pausa' : 'Tempo restante deste pomodoro'}>{f.excedido ? `+${fmtRelogio(f.excedidoMs)}` : fmtRelogio(f.restanteMs)}</span>
      <span className="cr-desc" title={top ? `nº ${top.numero} ${top.titulo}` : undefined}>
        <b>{disc?.nomeCurto}</b>
        {top ? ` · ${top.titulo}` : ''}
        {` · meta ${fmtMin(t.planejadoMin)}`}
      </span>
      <span className="cr-acoes">
        <button className="btn" onClick={() => navegar('foco')} title="Abrir a tela de foco"><Icone nome="alvo" tam={14} /> Foco</button>
        {f.excedido && (
          <button className="btn primario" onClick={emPausa ? iniciarEstudo : iniciarDescanso}>
            <Icone nome="play" tam={13} /> {emPausa ? 'Iniciar estudo' : 'Iniciar descanso'}
          </button>
        )}
        {emPausa ? null : pausado ? (
          <button className="btn" onClick={() => despachar({ t: 'timerRetomar' })}><Icone nome="play" tam={13} /> Retomar</button>
        ) : (
          <button className="btn" onClick={() => despachar({ t: 'timerPausar' })}><Icone nome="pause" tam={13} /> Pausar</button>
        )}
        <button className="btn primario" onClick={() => { despachar({ t: 'timerPausar' }); setFinalizando(true); }}><Icone nome="check" tam={15} /> Finalizar</button>
        <button
          className="btn-icone"
          title="Descartar cronômetro"
          aria-label="Descartar cronômetro"
          onClick={async () => {
            if (await confirmar('Descartar cronômetro?', `Os ${fmtMin(Math.round(ms / 60000))} desta sessão não serão registrados.`, 'Descartar')) despachar({ t: 'timerDescartar' }, 'Cronômetro descartado.');
          }}
        >
          <Icone nome="lixeira" tam={16} />
        </button>
      </span>
      <span className="cr-barra" role="progressbar" aria-label="Tempo em relação ao planejado" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct * 100)}><i style={{ width: `${pct * 100}%` }} /></span>

      <FinalizarSessao aberto={finalizando} onFechar={() => setFinalizando(false)} />
    </div>
  );
}
