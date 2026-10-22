import { useState } from 'react';
import { useApp, seed } from '../store/AppStore';
import { filtrarSessoes, somaMin, somaPlanejado } from '../domain/stats';
import { fmtDia, fmtMin, fmtPct } from '../domain/util';
import { Abas, Cabecalho, Icone, MenuAcoes, Painel, Vazio } from '../ui/primitives';
import { Filtros, FILTRO_INICIAL, paraFiltro, type EstadoFiltro } from '../ui/Filtros';
import { useUi } from '../ui/UiContext';

const POR_PAGINA = 50;
type Aba = 'sessoes' | 'alteracoes';

// Histórico: todas as sessões registradas (cronômetro ou manual), com correção e exclusão,
// e o registro automático de alterações.
export function Historico() {
  const { dados, despachar } = useApp();
  const { abrirSessao, abrirTopico, confirmar } = useUi();
  const u = dados.user;
  const [filtro, setFiltro] = useState<EstadoFiltro>({ ...FILTRO_INICIAL, periodo: 'tudo' });
  const [pagina, setPagina] = useState(1);
  const [aba, setAba] = useState<Aba>('sessoes');
  const [busca, setBusca] = useState('');

  const primeiro = u.sessoes.length ? u.sessoes.reduce((a, s) => (s.data < a ? s.data : a), u.sessoes[0].data) : null;
  const f = paraFiltro(filtro, primeiro);
  const ss = filtrarSessoes(u.sessoes, seed.disciplinas, f).sort((a, b) => b.data.localeCompare(a.data) || b.criadoEm.localeCompare(a.criadoEm));
  const tot = somaMin(ss);
  const plan = somaPlanejado(ss);
  const nomeD = (id: string) => seed.disciplinas.find((d) => d.id === id)?.nomeCurto ?? id;
  const top = (id: string) => seed.topicos.find((t) => t.id === id);
  const q = busca.trim().toLowerCase();
  const eventos = q ? u.historico.filter((e) => e.descricao.toLowerCase().includes(q) || e.tipo.includes(q)) : u.historico;

  return (
    <div className="pagina">
      <Cabecalho
        titulo="Histórico"
        subtitulo="Todo o tempo registrado, pelo cronômetro ou à mão."
        info="Corrigir ou excluir uma sessão recalcula na hora os totais e todos os indicadores. A situação dos conteúdos não muda."
        acoes={<button className="btn primario" onClick={() => abrirSessao()}><Icone nome="mais" tam={16} /> Registrar sessão</button>}
      />

      <Abas<Aba> rotulo="Registros" ativa={aba} onChange={setAba} abas={[{ id: 'sessoes', rotulo: 'Sessões', contador: u.sessoes.length }, { id: 'alteracoes', rotulo: 'Alterações', contador: u.historico.length }]} />

      {aba === 'sessoes' ? (
        <div className="pilha" id="painel-sessoes" role="tabpanel" aria-labelledby="aba-sessoes">
          <Filtros valor={filtro} onChange={(x) => { setFiltro(x); setPagina(1); }} prefixo="hs" />
          <div className="resumo-linha" aria-live="polite">
            <span>Sessões<b>{ss.length}</b></span>
            <span>Estudado<b>{fmtMin(tot)}</b></span>
            <span>Planejado<b>{fmtMin(plan)}</b></span>
            <span>Realizado x planejado<b>{plan ? fmtPct(tot / plan) : '—'}</b></span>
          </div>
          <Painel semPadding>
            {ss.length === 0 ? (
              <Vazio icone="sessoes" titulo="Nenhuma sessão no período" acao={<button className="btn" onClick={() => abrirSessao()}>Registrar sessão</button>}>
                Use “Estudar agora” no Início ou no Ciclo, ou registre uma sessão à mão.
              </Vazio>
            ) : (
              <>
                <div className="tabela-wrap">
                  <table className="tabela">
                    <thead>
                      <tr><th>Data</th><th>Disciplina</th><th>Conteúdo</th><th className="num">Estudado</th><th className="num">Planejado</th><th>Origem</th><th><span className="sr">Ações</span></th></tr>
                    </thead>
                    <tbody>
                      {ss.slice(0, pagina * POR_PAGINA).map((s) => {
                        const t = s.topicoId ? top(s.topicoId) : null;
                        return (
                          <tr key={s.id}>
                            <td className="nowrap fraco num">{fmtDia(s.data, { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                            <td className="forte nowrap">{nomeD(s.disciplinaId)}</td>
                            <td>
                              {t ? <button className="link link-sutil" onClick={() => abrirTopico(t.id)}><span className="num-item">nº {t.numero}</span>{t.titulo}</button> : <span className="fraco">—</span>}
                              {s.notas && <div className="nota" title={s.notas} style={{ maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.notas}</div>}
                            </td>
                            <td className="num forte">{fmtMin(s.realizadoMin)}</td>
                            <td className="num fraco">{fmtMin(s.planejadoMin)}</td>
                            <td className="nowrap fraco">{s.origem === 'cronometro' ? 'Cronômetro' : 'Manual'}{s.cicloItemId ? ' · ciclo' : ''}</td>
                            <td className="acoes-celula">
                              <MenuAcoes
                                rotulo={`Ações da sessão de ${nomeD(s.disciplinaId)} em ${fmtDia(s.data)}`}
                                itens={[
                                  { rotulo: 'Corrigir', icone: 'editar', onClick: () => abrirSessao(s) },
                                  {
                                    rotulo: 'Excluir', icone: 'lixeira', perigo: true,
                                    onClick: async () => {
                                      if (await confirmar('Excluir sessão?', `${fmtDia(s.data)} · ${nomeD(s.disciplinaId)} · ${fmtMin(s.realizadoMin)}. Os totais serão recalculados. A situação dos conteúdos não muda.`, 'Excluir')) despachar({ t: 'sessaoExcluir', id: s.id }, 'Sessão excluída. Totais recalculados.');
                                    },
                                  },
                                ]}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {ss.length > pagina * POR_PAGINA && (
                  <div className="mais-linhas">
                    <button className="btn pq" onClick={() => setPagina((p) => p + 1)}>Mostrar mais</button>
                    <span className="nota">{pagina * POR_PAGINA} de {ss.length}</span>
                  </div>
                )}
              </>
            )}
          </Painel>
        </div>
      ) : (
        <div className="pilha" id="painel-alteracoes" role="tabpanel" aria-labelledby="aba-alteracoes">
          <div className="barra-filtros">
            <div className="campo-icone">
              <Icone nome="busca" tam={16} />
              <input type="search" aria-label="Filtrar alterações" placeholder="Filtrar alterações" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
          </div>
          <Painel info="Registro automático de mudanças de situação, prioridade, ciclo, sessões, dependências e configurações.">
            {eventos.length === 0 ? (
              <Vazio icone="historico">Nenhuma alteração encontrada.</Vazio>
            ) : (
              <ul className="lista eventos">
                {eventos.slice(0, 300).map((e) => (
                  <li key={e.id}>
                    <span className="eventos-data">{new Date(e.ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="eventos-tipo"><span className="chip">{e.tipo.replace('_', ' ')}</span></span>
                    <span>{e.descricao}</span>
                  </li>
                ))}
              </ul>
            )}
            {eventos.length > 300 && <p className="nota" style={{ marginTop: 14 }}>Mostrando os 300 mais recentes de {eventos.length}. Use o filtro para encontrar eventos antigos.</p>}
          </Painel>
        </div>
      )}
    </div>
  );
}
