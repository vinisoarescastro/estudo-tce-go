import { useMemo, useState } from 'react';
import type { Disciplina, NucleoId } from '../domain/types';
import { useApp, seed } from '../store/AppStore';
import { contar, serieConclusao, topicosDaDisciplina } from '../domain/progress';
import { prioridadeDisciplina, PESO_PRIORIDADE } from '../domain/cycle';
import { recomendacoes } from '../domain/recommend';
import { revisoesDevidas } from '../domain/revisions';
import { cumprimentoMetas, dias, filtrarSessoes, medias, porDisciplina, porNucleo, porTopico, seriePorDia, seriePorMes, seriePorSemana, somaMin, somaPlanejado } from '../domain/stats';
import { fmtDia, fmtMin, fmtPct, isoDia, parseDia } from '../domain/util';
import { Abas, Barra, Cabecalho, Icone, Kpi, NucleoTag, Painel, PrioridadeTag, Segmentado, Vazio } from '../ui/primitives';
import { Barras, BarrasH, Linhas } from '../ui/charts';
import { Filtros, FILTRO_INICIAL, paraFiltro, type EstadoFiltro } from '../ui/Filtros';
import { ListaRecomendacoes } from '../ui/Recomendacoes';
import { useUi } from '../ui/UiContext';

type Coluna = 'nome' | 'pct' | 'horas' | 'prioridade' | 'pendentes';
type Escala = 'dia' | 'semana' | 'mes';
type Aba = 'visao' | 'horas' | 'disciplinas';

// Dashboard: análises completas, divididas em abas. Os filtros valem para todas elas.
export function Dashboard() {
  const { dados } = useApp();
  const { abrirTopico, navegar } = useUi();
  const u = dados.user;
  const hoje = isoDia();
  const [filtro, setFiltro] = useState<EstadoFiltro>(FILTRO_INICIAL);
  const [ordem, setOrdem] = useState<{ col: Coluna; desc: boolean }>({ col: 'pct', desc: false });
  const [escala, setEscala] = useState<Escala>('dia');
  const [aba, setAba] = useState<Aba>('visao');

  const primeiro = u.sessoes.length ? u.sessoes.reduce((a, s) => (s.data < a ? s.data : a), u.sessoes[0].data) : null;
  const f = paraFiltro(filtro, primeiro);
  const discFiltradas = seed.disciplinas.filter((d) => (!f.nucleo || d.nucleo === f.nucleo) && (!f.disciplinaId || d.id === f.disciplinaId));
  const idsDisc = new Set(discFiltradas.map((d) => d.id));
  const topicos = seed.topicos.filter((t) => idsDisc.has(t.disciplinaId));
  const sessoes = filtrarSessoes(u.sessoes, seed.disciplinas, f);
  const sessoesTodas = filtrarSessoes(u.sessoes, seed.disciplinas, { disciplinaId: f.disciplinaId, nucleo: f.nucleo });

  const c = contar(topicos, u);
  const totalMin = somaMin(sessoes);
  const planMin = somaPlanejado(sessoes);
  const med = medias(sessoesTodas, hoje);
  const metas = cumprimentoMetas(u.sessoes, f.de, f.ate, hoje, u.config.metaDiariaMin, u.config.metaSemanalMin);
  const devidas = revisoesDevidas(topicos, u, hoje);
  const recs = useMemo(() => recomendacoes(seed.topicos, seed.disciplinas, u, hoje), [u, hoje]);
  const conc = serieConclusao(topicos, u, dias(f.de, f.ate));
  const porDisc = porDisciplina(sessoes);
  const porNuc = porNucleo(sessoes, seed.disciplinas);
  const porTop = porTopico(sessoes);
  const semTopico = sessoes.filter((s) => !s.topicoId).reduce((a, s) => a + s.realizadoMin, 0);
  const topById = new Map(seed.topicos.map((t) => [t.id, t]));

  const serieHoras =
    escala === 'dia'
      ? seriePorDia(sessoes, f.de, f.ate).map((p) => ({ rotulo: fmtDia(p.chave), valor: p.min, ref: p.planejado }))
      : escala === 'semana'
        ? seriePorSemana(sessoes, f.de, f.ate).map((p) => ({ rotulo: fmtDia(p.chave), valor: p.min, ref: u.config.metaSemanalMin, dica: `Semana de ${fmtDia(p.chave)}: ${fmtMin(p.min)} (meta ${fmtMin(u.config.metaSemanalMin)}; planejado nas sessões ${fmtMin(p.planejado)})` }))
        : seriePorMes(sessoes, f.de, f.ate).map((p) => ({ rotulo: parseDia(`${p.chave}-01`).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }), valor: p.min, ref: p.planejado }));

  const linhas = discFiltradas.map((d) => {
    const ct = contar(topicosDaDisciplina(seed.topicos, d.id), u);
    const pr = prioridadeDisciplina(d, seed.topicos, u);
    return { d, ct, min: porDisc[d.id] ?? 0, pr };
  });
  const val = (l: (typeof linhas)[number]): number | string => {
    switch (ordem.col) {
      case 'nome': return l.d.nomeCurto;
      case 'pct': return l.ct.pct;
      case 'horas': return l.min;
      case 'prioridade': return PESO_PRIORIDADE[l.pr.p];
      case 'pendentes': return l.ct.pendentes;
    }
  };
  linhas.sort((a, b) => {
    const x = val(a), y = val(b);
    const r = typeof x === 'string' ? x.localeCompare(y as string, 'pt-BR') : (x as number) - (y as number);
    return ordem.desc ? -r : r;
  });
  const cab = (col: Coluna, rotulo: string, cls = '') => (
    <th className={cls} aria-sort={ordem.col === col ? (ordem.desc ? 'descending' : 'ascending') : 'none'}>
      <button className="th-ord" onClick={() => setOrdem((o) => ({ col, desc: o.col === col ? !o.desc : col !== 'nome' && col !== 'pct' }))}>
        {rotulo} {ordem.col === col && <Icone nome={ordem.desc ? 'baixo' : 'cima'} tam={12} />}
      </button>
    </th>
  );

  const situacao = [
    { rotulo: 'Estudados', valor: c.estudados, cls: 'st-estudado' },
    { rotulo: 'Em revisão', valor: c.emRevisao, cls: 'st-em_revisao' },
    { rotulo: 'Em andamento', valor: c.emAndamento, cls: 'st-em_andamento' },
    { rotulo: 'Não iniciados', valor: c.naoIniciados, cls: 'st-nao_iniciado' },
  ];
  const ultimas = [...u.sessoes].sort((a, b) => b.data.localeCompare(a.data) || b.criadoEm.localeCompare(a.criadoEm)).slice(0, 6);
  const nomeD = (id: string) => seed.disciplinas.find((d) => d.id === id)?.nomeCurto ?? id;

  return (
    <div className="pagina">
      <Cabecalho titulo="Dashboard" subtitulo="Evolução, horas, metas e progresso por disciplina." />

      <Filtros valor={filtro} onChange={setFiltro} prefixo="db" />

      <section className="kpis" aria-label="Resumo do período">
        <Kpi rotulo="Horas no período" valor={fmtMin(totalMin)} sub={`${sessoes.length} sessões · ${fmtDia(f.de)} a ${fmtDia(f.ate)}`} />
        <Kpi rotulo="Realizado x planejado" valor={planMin ? fmtPct(totalMin / planMin) : '—'} sub={planMin ? `${fmtMin(totalMin)} de ${fmtMin(planMin)}` : 'nada planejado no período'} />
        <Kpi rotulo="Média diária" valor={fmtMin(med.diaria)} sub={`${fmtMin(med.semanal)} por semana`} />
        <Kpi rotulo="Conteúdos concluídos" valor={fmtPct(c.pct)} sub={`${c.concluidos} de ${c.total}`}>
          <Barra valor={c.pct} rotulo="Percentual concluído" />
        </Kpi>
      </section>

      <Abas<Aba> rotulo="Seções do dashboard" ativa={aba} onChange={setAba} abas={[{ id: 'visao', rotulo: 'Visão geral' }, { id: 'horas', rotulo: 'Horas e metas' }, { id: 'disciplinas', rotulo: 'Disciplinas' }]} />

      {aba === 'visao' && (
        <div className="pilha" id="painel-visao" role="tabpanel" aria-labelledby="aba-visao">
          <div className="grade-3-2">
            <Painel titulo="O que estudar agora" info="Considera a posição no ciclo, pré-requisitos obrigatórios, prioridade, revisões vencidas e o equilíbrio de tempo dos últimos 14 dias.">
              <ListaRecomendacoes itens={recs} />
            </Painel>
            <Painel titulo={<>Revisões vencidas {devidas.length > 0 && <span className="contador contador-alerta">{devidas.length}</span>}</>}>
              {devidas.length === 0 ? (
                <Vazio icone="check">Nada vencido. Intervalos: {u.config.revisaoDias.join(', ')} dias.</Vazio>
              ) : (
                <ul className="lista revisoes">
                  {devidas.slice(0, 8).map((r) => (
                    <li key={r.topico.id}>
                      <button className="link link-sutil" onClick={() => abrirTopico(r.topico.id)}><span className="num-item">nº {r.topico.numero}</span>{r.topico.titulo}</button>
                      <span className={`chip ${r.atrasoDias > 0 ? 'chip-aviso' : ''}`}>{r.atrasoDias > 0 ? `${r.atrasoDias}d` : 'hoje'}</span>
                    </li>
                  ))}
                  {devidas.length > 8 && <li><button className="link" onClick={() => navegar('conteudos')}>e mais {devidas.length - 8} em Conteúdos</button></li>}
                </ul>
              )}
            </Painel>
          </div>
          <div className="grade-3-2">
            <Painel titulo="Conclusão do edital" info="Conta a data em que cada conteúdo passou a “Estudado” ou “Em revisão”. Conteúdos reabertos saem da contagem.">
              <Linhas series={[{ nome: 'Conteúdos concluídos', valores: conc.map((p) => p.concluidos), classe: 's1' }]} rotulos={conc.map((p) => fmtDia(p.dia))} max={c.total} />
            </Painel>
            <Painel titulo="Situação dos conteúdos">
              <div className="empilhada" role="img" aria-label={situacao.map((s) => `${s.rotulo}: ${s.valor}`).join(', ')}>
                {situacao.map((s) => s.valor > 0 && <i key={s.cls} className={s.cls} style={{ flexGrow: s.valor }} title={`${s.rotulo}: ${s.valor}`} />)}
              </div>
              <ul className="legenda-lista">
                {situacao.map((s) => (
                  <li key={s.cls}><span className={`ponto-st ${s.cls}`} aria-hidden="true" />{s.rotulo}<b>{s.valor}</b><span className="nota">{c.total ? fmtPct(s.valor / c.total) : '0%'}</span></li>
                ))}
                <li><span className="ponto-st dom" aria-hidden="true" />Dominados (à parte)<b>{c.dominados}</b><span className="nota">{c.total ? fmtPct(c.dominados / c.total) : '0%'}</span></li>
              </ul>
            </Painel>
          </div>
        </div>
      )}

      {aba === 'horas' && (
        <div className="pilha" id="painel-horas" role="tabpanel" aria-labelledby="aba-horas">
          <Painel
            titulo="Horas estudadas"
            acoes={<Segmentado rotulo="Agrupar horas por" valor={escala} onChange={setEscala} opcoes={[{ valor: 'dia', rotulo: 'Dia' }, { valor: 'semana', rotulo: 'Semana' }, { valor: 'mes', rotulo: 'Mês' }]} />}
          >
            {totalMin === 0 ? <Vazio icone="sessoes">Nenhuma sessão no período.</Vazio> : <Barras dados={serieHoras} legendaRef={escala === 'semana' ? 'Meta semanal' : 'Planejado nas sessões'} />}
          </Painel>
          <div className="grade-2">
            <Painel titulo="Metas" info="Considera todas as sessões (as metas valem para o estudo total), dentro do período filtrado e até hoje. Semanas vão de segunda a domingo.">
              {u.config.metaDiariaMin === 0 && u.config.metaSemanalMin === 0 ? (
                <Vazio icone="alvo" acao={<a className="btn" href="#/config/metas">Definir metas</a>}>Nenhuma meta configurada.</Vazio>
              ) : (
                <ul className="metas">
                  <li>
                    <div className="metas-cab"><span>Dias na meta diária <small>({fmtMin(u.config.metaDiariaMin)})</small></span><b>{metas.diasNaMeta}<small> de {metas.dias}</small></b></div>
                    <Barra valor={metas.dias ? metas.diasNaMeta / metas.dias : 0} rotulo="Dias que atingiram a meta diária" tom="ok" />
                  </li>
                  <li>
                    <div className="metas-cab"><span>Semanas na meta semanal <small>({fmtMin(u.config.metaSemanalMin)})</small></span><b>{metas.semanasNaMeta}<small> de {metas.semanas}</small></b></div>
                    <Barra valor={metas.semanas ? metas.semanasNaMeta / metas.semanas : 0} rotulo="Semanas que atingiram a meta semanal" tom="ok" />
                  </li>
                  <li>
                    <div className="metas-cab"><span>Semana atual</span><b>{fmtMin(metas.semanaAtualMin)}<small> de {fmtMin(u.config.metaSemanalMin)}</small></b></div>
                    <Barra valor={u.config.metaSemanalMin ? metas.semanaAtualMin / u.config.metaSemanalMin : 0} rotulo="Progresso da semana atual" />
                  </li>
                </ul>
              )}
            </Painel>
            <Painel titulo="Gerais x Específicos" info="Referência do edital: 25 questões de Gerais com peso 1 e 45 de Específicos com peso 2 (item 7.1). Em questões ponderadas (45 × 2 = 90 contra 25 × 1), Específicos respondem por cerca de 78%; a nota final usa notas padronizadas (item 9.5), então essa proporção é só uma referência.">
              <BarrasH
                itens={[
                  { rotulo: 'Gerais (peso 1)', valor: porNuc.CG, classe: 'b-CG', sub: totalMin ? fmtPct(porNuc.CG / totalMin) : '' },
                  { rotulo: 'Específicos (peso 2)', valor: porNuc.CE, classe: 'b-CE', sub: totalMin ? fmtPct(porNuc.CE / totalMin) : '' },
                ]}
              />
            </Painel>
          </div>
          <div className="grade-2">
            <Painel titulo="Tempo por disciplina" info="Fatia do tempo do período e, entre parênteses, quanto do tempo planejado nas sessões foi realizado.">
              {totalMin === 0 ? (
                <Vazio icone="sessoes">Nenhuma sessão no período.</Vazio>
              ) : (
                <BarrasH
                  itens={discFiltradas
                    .map((d) => {
                      const ss = sessoes.filter((s) => s.disciplinaId === d.id);
                      const pl = somaPlanejado(ss);
                      const re = somaMin(ss);
                      return { rotulo: d.nomeCurto, valor: re, classe: `b-${d.nucleo}`, sub: `${fmtPct(re / totalMin)}${pl ? ` (${fmtPct(re / pl)})` : ''}` };
                    })
                    .filter((x) => x.valor > 0)
                    .sort((a, b) => b.valor - a.valor)}
                />
              )}
            </Painel>
            <Painel titulo="Conteúdos com mais tempo">
              {Object.keys(porTop).length ? (
                <BarrasH itens={Object.entries(porTop).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id, v]) => ({ rotulo: `nº ${topById.get(id)?.numero} ${topById.get(id)?.titulo}`, valor: v }))} />
              ) : (
                <Vazio icone="conteudos">Nenhuma sessão ligada a um conteúdo no período.</Vazio>
              )}
              {semTopico > 0 && <p className="nota" style={{ marginTop: 14 }}>{fmtMin(semTopico)} em sessões sem conteúdo específico.</p>}
            </Painel>
          </div>
        </div>
      )}

      {aba === 'disciplinas' && (
        <div className="pilha" id="painel-disciplinas" role="tabpanel" aria-labelledby="aba-disciplinas">
          <div className="nucleos">
            {(['CG', 'CE'] as NucleoId[]).map((n) => {
              const nuc = seed.nucleos.find((x) => x.id === n)!;
              const ds = seed.disciplinas.filter((d) => d.nucleo === n);
              const ct = contar(seed.topicos.filter((t) => ds.some((d) => d.id === t.disciplinaId)), u);
              return (
                <section className="painel nucleo" key={n}>
                  <div className="nucleo-topo">
                    <h2>{nuc.nome}</h2>
                    <NucleoTag n={n} />
                  </div>
                  <div className="nucleo-num"><b>{fmtPct(ct.pct)}</b><span>{ct.concluidos} de {ct.total} conteúdos · {ds.length} disciplinas</span></div>
                  <Barra valor={ct.pct} rotulo={`Progresso em ${nuc.nome}`} tom={n === 'CG' ? 'cg' : 'ce'} />
                  <dl className="nucleo-dados">
                    <div><dt>Em andamento</dt><dd>{ct.emAndamento}</dd></div>
                    <div><dt>Em revisão</dt><dd>{ct.emRevisao}</dd></div>
                    <div><dt>Dominados</dt><dd>{ct.dominados}</dd></div>
                    <div><dt>Horas no período</dt><dd>{fmtMin(porNuc[n])}</dd></div>
                  </dl>
                </section>
              );
            })}
          </div>
          <Painel titulo="Progresso por disciplina" semPadding info="A prioridade da disciplina é a que você definiu nas preferências de estudo (•) ou, sem isso, a mais frequente entre os conteúdos dela na planilha. É estratégica, não oficial.">
            <div className="tabela-wrap">
              <table className="tabela">
                <thead>
                  <tr>
                    {cab('nome', 'Disciplina')}
                    {cab('pct', 'Concluído')}
                    {cab('pendentes', 'Pendentes', 'num')}
                    {cab('horas', 'Horas', 'num')}
                    {cab('prioridade', 'Prioridade')}
                  </tr>
                </thead>
                <tbody>
                  {linhas.map(({ d, ct, min, pr }) => <LinhaDisc key={d.id} d={d} ct={ct} min={min} pr={pr} />)}
                </tbody>
              </table>
            </div>
          </Painel>
          <Painel titulo="Últimas sessões" acoes={<button className="btn fantasma pq" onClick={() => navegar('historico')}>Histórico completo <Icone nome="direita" tam={14} /></button>}>
            {ultimas.length === 0 ? (
              <Vazio icone="sessoes">Nenhuma sessão registrada ainda.</Vazio>
            ) : (
              <ul className="lista ultimas">
                {ultimas.map((s) => {
                  const t = s.topicoId ? topById.get(s.topicoId) : null;
                  return (
                    <li key={s.id}>
                      <span className="ultimas-data">{fmtDia(s.data)}</span>
                      <span className="ultimas-corpo">
                        <b>{nomeD(s.disciplinaId)}</b>
                        <span>{t ? `nº ${t.numero} ${t.titulo}` : 'sem conteúdo específico'}</span>
                      </span>
                      <span className="ultimas-min">{fmtMin(s.realizadoMin)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Painel>
        </div>
      )}
    </div>
  );
}

function LinhaDisc({ d, ct, min, pr }: { d: Disciplina; ct: ReturnType<typeof contar>; min: number; pr: ReturnType<typeof prioridadeDisciplina> }) {
  const { navegar } = useUi();
  return (
    <tr>
      <td>
        <button className="link link-sutil" onClick={() => navegar(`conteudos?d=${d.id}`)}>{d.nomeCurto}</button>
        <span style={{ marginLeft: 8 }}><NucleoTag n={d.nucleo} /></span>
      </td>
      <td>
        <div className="celula-progresso">
          <b>{fmtPct(ct.pct)}</b>
          <Barra valor={ct.pct} rotulo={`Progresso em ${d.nomeCurto}`} tom={d.nucleo === 'CG' ? 'cg' : 'ce'} />
          <span>{ct.concluidos}/{ct.total}</span>
        </div>
      </td>
      <td className="num">{ct.pendentes}</td>
      <td className="num">{fmtMin(min)}</td>
      <td><PrioridadeTag p={pr.p} propria={pr.propria} /></td>
    </tr>
  );
}
