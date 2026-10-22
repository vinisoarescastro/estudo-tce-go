import { useState } from 'react';
import { FRASES, horaNoFuso, primeiroNome, proximaFrase, saudacaoDoDia, type BaralhoFrases } from '../domain/saudacao';
import { useApp, seed } from '../store/AppStore';
import { contar, estadoDe, isConcluido } from '../domain/progress';
import { ativos, prioridadeTopico, proximoItem } from '../domain/cycle';
import { proximoTopico } from '../domain/recommend';
import { prereqsDe } from '../domain/deps';
import { somaMin } from '../domain/stats';
import { diffDias, fmtDia, fmtMin, fmtPct, inicioSemana, isoDia, parseDia } from '../domain/util';
import { Barra, Icone, useAgora, LinkEdital, NucleoTag, Painel, PrioridadeTag, StatusPill, Vazio } from '../ui/primitives';
import { useUi } from '../ui/UiContext';
import { Avatar } from '../ui/Avatar';

// Frase motivacional: sorteia sem repetir até todas aparecerem; o baralho fica salvo neste navegador.
function sortearFrase(): number {
  let salvo: BaralhoFrases | null = null;
  try {
    salvo = JSON.parse(localStorage.getItem('estudo:frases') ?? 'null');
  } catch {
    /* sem armazenamento: sorteia do zero */
  }
  const r = proximaFrase(salvo, FRASES.length);
  try {
    localStorage.setItem('estudo:frases', JSON.stringify(r.baralho));
  } catch {
    /* preferência só desta aba */
  }
  return r.indice;
}

const INICIAL = 4;
const PASSO = 5;

// Página inicial: os quatro indicadores essenciais, o próximo estudo do ciclo e o que vem depois.
export function Inicio() {
  const { dados, despachar, usuario } = useApp();
  const { abrirTopico, abrirSessao, iniciarEstudo, navegar } = useUi();
  const u = dados.user;
  const hoje = isoDia();
  const [mostrar, setMostrar] = useState(INICIAL);
  const [fraseIdx, setFraseIdx] = useState(sortearFrase);
  const agora = useAgora(60_000);

  // Indicadores (mesmas regras do restante da plataforma)
  const c = contar(seed.topicos, u);
  const hojeMin = somaMin(u.sessoes.filter((s) => s.data === hoje));
  const semanaMin = somaMin(u.sessoes.filter((s) => s.data >= inicioSemana(hoje) && s.data <= hoje));
  const prova = u.config.dataProva;
  const faltam = prova ? diffDias(hoje, prova) : null;

  // Próximo estudo: posição atual do ciclo + regras de pré-requisito e prioridade
  const at = ativos(u.ciclo);
  const prox = proximoItem(u.ciclo);
  const disc = prox ? seed.disciplinas.find((d) => d.id === prox.disciplinaId)! : null;
  const rec = prox ? proximoTopico(seed.topicos, seed.disciplinas, u, u.dependencias, prox.disciplinaId) : null;
  const pos = prox ? at.findIndex((i) => i.id === prox.id) : -1;
  const pre = rec ? prereqsDe(u.dependencias, rec.topico.id) : [];
  const byId = new Map(seed.topicos.map((t) => [t.id, t]));
  const sequencia = pos >= 0 ? Array.from({ length: at.length - 1 }, (_, k) => at[(pos + 1 + k) % at.length]) : [];

  const saudacao = saudacaoDoDia(horaNoFuso(new Date(agora), u.config.fusoHorario));
  const nome = primeiroNome(usuario.nome, usuario.email);
  const extenso = parseDia(hoje).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="pagina">
      <header className="hero">
        <Avatar usuario={usuario} tam={64} className="hero-foto" />
        <div className="hero-txt">
          <p className="hero-data">{extenso.charAt(0).toUpperCase() + extenso.slice(1)}</p>
          <h1>{saudacao}, <span>{nome}</span></h1>
          <p className="hero-frase" key={fraseIdx}>
            {FRASES[fraseIdx]}
            <button className="hero-outra" onClick={() => setFraseIdx(sortearFrase())} title="Outra frase" aria-label="Mostrar outra frase"><Icone nome="revisao" tam={14} /></button>
          </p>
        </div>
        <div className="hero-acoes">
          <button className="btn" onClick={() => abrirSessao()}><Icone nome="mais" tam={16} /> Registrar horas</button>
        </div>
      </header>

      <section className="kpis" aria-label="Indicadores principais">
        <div className="kpi">
          <div className="kpi-k">Conclusão do edital</div>
          <div className="kpi-v">{fmtPct(c.pct)}</div>
          <div className="kpi-s">{c.concluidos} de {c.total} conteúdos</div>
          <Barra valor={c.pct} rotulo="Conclusão do edital" />
        </div>
        <div className="kpi">
          <div className="kpi-k">Dias para a prova</div>
          {faltam === null ? (
            <>
              <div className="kpi-v kpi-vazio">—</div>
              <div className="kpi-s"><a href="#/config/metas">Cadastre a data da prova</a></div>
            </>
          ) : (
            <>
              <div className="kpi-v">{Math.max(0, faltam)}<small>{faltam === 1 ? 'dia' : 'dias'}</small></div>
              <div className="kpi-s">{faltam < 0 ? 'A prova já foi realizada' : fmtDia(prova, { day: 'numeric', month: 'long', year: 'numeric' })}</div>
            </>
          )}
        </div>
        <div className="kpi">
          <div className="kpi-k">Estudado hoje</div>
          <div className="kpi-v">{fmtMin(hojeMin)}</div>
          {u.config.metaDiariaMin > 0 ? (
            <>
              <div className="kpi-s">meta {fmtMin(u.config.metaDiariaMin)} · {fmtPct(hojeMin / u.config.metaDiariaMin)}</div>
              <Barra valor={hojeMin / u.config.metaDiariaMin} rotulo="Meta diária" tom={hojeMin >= u.config.metaDiariaMin ? 'ok' : undefined} />
            </>
          ) : <div className="kpi-s">sem meta diária</div>}
        </div>
        <div className="kpi">
          <div className="kpi-k">Estudado na semana</div>
          <div className="kpi-v">{fmtMin(semanaMin)}</div>
          {u.config.metaSemanalMin > 0 ? (
            <>
              <div className="kpi-s">meta {fmtMin(u.config.metaSemanalMin)} · {fmtPct(semanaMin / u.config.metaSemanalMin)}</div>
              <Barra valor={semanaMin / u.config.metaSemanalMin} rotulo="Meta semanal" tom={semanaMin >= u.config.metaSemanalMin ? 'ok' : undefined} />
            </>
          ) : <div className="kpi-s">sem meta semanal</div>}
        </div>
      </section>

      <section className="prox" aria-labelledby="pe-t">
        <header className="prox-cab">
          <h2 id="pe-t" className="prox-rotulo">Próximo estudo</h2>
          {prox && <span className="prox-ciclo">Posição {pos + 1} de {at.length} · volta {u.ciclo.numero}</span>}
        </header>
        {!prox || !disc ? (
          <Vazio icone="ciclo" titulo="O ciclo não tem sessões ativas" acao={<button className="btn primario" onClick={() => navegar('ciclo')}>Montar o ciclo</button>}>
            Ative ou adicione disciplinas para receber o próximo estudo.
          </Vazio>
        ) : (
          <>
            <div className="prox-corpo">
              <div className="prox-info">
                <div className="prox-disc"><NucleoTag n={disc.nucleo} /><b>{disc.nome}</b></div>
                {rec ? (
                  <>
                    <button className="prox-titulo" onClick={() => abrirTopico(rec.topico.id)}>
                      <span className="num-item">nº {rec.topico.numero}</span>{rec.topico.titulo}
                    </button>
                    <div className="prox-meta">
                      <PrioridadeTag p={prioridadeTopico(rec.topico, u)} propria={!!estadoDe(u, rec.topico.id).prioridade} />
                      <StatusPill s={estadoDe(u, rec.topico.id).status} />
                      <span><Icone nome="sessoes" tam={14} /> {fmtMin(prox.minutos)}</span>
                      <span><Icone nome="edital" tam={14} /> <LinkEdital pagina={rec.topico.ref.paginas[0]}>Edital, p. {rec.topico.ref.paginas.join(' e ')}</LinkEdital></span>
                    </div>
                    {rec.tipo === 'prerequisito' && (
                      <p className="prox-aviso"><Icone nome="alerta" tam={15} /> Estude primeiro a base: {rec.motivos[0]}</p>
                    )}
                  </>
                ) : (
                  <p className="nota">Todos os conteúdos desta disciplina estão concluídos. Use a sessão para revisar ou resolver questões.</p>
                )}
              </div>
              <div className="prox-acoes">
                {u.timer ? (
                  <>
                    <p className="em-andamento"><span className="ponto" aria-hidden="true" /> Sessão em andamento no cronômetro.</p>
                    <button className="btn primario grande" onClick={() => navegar('foco')}>
                      <Icone nome="alvo" tam={15} /> Voltar ao foco
                    </button>
                  </>
                ) : (
                  <button className="btn primario grande" onClick={() => iniciarEstudo({ disciplinaId: prox.disciplinaId, topicoId: rec?.topico.id ?? null, cicloItemId: prox.id, planejadoMin: prox.minutos })}>
                    <Icone nome="play" tam={14} /> Estudar agora
                  </button>
                )}
                <button className="btn" onClick={() => abrirSessao({ disciplinaId: prox.disciplinaId, topicoId: rec?.topico.id ?? null, cicloItemId: prox.id, planejadoMin: prox.minutos, realizadoMin: prox.minutos })}>
                  Registrar sessão
                </button>
                {rec && !isConcluido(estadoDe(u, rec.topico.id).status) && (
                  <button className="btn fantasma" onClick={() => despachar({ t: 'status', topicoId: rec.topico.id, status: 'estudado' }, `nº ${rec.topico.numero} marcado como estudado.`)}>
                    <Icone nome="check" tam={15} /> Marcar como estudado
                  </button>
                )}
              </div>
            </div>
            {rec && (
              <details className="prox-detalhes">
                <summary><Icone nome="direita" tam={14} /> Detalhes{pre.length ? ` · ${pre.length} pré-requisito(s)` : ''}</summary>
                <dl>
                  <div>
                    <dt>Por que agora</dt>
                    <dd>{rec.motivos.map((m) => <span key={m}>{m}</span>)}</dd>
                  </div>
                  {pre.length > 0 && (
                    <div>
                      <dt>Pré-requisitos</dt>
                      <dd>
                        <ul className="pre-lista">
                          {pre.map((p) => {
                            const x = byId.get(p.de)!;
                            const ok = isConcluido(estadoDe(u, x.id).status);
                            return (
                              <li key={p.id} className={ok ? 'ok' : ''}>
                                <Icone nome={ok ? 'check' : 'alerta'} tam={14} />
                                <button className="link link-sutil" onClick={() => abrirTopico(x.id)}>nº {x.numero} {x.titulo}</button>
                                <span className="nota">{p.tipo === 'obrigatorio' ? 'obrigatório' : 'recomendado'}{ok ? ' · concluído' : ''}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt>Trecho do edital</dt>
                    <dd>{rec.topico.ref.trecho ? <span className="trecho">“{rec.topico.ref.trecho}”</span> : <span className="nota">não localizado</span>}</dd>
                  </div>
                </dl>
              </details>
            )}
          </>
        )}
      </section>

      <Painel
        titulo="Na sequência do ciclo"
        acoes={<button className="btn fantasma pq" onClick={() => navegar('ciclo')}>Ver ciclo completo <Icone nome="direita" tam={14} /></button>}
      >
        {sequencia.length === 0 ? (
          <Vazio icone="ciclo">{prox ? 'Esta é a única sessão ativa do ciclo.' : 'Nenhuma sessão ativa.'}</Vazio>
        ) : (
          <>
            <ol className="sequencia">
              {sequencia.slice(0, mostrar).map((it, k) => {
                const d = seed.disciplinas.find((x) => x.id === it.disciplinaId)!;
                const r = proximoTopico(seed.topicos, seed.disciplinas, u, u.dependencias, d.id);
                const posicao = ((pos + 1 + k) % at.length) + 1;
                return (
                  <li key={it.id}>
                    <span className="seq-pos" aria-label={`Posição ${posicao}`}>{posicao}</span>
                    <div className="seq-corpo">
                      <div className="seq-titulo"><b>{d.nomeCurto}</b><span className="seq-min">{fmtMin(it.minutos)}</span>{r?.tipo === 'prerequisito' && <span className="chip chip-erro" title={r.motivos[0]}>base pendente</span>}</div>
                      <div className="seq-sub">
                        {r ? <button className="link" onClick={() => abrirTopico(r.topico.id)}>nº {r.topico.numero} · {r.topico.titulo}</button> : <span>Disciplina concluída · sessão de revisão</span>}
                      </div>
                    </div>
                    {r && <PrioridadeTag p={prioridadeTopico(r.topico, u)} propria={!!estadoDe(u, r.topico.id).prioridade} />}
                  </li>
                );
              })}
            </ol>
            {(sequencia.length > mostrar || mostrar > INICIAL) && (
              <div className="painel-rodape">
                {sequencia.length > mostrar && <button className="btn pq" onClick={() => setMostrar((m) => m + PASSO)}>Mostrar mais</button>}
                {mostrar > INICIAL && <button className="btn fantasma pq" onClick={() => setMostrar(INICIAL)}>Mostrar menos</button>}
                <span className="nota" style={{ marginLeft: 'auto' }}>{Math.min(mostrar, sequencia.length)} de {sequencia.length}</span>
              </div>
            )}
          </>
        )}
      </Painel>
    </div>
  );
}
