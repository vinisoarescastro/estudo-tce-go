import { useEffect, useState } from 'react';
import { POMODORO_LIMITES, POMODORO_PADRAO, type PomodoroCfg } from '../../domain/pomodoro';
import { useDefinirPomodoro, usePomodoroCfg } from '../../ui/pomodoro';
import { Cabecalho, Icone, Painel } from '../../ui/primitives';

type Chave = 'focoMin' | 'pausaMin' | 'pausaLongaMin' | 'ciclosLonga';

// Campo numérico com botões de + e −. Digita livremente e só aplica ao sair do campo ou com Enter.
function Passo({ chave, rotulo, ajuda, unidade }: { chave: Chave; rotulo: string; ajuda: string; unidade: string }) {
  const cfg = usePomodoroCfg();
  const definirPomodoro = useDefinirPomodoro();
  const [min, max] = POMODORO_LIMITES[chave];
  const [texto, setTexto] = useState(String(cfg[chave]));
  useEffect(() => setTexto(String(cfg[chave])), [cfg, chave]);

  const aplicar = (v: number) => {
    definirPomodoro({ [chave]: v });
    setTexto(String(Math.min(max, Math.max(min, Math.round(v) || cfg[chave]))));
  };

  return (
    <div className="passo-linha">
      <div className="passo-desc">
        <label htmlFor={`pm-${chave}`}>{rotulo}</label>
        <span className="campo-ajuda">{ajuda}</span>
      </div>
      <div className="passo">
        <button type="button" className="btn-icone" aria-label={`Diminuir ${rotulo.toLowerCase()}`} disabled={cfg[chave] <= min} onClick={() => aplicar(cfg[chave] - 1)}>
          <Icone nome="menos" tam={16} />
        </button>
        <input
          id={`pm-${chave}`}
          inputMode="numeric"
          value={texto}
          onChange={(e) => setTexto(e.target.value.replace(/\D/g, '').slice(0, 3))}
          onBlur={() => aplicar(Number(texto))}
          onKeyDown={(e) => { if (e.key === 'Enter') aplicar(Number(texto)); }}
        />
        <button type="button" className="btn-icone" aria-label={`Aumentar ${rotulo.toLowerCase()}`} disabled={cfg[chave] >= max} onClick={() => aplicar(cfg[chave] + 1)}>
          <Icone nome="mais" tam={16} />
        </button>
        <span className="passo-un">{unidade}</span>
      </div>
    </div>
  );
}

// Tempos usados na tela de foco (técnica Pomodoro). Ficam salvos na conta.
export function ConfigPomodoro() {
  const cfg = usePomodoroCfg();
  const definirPomodoro = useDefinirPomodoro();
  const igualPadrao = (Object.keys(POMODORO_PADRAO) as (keyof PomodoroCfg)[]).every((k) => cfg[k] === POMODORO_PADRAO[k]);
  const ciclo = cfg.focoMin * cfg.ciclosLonga;

  return (
    <div className="pagina pagina-estreita">
      <Cabecalho sobre="Configurações" titulo="Pomodoro" subtitulo="Os tempos de foco e de descanso da tela “Estudar agora”." />

      <Painel
        titulo="Tempos"
        acoes={<button className="btn fantasma pq" disabled={igualPadrao} onClick={() => definirPomodoro(POMODORO_PADRAO)}><Icone nome="revisao" tam={14} /> Restaurar padrão</button>}
      >
        <div className="passos">
          <Passo chave="focoMin" rotulo="Tempo de estudo" ajuda="Duração de cada bloco de foco." unidade="min" />
          <Passo chave="pausaMin" rotulo="Descanso curto" ajuda="Pausa depois de cada bloco de foco." unidade="min" />
          <Passo chave="pausaLongaMin" rotulo="Descanso longo" ajuda="Pausa maior ao fechar uma série de blocos." unidade="min" />
          <Passo chave="ciclosLonga" rotulo="Blocos até o descanso longo" ajuda="Quantos blocos de foco formam uma série." unidade="blocos" />
        </div>
        <p className="passo-resumo">
          Uma série dura <b>{cfg.ciclosLonga} × {cfg.focoMin} min</b> de estudo, com {cfg.ciclosLonga - 1} descanso{cfg.ciclosLonga - 1 > 1 ? 's' : ''} de {cfg.pausaMin} min
          e um descanso longo de {cfg.pausaLongaMin} min. Ou seja, <b>{ciclo} min</b> de estudo por série.
        </p>
      </Painel>

      <Painel>
        <label className="linha-switch">
          <span>
            <b>Aviso sonoro</b>
            <span className="campo-ajuda" style={{ display: 'block' }}>Toca um bip quando o foco termina e quando o descanso acaba.</span>
          </span>
          <span className="interruptor">
            <input type="checkbox" checked={cfg.som} onChange={(e) => definirPomodoro({ som: e.target.checked })} />
          </span>
        </label>
      </Painel>

      <p className="nota">O descanso nunca entra no tempo estudado: o cronômetro para sozinho na pausa e volta quando ela termina. Os tempos ficam salvos na sua conta e valem em qualquer dispositivo.</p>
    </div>
  );
}
