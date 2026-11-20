import { useMemo, useState } from 'react';
import type { Prioridade, Topico } from '../domain/types';
import { PRIORIDADES } from '../domain/types';
import { useApp, seed } from '../store/AppStore';
import { estadoDe } from '../domain/progress';
import { prioridadeTopico } from '../domain/cycle';
import { agendaRevisoes, revisoesDevidas, revisoesFeitas } from '../domain/revisions';
import { diffDias, fmtDia, inicioSemana, isoDia, somarDias } from '../domain/util';
import { Abas, Cabecalho, Icone, Painel, PrioridadeTag, Vazio } from '../ui/primitives';
import { useUi } from '../ui/UiContext';

type Aba = 'revisar' | 'proximas' | 'feitas';
const DIAS_AGENDA = 30;
const DIAS_FEITAS = 30;
const MIN_REVISAO = 30; // tempo planejado de uma revisão com cronômetro

const dias = (n: number) => `${n} ${n === 1 ? 'dia' : 'dias'}`;

// Revisões espaçadas: o que está vencido (para marcar como revisado ou revisar com o cronômetro),
// a agenda dos próximos dias e as revisões já feitas.
export function Revisoes() {
  const { dados, despachar } = useApp();
  const { abrirTopico, iniciarEstudo } = useUi();
  const u = dados.user;
  const hoje = isoDia();
  const [aba, setAba] = useState<Aba>('revisar');
  const [disc, setDisc] = useState('');
  const [prio, setPrio] = useState<Prioridade | ''>('');

  const passa = (t: Topico) => (!disc || t.disciplinaId === disc) && (!prio || prioridadeTopico(t, u) === prio);
  const devidas = useMemo(() => revisoesDevidas(seed.topicos, u, hoje), [u, hoje]);
  const agenda = useMemo(() => agendaRevisoes(seed.topicos, u, hoje, somarDias(hoje, DIAS_AGENDA)), [u, hoje]);
  const feitas = useMemo(() => revisoesFeitas(seed.topicos, u, somarDias(hoje, -(DIAS_FEITAS - 1)), (ts) => isoDia(new Date(ts))), [u, hoje]);

  const atrasadas = devidas.filter((r) => r.atrasoDias > 0);
  const deHoje = devidas.filter((r) => r.atrasoDias === 0);
  const prox7 = agenda.filter((a) => a.data <= somarDias(hoje, 7)).length;
  const semana = feitas.filter((f) => f.dia >= inicioSemana(hoje)).length;
  const nomeDisc = (id: string) => seed.disciplinas.find((d) => d.id === id)?.nomeCurto ?? id;
  const quando = (d: string) => {
    const n = diffDias(hoje, d);
    if (n === 0) return 'hoje';
    if (n === 1) return 'amanhã';
    if (n === -1) return 'ontem';
    const s = fmtDia(d, { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '');
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  const revisar = (t: Topico) => despachar({ t: 'revisao', topicoId: t.id }, `Revisão de nº ${t.numero} registrada. A próxima já está agendada.`);
  const comCronometro = (t: Topico) => iniciarEstudo({ disciplinaId: t.disciplinaId, topicoId: t.id, cicloItemId: null, planejadoMin: MIN_REVISAO });

  // Linha de uma revisão: título (abre a ficha), detalhes e, nas vencidas, as ações.
  const Linha = ({ t, meta, destaque, acoes }: { t: Topico; meta: React.ReactNode; destaque?: React.ReactNode; acoes?: boolean }) => (
    <li className="revp-item">
      {acoes && (
        <button className="rev-check" onClick={() => revisar(t)} aria-label={`Marcar nº ${t.numero} como revisado`} title="Marcar como revisado">
          <Icone nome="check" tam={13} />
        </button>
      )}
      <div className="revp-corpo">
        <button className="revp-titulo" onClick={() => abrirTopico(t.id)}>
          <span className="num-item">nº {t.numero}</span>{t.titulo}
        </button>
        <span className="revp-meta">
          {destaque}{destaque ? ' · ' : ''}{meta}
        </span>
      </div>
      <PrioridadeTag p={prioridadeTopico(t, u)} propria={!!estadoDe(u, t.id).prioridade} />
      {acoes && (
        <button className="btn pq revp-crono" onClick={() => comCronometro(t)} title="Revisar com o cronômetro: o tempo conta nas suas horas">
          <Icone nome="play" tam={12} /> Revisar
        </button>
      )}
    </li>
  );

  const devFiltradas = (l: typeof devidas) => l.filter((r) => passa(r.topico));
  const agendaFiltrada = agenda.filter((a) => passa(a.topico));
  const feitasFiltradas = feitas.filter((f) => passa(f.topico));
  // Agrupa por data, mantendo a ordem.
  const porData = <T extends { topico: Topico }>(l: T[], data: (x: T) => string) => {
    const m = new Map<string, T[]>();
    for (const x of l) {
      const d = data(x);
      if (!m.has(d)) m.set(d, []);
      m.get(d)!.push(x);
    }
    return [...m.entries()];
  };

  return (
    <div className="pagina">
      <Cabecalho
        titulo="Revisões"
        subtitulo="Cada conteúdo estudado volta para revisão em intervalos crescentes. Revise o que venceu e acompanhe o que vem pela frente."
        info={<>Intervalos atuais: {u.config.revisaoDias.join(', ')} dias depois de cada estudo ou revisão; depois do último, ele se repete. Ajuste em <a href="#/config/metas">Metas e planejamento</a>.</>}
      />

      <section className="kpis" aria-label="Resumo das revisões">
        <div className="kpi">
          <div className="kpi-k">Atrasadas</div>
          <div className={`kpi-v ${atrasadas.length ? 'kpi-alerta' : ''}`}>{atrasadas.length}</div>
          <div className="kpi-s">{atrasadas.length ? `a mais antiga há ${dias(atrasadas[0].atrasoDias)}` : 'nenhuma'}</div>
        </div>
        <div className="kpi">
          <div className="kpi-k">De hoje</div>
          <div className="kpi-v">{deHoje.length}</div>
          <div className="kpi-s">vencem hoje</div>
        </div>
        <div className="kpi">
          <div className="kpi-k">Próximos 7 dias</div>
          <div className="kpi-v">{prox7}</div>
          <div className="kpi-s">agendadas</div>
        </div>
        <div className="kpi">
          <div className="kpi-k">Feitas na semana</div>
          <div className="kpi-v">{semana}</div>
          <div className="kpi-s">desde segunda</div>
        </div>
      </section>

      <div className="revp-barra">
        <Abas<Aba>
          rotulo="Revisões"
          ativa={aba}
          onChange={setAba}
          abas={[
            { id: 'revisar', rotulo: 'Para revisar', contador: devidas.length },
            { id: 'proximas', rotulo: 'Próximas', contador: agenda.length },
            { id: 'feitas', rotulo: 'Feitas', contador: feitas.length },
          ]}
        />
        <div className="revp-filtros">
          <label className="sr-only" htmlFor="rv-disc">Disciplina</label>
          <select id="rv-disc" value={disc} onChange={(e) => setDisc(e.target.value)}>
            <option value="">Todas as disciplinas</option>
            {seed.disciplinas.map((d) => <option key={d.id} value={d.id}>{d.nomeCurto}</option>)}
          </select>
          <label className="sr-only" htmlFor="rv-prio">Prioridade</label>
          <select id="rv-prio" value={prio} onChange={(e) => setPrio(e.target.value as Prioridade | '')}>
            <option value="">Todas as prioridades</option>
            {PRIORIDADES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {aba === 'revisar' && (
        <div className="pilha" id="painel-revisar" role="tabpanel" aria-labelledby="aba-revisar">
          {devidas.length === 0 ? (
            <Painel><Vazio icone="check" titulo="Em dia">Nenhuma revisão vencida.{agenda.length ? ` A próxima é ${quando(agenda[0].data).toLowerCase()}.` : ''}</Vazio></Painel>
          ) : (
            <>
              {[
                { titulo: 'Atrasadas', lista: devFiltradas(atrasadas) },
                { titulo: 'De hoje', lista: devFiltradas(deHoje) },
              ].filter((g) => g.lista.length).map((g) => (
                <Painel key={g.titulo} titulo={<>{g.titulo} <span className={`contador ${g.titulo === 'Atrasadas' ? 'contador-alerta' : ''}`}>{g.lista.length}</span></>}>
                  <ul className="revp-lista">
                    {g.lista.map((r) => (
                      <Linha
                        key={r.topico.id}
                        t={r.topico}
                        acoes
                        destaque={r.atrasoDias > 0 ? <span className="rev-atraso">atrasada {dias(r.atrasoDias)}</span> : 'vence hoje'}
                        meta={<>{estadoDe(u, r.topico.id).revisoesFeitas + 1}ª revisão · {nomeDisc(r.topico.disciplinaId)}</>}
                      />
                    ))}
                  </ul>
                </Painel>
              ))}
              {!devFiltradas(devidas).length && <Painel><Vazio icone="filtro">Nenhuma revisão vencida com esses filtros.</Vazio></Painel>}
              <p className="nota">Marque o círculo quando revisar por conta própria. “Revisar” abre o cronômetro no conteúdo; ao salvar a sessão, a revisão é registrada junto com as horas.</p>
            </>
          )}
        </div>
      )}

      {aba === 'proximas' && (
        <div className="pilha" id="painel-proximas" role="tabpanel" aria-labelledby="aba-proximas">
          {agendaFiltrada.length === 0 ? (
            <Painel><Vazio icone="calendario">{agenda.length ? 'Nenhuma revisão agendada com esses filtros.' : `Nenhuma revisão agendada nos próximos ${DIAS_AGENDA} dias.`}</Vazio></Painel>
          ) : (
            <Painel titulo={`Próximos ${DIAS_AGENDA} dias`}>
              <div className="revp-agenda">
                {porData(agendaFiltrada, (a) => a.data).map(([data, l]) => (
                  <section key={data} className="revp-dia">
                    <h3>{quando(data)} <span className="nota">{l.length} {l.length === 1 ? 'revisão' : 'revisões'}</span></h3>
                    <ul className="revp-lista">
                      {l.map((a) => <Linha key={a.topico.id} t={a.topico} meta={<>{a.numero}ª revisão · {nomeDisc(a.topico.disciplinaId)}</>} />)}
                    </ul>
                  </section>
                ))}
              </div>
            </Painel>
          )}
        </div>
      )}

      {aba === 'feitas' && (
        <div className="pilha" id="painel-feitas" role="tabpanel" aria-labelledby="aba-feitas">
          {feitasFiltradas.length === 0 ? (
            <Painel><Vazio icone="revisao">{feitas.length ? 'Nenhuma revisão feita com esses filtros.' : `Nenhuma revisão registrada nos últimos ${DIAS_FEITAS} dias.`}</Vazio></Painel>
          ) : (
            <Painel titulo={`Últimos ${DIAS_FEITAS} dias`}>
              <div className="revp-agenda">
                {porData(feitasFiltradas, (f) => f.dia).map(([dia, l]) => (
                  <section key={dia} className="revp-dia">
                    <h3>{quando(dia)} <span className="nota">{l.length} {l.length === 1 ? 'revisão' : 'revisões'}</span></h3>
                    <ul className="revp-lista">
                      {l.map((f) => <Linha key={f.ts + f.topico.id} t={f.topico} meta={<>{f.numero ? `${f.numero}ª revisão · ` : ''}{nomeDisc(f.topico.disciplinaId)}</>} />)}
                    </ul>
                  </section>
                ))}
              </div>
            </Painel>
          )}
        </div>
      )}
    </div>
  );
}
