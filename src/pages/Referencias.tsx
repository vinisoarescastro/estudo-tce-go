import { useState } from 'react';
import type { Topico } from '../domain/types';
import { seed } from '../store/AppStore';
import { Abas, Cabecalho, Icone, LinkEdital, NucleoTag, Painel, Vazio } from '../ui/primitives';
import { useUi } from '../ui/UiContext';
import { concursoDe } from '../domain/concursos';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const POR_PAGINA = 40;
type FiltroRef = '' | 'conferir' | 'sem-trecho' | 'desdobramento';
type Aba = 'conteudos' | 'fontes' | 'textos';

const situacaoRef = (t: Topico) =>
  !t.ref.trecho ? { cls: 'chip-erro', txt: 'Trecho ausente' } : t.ref.confianca !== 'alta' ? { cls: 'chip-aviso', txt: 'Conferir' } : { cls: 'chip-ok', txt: 'Verificada' };

// De onde vem cada informação: a referência de cada conteúdo, o que é oficial e o que é estratégico.
export function Referencias({ params }: { params: URLSearchParams }) {
  const { abrirTopico } = useUi();
  const c = concursoDe(seed);
  const alvo = params.get('t') ? seed.topicos.find((t) => t.id === params.get('t')) : null;
  const [busca, setBusca] = useState(alvo ? String(alvo.numero) : '');
  const [disc, setDisc] = useState(alvo?.disciplinaId ?? '');
  const [filtro, setFiltro] = useState<FiltroRef>('');
  const [pagina, setPagina] = useState(1);
  const [aba, setAba] = useState<Aba>('conteudos');
  const conf = seed.topicos.filter((t) => t.ref.confianca !== 'alta' || !t.ref.trecho);

  const q = norm(busca.trim());
  const lista = seed.topicos.filter((t) => {
    if (disc && t.disciplinaId !== disc) return false;
    if (filtro === 'conferir' && t.ref.confianca === 'alta' && t.ref.trecho) return false;
    if (filtro === 'sem-trecho' && t.ref.trecho) return false;
    if (filtro === 'desdobramento' && !t.desdobramentoPlanilha) return false;
    if (q && !(String(t.numero) === q || norm(`${t.titulo} ${t.ref.trecho ?? ''}`).includes(q))) return false;
    return true;
  });
  const nomeD = (id: string) => seed.disciplinas.find((d) => d.id === id)?.nomeCurto ?? id;

  return (
    <div className="pagina">
      <Cabecalho
        titulo="Referências e fontes"
        subtitulo={`De onde vem cada informação, com a página do edital para conferir.${conf.length ? ` ${conf.length} referência(s) para conferir.` : ''}`}
        info={c.itensNumerados
          ? `A referência de cada conteúdo é o item numerado do ${c.anexoConteudo} que o contém, com a disciplina e a página. O nº vem da planilha Edital Verticalizado.`
          : `O ${c.anexoConteudo} não numera itens nem subitens: a referência de cada conteúdo é o trecho literal do edital, a disciplina e a página. O nº vem da planilha Edital Verticalizado.`}
      />

      <Abas<Aba> rotulo="Referências" ativa={aba} onChange={setAba} abas={[{ id: 'conteudos', rotulo: 'Por conteúdo', contador: seed.topicos.length }, { id: 'fontes', rotulo: 'Fontes e limitações' }, { id: 'textos', rotulo: 'Texto integral' }]} />

      {aba === 'conteudos' && (
        <div className="pilha" id="painel-conteudos" role="tabpanel" aria-labelledby="aba-conteudos">
          <div className="barra-filtros" role="search">
            <div className="campo-icone">
              <Icone nome="busca" tam={16} />
              <input type="search" aria-label="Buscar referências" placeholder="nº, título ou trecho do edital" value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(1); }} />
            </div>
            <select aria-label="Disciplina" value={disc} onChange={(e) => { setDisc(e.target.value); setPagina(1); }}>
              <option value="">Todas as disciplinas</option>
              {seed.disciplinas.map((d) => <option key={d.id} value={d.id}>{d.nomeCurto}</option>)}
            </select>
            <select aria-label="Situação da referência" value={filtro} onChange={(e) => { setFiltro(e.target.value as FiltroRef); setPagina(1); }}>
              <option value="">Qualquer situação</option>
              <option value="conferir">A conferir (parcial ou ausente)</option>
              <option value="sem-trecho">Sem trecho localizado</option>
              <option value="desdobramento">Desdobramentos da planilha</option>
            </select>
          </div>
          <Painel semPadding>
            {lista.length === 0 ? (
              <Vazio icone="busca">Nenhum conteúdo com esses filtros.</Vazio>
            ) : (
              <>
                <div className="tabela-wrap">
                  <table className="tabela">
                    <thead><tr><th className="num">nº</th><th>Conteúdo</th><th>Trecho do edital</th><th>Página</th><th>Situação</th></tr></thead>
                    <tbody>
                      {lista.slice(0, pagina * POR_PAGINA).map((t) => {
                        const st = situacaoRef(t);
                        return (
                          <tr key={t.id} className={alvo?.id === t.id ? 'destacada' : ''}>
                            <td className="num fraco">{t.numero}</td>
                            <td>
                              <button className="link link-sutil" onClick={() => abrirTopico(t.id)}>{t.titulo}</button>
                              <div className="nota">{nomeD(t.disciplinaId)}{t.desdobramentoPlanilha ? ' · desdobramento' : ''}</div>
                            </td>
                            <td className="trecho-celula">{t.ref.trecho ? `“${t.ref.trecho}”` : <span className="fraco">não localizado</span>}</td>
                            <td className="nowrap"><LinkEdital pagina={t.ref.paginas[0]}>p. {t.ref.paginas.join(' e ')}</LinkEdital></td>
                            <td><span className={`chip ${st.cls}`}>{st.txt}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {lista.length > pagina * POR_PAGINA && (
                  <div className="mais-linhas">
                    <button className="btn pq" onClick={() => setPagina((p) => p + 1)}>Mostrar mais</button>
                    <span className="nota">{pagina * POR_PAGINA} de {lista.length}</span>
                  </div>
                )}
              </>
            )}
          </Painel>
        </div>
      )}

      {aba === 'fontes' && (
        <div className="pilha" id="painel-fontes" role="tabpanel" aria-labelledby="aba-fontes">
          <Painel titulo="O que é oficial e o que é estratégico" semPadding>
            <div className="tabela-wrap">
              <table className="tabela">
                <thead><tr><th>Informação</th><th>Fonte</th><th>Natureza</th></tr></thead>
                <tbody>
                  <tr><td>Núcleos, disciplinas e texto dos conteúdos</td><td className="fraco">{c.anexoConteudo} do edital ({c.paginasConteudo})</td><td><span className="chip chip-ok">Oficial</span></td></tr>
                  <tr><td>Número de questões, pesos, notas mínimas e data</td><td className="fraco">{c.refProva}</td><td><span className="chip chip-ok">Oficial</span></td></tr>
                  <tr><td>Divisão do conteúdo nos {seed.topicos.length} itens numerados</td><td className="fraco">{seed.fonte.planilha}</td><td><span className="chip">Planilha</span></td></tr>
                  <tr><td>Prioridade (Urgente, Alta, Média, Baixa) e incidência histórica</td><td className="fraco">Sua planilha</td><td><span className="chip chip-aviso">Estratégico</span></td></tr>
                  <tr><td>Pré-requisitos sugeridos</td><td className="fraco">Sugestão pedagógica desta plataforma</td><td><span className="chip chip-aviso">Estratégico</span></td></tr>
                  <tr><td>Ordem e tempos do ciclo, metas, intervalos de revisão</td><td className="fraco">Plano de estudos e suas configurações</td><td><span className="chip chip-aviso">Estratégico</span></td></tr>
                </tbody>
              </table>
            </div>
          </Painel>
          <Painel titulo="Limitações conhecidas">
            <ul className="lista-limitacoes">
              {c.itensNumerados
                ? <li>Cada conteúdo cita o item inteiro do edital que o contém. Quando a planilha dividiu um item em vários conteúdos, todos citam o mesmo item.</li>
                : <li>O {c.anexoConteudo} não numera itens nem subitens. A referência de cada conteúdo é a disciplina, a página e o trecho literal do edital; o nº vem da sua planilha.</li>}
              {c.limitacoes.map((l) => <li key={l}>{l}</li>)}
              <li>O trecho de cada conteúdo foi localizado automaticamente no texto do edital. {conf.length === 0 ? 'Todos tiveram correspondência alta.' : `${conf.length} item(ns) tiveram correspondência parcial e estão marcados para conferir: ${conf.map((t) => `nº ${t.numero}`).join(', ')}.`}</li>
              {!c.itensNumerados && <li>Itens que a planilha marcou como [Interpretação] são desdobramentos da planilha, não títulos do edital.</li>}
              <li>Não há integração com banco de questões. Os dados ficam no banco da sua instalação; o backup está em Configurações → Dados e backup.</li>
            </ul>
          </Painel>
        </div>
      )}

      {aba === 'textos' && (
        <div className="pilha" id="painel-textos" role="tabpanel" aria-labelledby="aba-textos">
          {seed.nucleos.map((n) => (
            <Painel key={n.id} titulo={<>{n.nome} <NucleoTag n={n.id} /></>} info={n.descricao}>
              <div className="textos">
                {seed.disciplinas.filter((d) => d.nucleo === n.id).map((d) => (
                  <details key={d.id}>
                    <summary><Icone nome="direita" tam={16} /> {d.nome} <span className="nota">p. {d.paginas.join(' e ')}</span></summary>
                    <p className="texto-oficial">{d.textoOficial}</p>
                    <p className="nota" style={{ margin: '0 0 16px 28px' }}><LinkEdital pagina={d.paginas[0]}>Conferir no edital, p. {d.paginas[0]}</LinkEdital></p>
                  </details>
                ))}
              </div>
            </Painel>
          ))}
        </div>
      )}
    </div>
  );
}
