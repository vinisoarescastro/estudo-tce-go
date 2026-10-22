import { useEffect, useState } from 'react';
import type { CicloItem } from '../domain/types';
import { useApp, seed } from '../store/AppStore';
import { ativos, distribuicaoSugerida, minutosPorVolta, prioridadeTopico, proximoItem } from '../domain/cycle';
import { contar, estadoDe, topicosDaDisciplina } from '../domain/progress';
import { proximoTopico } from '../domain/recommend';
import { fmtMin, fmtPct } from '../domain/util';
import { Barra, Cabecalho, Icone, Info, MenuAcoes, NucleoTag, Painel, PrioridadeTag, Vazio } from '../ui/primitives';
import { BarrasH } from '../ui/charts';
import { useUi } from '../ui/UiContext';

type Situacao = 'agora' | 'seguinte' | 'passou' | 'adiante' | 'inativa';

export function Ciclo() {
  const { dados, despachar } = useApp();
  const { iniciarEstudo, abrirSessao, abrirTopico, confirmar } = useUi();
  const u = dados.user;
  const c = u.ciclo;
  const prox = proximoItem(c);
  const at = ativos(c);
  const volta = minutosPorVolta(c);
  const [arrastando, setArrastando] = useState<number | null>(null);
  const [sobre, setSobre] = useState<number | null>(null);
  const [novaDisc, setNovaDisc] = useState('');
  const [novaMin, setNovaMin] = useState(u.config.duracaoPadraoMin);
  const [totalSug, setTotalSug] = useState<number>(volta || 1800);
  const [sugestao, setSugestao] = useState<Record<string, number> | null>(null);

  const recProx = prox ? proximoTopico(seed.topicos, seed.disciplinas, u, u.dependencias, prox.disciplinaId) : null;
  const discProx = prox ? seed.disciplinas.find((d) => d.id === prox.disciplinaId)! : null;
  const posProx = prox ? at.findIndex((i) => i.id === prox.id) + 1 : 0;

  const soltar = (para: number) => {
    if (arrastando !== null && arrastando !== para) despachar({ t: 'cicloMover', de: arrastando, para }, 'Ordem do ciclo atualizada.');
    setArrastando(null);
    setSobre(null);
  };

  // Situação de cada item na volta atual: os ativos antes do próximo já passaram nesta volta.
  const idxAtivo = new Map(at.map((i, k) => [i.id, k]));
  const situacaoDe = (id: string): Situacao => {
    const k = idxAtivo.get(id);
    if (k === undefined) return 'inativa';
    const p = posProx - 1;
    if (k === p) return 'agora';
    if (at.length > 1 && k === (p + 1) % at.length) return 'seguinte';
    return k < p ? 'passou' : 'adiante';
  };

  // Distribuição do tempo por disciplina (soma das sessões ativas na volta).
  const porDisc: Record<string, number> = {};
  for (const i of at) porDisc[i.disciplinaId] = (porDisc[i.disciplinaId] ?? 0) + i.minutos;
  const minNucleo = (n: 'CG' | 'CE') => at.filter((i) => seed.disciplinas.find((d) => d.id === i.disciplinaId)?.nucleo === n).reduce((a, i) => a + i.minutos, 0);

  return (
    <div className="pagina">
      <Cabecalho
        titulo="Ciclo de estudos"
        subtitulo={`Volta ${c.numero} · ${at.length} sessões ativas · ${fmtMin(volta)} por volta${u.config.metaSemanalMin > 0 && volta > 0 ? ` · ≈ ${(u.config.metaSemanalMin / volta).toFixed(1).replace('.', ',')} volta(s) por semana` : ''}`}
        info="O ciclo guarda qual é a próxima sessão, não uma posição. Reordenar, desativar ou remover não muda o histórico: as sessões já estudadas continuam registradas."
      />

      {prox && discProx ? (
        <section className="painel agora" aria-label="Sessão atual do ciclo">
          <div className="agora-txt">
            <span className="agora-rot">Agora · {posProx} de {at.length}</span>
            <h2>{discProx.nome}</h2>
            <div className="agora-sub">
              <NucleoTag n={discProx.nucleo} />
              <span>{fmtMin(prox.minutos)}</span>
              {recProx ? (
                <>
                  <span>{recProx.tipo === 'prerequisito' ? 'Base antes:' : 'Próximo:'} <button className="link" onClick={() => abrirTopico(recProx.topico.id)}>nº {recProx.topico.numero} {recProx.topico.titulo}</button></span>
                  <PrioridadeTag p={prioridadeTopico(recProx.topico, u)} propria={!!estadoDe(u, recProx.topico.id).prioridade} />
                  <Info rotulo="Por que este conteúdo"><ul className="lista-limitacoes">{recProx.motivos.map((m) => <li key={m}>{m}</li>)}</ul></Info>
                </>
              ) : (
                <span>Todos os conteúdos concluídos: sessão para revisar ou resolver questões.</span>
              )}
            </div>
          </div>
          <div className="agora-acoes">
            <button className="btn" onClick={() => despachar({ t: 'cicloPular' }, `${discProx.nomeCurto} pulada.`)}><Icone nome="pular" tam={15} /> Pular</button>
            <button className="btn" onClick={() => abrirSessao({ disciplinaId: prox.disciplinaId, topicoId: recProx?.topico.id ?? null, cicloItemId: prox.id, planejadoMin: prox.minutos, realizadoMin: prox.minutos })}>Registrar</button>
            <button className="btn primario" disabled={!!u.timer} title={u.timer ? 'Já há um cronômetro em andamento' : ''} onClick={() => iniciarEstudo({ disciplinaId: prox.disciplinaId, topicoId: recProx?.topico.id ?? null, cicloItemId: prox.id, planejadoMin: prox.minutos })}>
              <Icone nome="play" tam={13} /> Estudar agora
            </button>
          </div>
        </section>
      ) : (
        <Painel><Vazio icone="ciclo" titulo="Nenhuma sessão ativa">Ative ou adicione disciplinas abaixo.</Vazio></Painel>
      )}

      <Painel
        titulo="Sequência"
        semPadding
        acoes={
          <div className="legenda-ciclo" aria-label="Legenda">
            <span><i className="lc lc-agora" aria-hidden="true" />Agora</span>
            <span><i className="lc lc-passou" aria-hidden="true" />Já passou nesta volta</span>
            <span><i className="lc lc-inativa" aria-hidden="true" />Desativada</span>
          </div>
        }
      >
        <ol className="ciclo-lista">
          {c.itens.map((it, idx) => (
            <ItemCiclo
              key={it.id}
              it={it}
              idx={idx}
              total={c.itens.length}
              situacao={situacaoDe(it.id)}
              arrastando={arrastando === idx}
              sobre={sobre === idx && arrastando !== null && arrastando !== idx}
              onDragStart={() => setArrastando(idx)}
              onDragOver={() => setSobre(idx)}
              onDrop={() => soltar(idx)}
              onDragEnd={() => { setArrastando(null); setSobre(null); }}
              onRemover={async () => {
                const d = seed.disciplinas.find((x) => x.id === it.disciplinaId)!;
                if (await confirmar('Remover sessão do ciclo?', `A sessão de ${d.nomeCurto} (${fmtMin(it.minutos)}) sai do ciclo. As sessões já estudadas continuam no histórico. Se quiser só pausar, use “Desativar”.`, 'Remover')) despachar({ t: 'cicloRemover', itemId: it.id }, 'Sessão removida do ciclo.');
              }}
            />
          ))}
        </ol>
        <form
          className="adicionar-ciclo"
          onSubmit={(e) => {
            e.preventDefault();
            if (novaDisc && despachar({ t: 'cicloAdicionar', disciplinaId: novaDisc, minutos: novaMin }, 'Sessão adicionada ao final do ciclo.')) setNovaDisc('');
          }}
        >
          <div className="campo">
            <label htmlFor="ci-nova">Adicionar sessão ao final</label>
            <select id="ci-nova" value={novaDisc} onChange={(e) => setNovaDisc(e.target.value)}>
              <option value="">Escolha a disciplina…</option>
              {seed.nucleos.map((n) => (
                <optgroup key={n.id} label={n.nome}>
                  {seed.disciplinas.filter((d) => d.nucleo === n.id).map((d) => <option key={d.id} value={d.id}>{d.nomeCurto}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="ci-min">Minutos</label>
            <input id="ci-min" type="number" min={5} max={600} step={5} value={novaMin} onChange={(e) => setNovaMin(Number(e.target.value))} />
          </div>
          <button className="btn" type="submit" disabled={!novaDisc}><Icone nome="mais" tam={15} /> Adicionar</button>
        </form>
      </Painel>

      <details className="painel recolhivel">
        <summary>
          <Icone nome="direita" tam={16} />
          <h2>Tempo e distribuição sugerida</h2>
          <span className="nota">Gerais {fmtMin(minNucleo('CG'))} · Específicos {fmtMin(minNucleo('CE'))}</span>
        </summary>
        <div className="grade-2">
          <div>
            <h3 style={{ marginBottom: 14 }}>Tempo por disciplina na volta</h3>
            {volta === 0 ? <Vazio>Sem sessões ativas.</Vazio> : (
              <BarrasH
                itens={Object.entries(porDisc)
                  .map(([id, m]) => ({ rotulo: seed.disciplinas.find((d) => d.id === id)!.nomeCurto, valor: m, classe: `b-${seed.disciplinas.find((d) => d.id === id)!.nucleo}`, sub: fmtPct(m / volta) }))
                  .sort((a, b) => b.valor - a.valor)}
              />
            )}
          </div>
          <div className="form">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              Distribuição sugerida
              <Info>
                Redistribui o tempo de cada sessão ativa conforme os conteúdos pendentes, pesados pela prioridade (Urgente 3, Alta 2, Média 1, Baixa 0,5; concluídos 0,25), pelo peso do bloco na prova (Gerais 1, Específicos 2, item 7.1) e pela prioridade da disciplina, se você definiu uma. Arredonda em blocos de 15 minutos.
              </Info>
            </h3>
            <div className="form-linha">
              <div className="campo">
                <label htmlFor="ci-tot">Minutos por volta</label>
                <input id="ci-tot" type="number" min={60} max={20000} step={15} value={totalSug} onChange={(e) => setTotalSug(Number(e.target.value))} />
              </div>
              <button className="btn" type="button" onClick={() => setSugestao(distribuicaoSugerida(c, seed.disciplinas, seed.topicos, u, totalSug))} disabled={!at.length}>Calcular</button>
            </div>
            {sugestao && (
              <>
                <div className="tabela-wrap tabela-rolagem" style={{ border: '1px solid var(--linha)', borderRadius: 'var(--r)' }}>
                  <table className="tabela">
                    <thead><tr><th>Sessão</th><th className="num">Atual</th><th className="num">Sugerido</th></tr></thead>
                    <tbody>
                      {at.map((i, k) => (
                        <tr key={i.id}>
                          <td>{k + 1}. {seed.disciplinas.find((d) => d.id === i.disciplinaId)!.nomeCurto}</td>
                          <td className="num fraco">{fmtMin(i.minutos)}</td>
                          <td className={`num ${sugestao[i.id] !== i.minutos ? 'forte' : ''}`}>{fmtMin(sugestao[i.id])}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="acoes" style={{ alignItems: 'center' }}>
                  <span className="nota" style={{ marginRight: 'auto' }}>Total sugerido: {fmtMin(Object.values(sugestao).reduce((a, b) => a + b, 0))}</span>
                  <button className="btn fantasma" onClick={() => setSugestao(null)}>Descartar</button>
                  <button
                    className="btn primario"
                    onClick={async () => {
                      if (await confirmar('Aplicar distribuição sugerida?', 'Os minutos de todas as sessões ativas serão substituídos pelos valores sugeridos. A ordem e o próximo item não mudam.', 'Aplicar')) {
                        if (despachar({ t: 'cicloDistribuicao', minutos: sugestao }, 'Distribuição aplicada.')) setSugestao(null);
                      }
                    }}
                  >
                    Aplicar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </details>
    </div>
  );
}

function ItemCiclo(p: {
  it: CicloItem;
  idx: number;
  total: number;
  situacao: Situacao;
  arrastando: boolean;
  sobre: boolean;
  onDragStart: () => void;
  onDragOver: () => void;
  onDrop: () => void;
  onDragEnd: () => void;
  onRemover: () => void;
}) {
  const { dados, despachar } = useApp();
  const { abrirTopico } = useUi();
  const u = dados.user;
  const { it, idx } = p;
  const d = seed.disciplinas.find((x) => x.id === it.disciplinaId)!;
  const ct = contar(topicosDaDisciplina(seed.topicos, d.id), u);
  const rec = proximoTopico(seed.topicos, seed.disciplinas, u, u.dependencias, d.id);
  const [min, setMin] = useState(String(it.minutos));
  useEffect(() => setMin(String(it.minutos)), [it.minutos]);

  const salvarMin = () => {
    const n = Number(min);
    if (n === it.minutos) return;
    if (!despachar({ t: 'cicloMinutos', itemId: it.id, minutos: n }, 'Tempo da sessão salvo.')) setMin(String(it.minutos));
  };

  return (
    <li
      className={`ci ci-${p.situacao} ${p.arrastando ? 'arrastando' : ''} ${p.sobre ? 'sobre' : ''}`}
      onDragOver={(e) => { e.preventDefault(); p.onDragOver(); }}
      onDrop={(e) => { e.preventDefault(); p.onDrop(); }}
    >
      <span className="ci-alca" draggable onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(idx)); p.onDragStart(); }} onDragEnd={p.onDragEnd} title="Arraste para reordenar" aria-hidden="true"><Icone nome="alca" tam={16} /></span>
      <span className="ci-pos">{idx + 1}</span>
      <div className="ci-corpo">
        <div className="ci-titulo">
          <b>{d.nomeCurto}</b>
          <NucleoTag n={d.nucleo} />
          {p.situacao === 'agora' && <span className="chip chip-solido">Agora</span>}
          {p.situacao === 'seguinte' && <span className="chip chip-pri">Em seguida</span>}
          {p.situacao === 'passou' && <span className="chip"><Icone nome="check" tam={11} /> já passou</span>}
          {!it.ativo && <span className="chip">Desativada</span>}
          {rec?.tipo === 'prerequisito' && <span className="chip chip-erro" title={rec.motivos[0]}>base pendente</span>}
          {it.ativo && !rec && <span className="chip chip-ok">Disciplina concluída</span>}
        </div>
        <div className="ci-sub">
          <span className="ci-prog"><Barra valor={ct.pct} rotulo={`Progresso em ${d.nomeCurto}`} tom={d.nucleo === 'CG' ? 'cg' : 'ce'} />{fmtPct(ct.pct)}</span>
          {rec && <button className="link" onClick={() => abrirTopico(rec.topico.id)}>{rec.tipo === 'prerequisito' ? 'Base: ' : ''}nº {rec.topico.numero} {rec.topico.titulo}</button>}
        </div>
      </div>
      <div className="ci-ctrl">
        <label className="ci-min">
          <span className="sr">Minutos de {d.nomeCurto}</span>
          <input type="number" min={5} max={600} step={5} value={min} onChange={(e) => setMin(e.target.value)} onBlur={salvarMin} onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()} />
          <span aria-hidden="true">min</span>
        </label>
        <button className="btn-icone pq" aria-label={`Subir ${d.nomeCurto}`} title="Subir" disabled={idx === 0} onClick={() => despachar({ t: 'cicloMover', de: idx, para: idx - 1 })}><Icone nome="cima" tam={15} /></button>
        <button className="btn-icone pq" aria-label={`Descer ${d.nomeCurto}`} title="Descer" disabled={idx === p.total - 1} onClick={() => despachar({ t: 'cicloMover', de: idx, para: idx + 1 })}><Icone nome="baixo" tam={15} /></button>
        <MenuAcoes
          rotulo={`Mais ações para ${d.nomeCurto}`}
          itens={[
            it.ativo && p.situacao !== 'agora' && { rotulo: 'Tornar a próxima', icone: 'bandeira', onClick: () => despachar({ t: 'cicloProximo', itemId: it.id }, `${d.nomeCurto} definida como próxima.`) },
            { rotulo: it.ativo ? 'Desativar' : 'Ativar', icone: it.ativo ? 'pause' : 'play', onClick: () => despachar({ t: 'cicloAtivo', itemId: it.id, ativo: !it.ativo }, it.ativo ? 'Sessão desativada. O histórico foi mantido.' : 'Sessão ativada.') },
            { rotulo: 'Remover do ciclo', icone: 'lixeira', perigo: true, onClick: p.onRemover },
          ]}
        />
      </div>
    </li>
  );
}
