import { useEffect, useMemo, useState } from 'react';
import type { TipoDependencia } from '../domain/types';
import { useApp, seed } from '../store/AppStore';
import { estadoDe, isConcluido } from '../domain/progress';
import { prioridadeTopico } from '../domain/cycle';
import { prereqsDe, dependentesDe } from '../domain/deps';
import { proximaRevisao } from '../domain/revisions';
import { fmtDia, fmtMin, isoDia } from '../domain/util';
import { Icone, Info, LinkEdital, Modal, NucleoTag, PrioridadeSeletor, PrioridadeTag, StatusPill, StatusSeletor } from './primitives';
import { useUi } from './UiContext';

// Ficha do conteúdo, aberta como painel lateral: referência, situação, prioridade,
// pré-requisitos, sessões e observações.
export function TopicoDetalhe({ id, onFechar }: { id: string | null; onFechar: () => void }) {
  const { dados, despachar } = useApp();
  const { abrirSessao, iniciarEstudo, abrirTopico, confirmar, navegar } = useUi();
  const u = dados.user;
  const t = id ? seed.topicos.find((x) => x.id === id) : null;
  const [notas, setNotas] = useState('');
  const [novoDe, setNovoDe] = useState('');
  const [novoTipo, setNovoTipo] = useState<TipoDependencia>('recomendado');
  useEffect(() => {
    if (id) setNotas(estadoDe(u, id).notas);
    setNovoDe('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  const sessoes = useMemo(() => (id ? u.sessoes.filter((s) => s.topicoId === id).sort((a, b) => b.data.localeCompare(a.data)) : []), [u.sessoes, id]);
  if (!t) return null;
  const d = seed.disciplinas.find((x) => x.id === t.disciplinaId)!;
  const e = estadoDe(u, t.id);
  const byId = new Map(seed.topicos.map((x) => [x.id, x]));
  const pre = prereqsDe(u.dependencias, t.id);
  const dep = dependentesDe(u.dependencias, t.id);
  const rev = proximaRevisao(e, u.config);
  const total = sessoes.reduce((a, s) => a + s.realizadoMin, 0);
  const concluido = isConcluido(e.status);

  return (
    <Modal titulo={`Conteúdo nº ${t.numero}`} aberto={!!id} onFechar={onFechar} lado>
      <div className="ficha">
        <div className="ficha-topo">
          <div className="ficha-trilha">
            <NucleoTag n={d.nucleo} />
            <span>{d.nome}</span>
          </div>
          <h3 className="ficha-titulo">{t.titulo}</h3>
          <div className="estudo-meta">
            <StatusPill s={e.status} />
            <PrioridadeTag p={prioridadeTopico(t, u)} propria={!!e.prioridade} />
            {e.dominado && <span className="chip chip-ok">Dominado</span>}
            {total > 0 && <span>{fmtMin(total)} estudados</span>}
          </div>
          <div className="ficha-acoes">
            <button className="btn primario" disabled={!!u.timer} title={u.timer ? 'Já há uma sessão em andamento' : undefined} onClick={() => { iniciarEstudo({ disciplinaId: d.id, topicoId: t.id, cicloItemId: null, planejadoMin: u.config.duracaoPadraoMin }); onFechar(); }}>
              <Icone nome="play" tam={13} /> Estudar agora
            </button>
            <button className="btn" onClick={() => abrirSessao({ disciplinaId: d.id, topicoId: t.id })}><Icone nome="editar" tam={15} /> Registrar sessão</button>
          </div>
        </div>

        <section className="ficha-secao">
          <h3>Situação</h3>
          <StatusSeletor valor={e.status} onChange={(s) => despachar({ t: 'status', topicoId: t.id, status: s })} />
          <label className="check" title={concluido ? '' : 'Marque como estudado primeiro'}>
            <input type="checkbox" checked={e.dominado} disabled={!concluido} onChange={(ev) => despachar({ t: 'dominado', topicoId: t.id, valor: ev.target.checked })} />
            <span>Domino este assunto <span className="nota">(acerto consistente em questões; não altera o percentual)</span></span>
          </label>
          {concluido && (
            <div className="painel-rodape" style={{ marginTop: 0 }}>
              <span className="nota" style={{ flex: 1 }}>
                Concluído em {e.concluidoEm ? fmtDia(e.concluidoEm, { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'} · {e.revisoesFeitas} revisão(ões)
                {rev ? ` · próxima ${rev <= isoDia() ? 'vencida desde' : 'em'} ${fmtDia(rev)}` : ''}
              </span>
              <button className="btn pq" onClick={() => despachar({ t: 'revisao', topicoId: t.id }, 'Revisão registrada.')}><Icone nome="revisao" tam={14} /> Revisão feita hoje</button>
            </div>
          )}
        </section>

        <section className="ficha-secao">
          <h3>
            Referência no edital
            <Info>
              O Anexo II não numera itens nem subitens: o nº {t.numero} é a numeração da sua planilha Edital Verticalizado.
              {t.desdobramentoPlanilha ? ' Este item é um desdobramento feito pela planilha a partir do texto do edital, marcado como [Interpretação].' : ''}
            </Info>
          </h3>
          {t.ref.trecho ? <blockquote className="citacao">“{t.ref.trecho}”</blockquote> : <p className="aviso"><Icone nome="alerta" tam={16} /> O trecho correspondente não foi localizado automaticamente. Confira o texto da disciplina na página indicada.</p>}
          <p className="nota">
            {t.ref.anexo} · {d.nome} · <LinkEdital pagina={t.ref.paginas[0]}>p. {t.ref.paginas.join(' e ')}</LinkEdital>
            {t.ref.confianca !== 'alta' && t.ref.trecho ? ' · correspondência parcial, confira no edital' : ''}
            {' · '}<button className="link" onClick={() => { onFechar(); navegar(`referencias?t=${t.id}`); }}>ver em Referências</button>
          </p>
        </section>

        <section className="ficha-secao">
          <h3>
            Prioridade
            <Info>Classificação estratégica, não oficial. Incidência histórica segundo a planilha: {t.incidencia}</Info>
          </h3>
          <PrioridadeSeletor valor={e.prioridade} padrao={t.prioridadePlanilha} onChange={(p) => despachar({ t: 'prioridade', topicoId: t.id, valor: p })} id="det-prio" />
        </section>

        <section className="ficha-secao">
          <h3>Pré-requisitos</h3>
          {pre.length === 0 ? (
            <p className="nota">Nenhum pré-requisito cadastrado.</p>
          ) : (
            <ul className="lista">
              {pre.map((p) => {
                const x = byId.get(p.de)!;
                return (
                  <li key={p.id}>
                    <span className={`chip ${p.tipo === 'obrigatorio' ? 'chip-erro' : 'chip-pri'}`}>{p.tipo === 'obrigatorio' ? 'Obrigatório' : 'Recomendado'}</span>
                    <button className="link link-sutil" style={{ flex: 1, minWidth: 0 }} onClick={() => abrirTopico(x.id)}><span className="num-item">nº {x.numero}</span>{x.titulo}</button>
                    <StatusPill s={estadoDe(u, x.id).status} />
                    <button className="btn-icone pq" aria-label={`Remover pré-requisito nº ${x.numero}`} title="Remover" onClick={async () => { if (await confirmar('Remover pré-requisito?', `“${x.titulo}” deixará de ser pré-requisito deste conteúdo.`, 'Remover')) despachar({ t: 'depRemover', id: p.id }, 'Pré-requisito removido.'); }}><Icone nome="x" tam={14} /></button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="form-linha">
            <select aria-label="Novo pré-requisito" value={novoDe} onChange={(ev) => setNovoDe(ev.target.value)} style={{ flex: '1 1 220px' }}>
              <option value="">Adicionar pré-requisito…</option>
              {seed.disciplinas.map((dd) => (
                <optgroup key={dd.id} label={dd.nomeCurto}>
                  {seed.topicos.filter((x) => x.disciplinaId === dd.id && x.id !== t.id).map((x) => (
                    <option key={x.id} value={x.id}>{x.numero} · {x.titulo}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <select aria-label="Tipo do pré-requisito" value={novoTipo} onChange={(ev) => setNovoTipo(ev.target.value as TipoDependencia)} style={{ flex: '0 1 170px' }}>
              <option value="recomendado">Recomendado</option>
              <option value="obrigatorio">Obrigatório</option>
            </select>
            <button className="btn" disabled={!novoDe} onClick={() => { if (despachar({ t: 'depAdicionar', de: novoDe, para: t.id, tipo: novoTipo }, 'Pré-requisito adicionado.')) setNovoDe(''); }}>Adicionar</button>
          </div>
          {dep.length > 0 && (
            <p className="nota">
              É pré-requisito de{' '}
              {dep.map((p, i) => {
                const x = byId.get(p.para)!;
                return (
                  <span key={p.id}>
                    {i > 0 ? ', ' : ''}
                    <button className="link" onClick={() => abrirTopico(x.id)}>nº {x.numero}</button>
                  </span>
                );
              })}
            </p>
          )}
        </section>

        <section className="ficha-secao">
          <h3>Sessões {total > 0 && <span className="contador">{fmtMin(total)}</span>}</h3>
          {sessoes.length === 0 ? (
            <p className="nota">Nenhuma sessão registrada neste conteúdo.</p>
          ) : (
            <ul className="lista ficha-sessoes">
              {sessoes.map((s) => (
                <li key={s.id}>
                  <span className="num" style={{ width: 48 }}>{fmtDia(s.data)}</span>
                  <span>{s.notas || `planejado ${fmtMin(s.planejadoMin)}`}</span>
                  <b className="num">{fmtMin(s.realizadoMin)}</b>
                  <button className="btn-icone pq" aria-label={`Corrigir sessão de ${fmtDia(s.data)}`} title="Corrigir" onClick={() => abrirSessao(s)}><Icone nome="editar" tam={14} /></button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="ficha-secao">
          <h3><label htmlFor="det-notas">Observações</label></h3>
          <textarea id="det-notas" rows={4} value={notas} onChange={(ev) => setNotas(ev.target.value)} onBlur={() => notas !== e.notas && despachar({ t: 'notas', topicoId: t.id, texto: notas }, 'Observações salvas.')} placeholder="Resumo, macetes, onde errou… (salva ao sair do campo)" />
        </section>

        <details className="textos">
          <summary><Icone nome="direita" tam={16} /> Texto integral de {d.nomeCurto} no Anexo II</summary>
          <p className="texto-oficial">{d.textoOficial}</p>
        </details>
      </div>
    </Modal>
  );
}
