import { useState } from 'react';
import type { Prioridade, TipoDependencia } from '../../domain/types';
import { PRIORIDADES } from '../../domain/types';
import { useApp, seed } from '../../store/AppStore';
import { estadoDe, isConcluido } from '../../domain/progress';
import { Cabecalho, Icone, NucleoTag, Painel, Vazio } from '../../ui/primitives';
import { useUi } from '../../ui/UiContext';

// Preferências de estudo: quais disciplinas participam do ciclo, a prioridade de cada uma
// e os pré-requisitos entre conteúdos.
export function ConfigEstudo() {
  const { dados, despachar, avisar } = useApp();
  const { confirmar, abrirTopico } = useUi();
  const u = dados.user;
  const [buscaDep, setBuscaDep] = useState('');
  const [nova, setNova] = useState<{ de: string; para: string; tipo: TipoDependencia }>({ de: '', para: '', tipo: 'recomendado' });

  const byId = new Map(seed.topicos.map((t) => [t.id, t]));
  const q = buscaDep.trim().toLowerCase();
  const deps = u.dependencias.filter((d) => {
    if (!q) return true;
    const a = byId.get(d.de)!, b = byId.get(d.para)!;
    return `${a.numero} ${a.titulo} ${b.numero} ${b.titulo}`.toLowerCase().includes(q);
  });

  // Uma disciplina participa do ciclo se tiver ao menos uma sessão ativa.
  const participa = (id: string) => u.ciclo.itens.some((i) => i.disciplinaId === id && i.ativo);
  const alternarDisc = (id: string, ativo: boolean) => {
    const itens = u.ciclo.itens.filter((i) => i.disciplinaId === id);
    if (!itens.length && ativo) {
      despachar({ t: 'cicloAdicionar', disciplinaId: id, minutos: u.config.duracaoPadraoMin }, 'Disciplina adicionada ao ciclo.');
      return;
    }
    for (const i of itens) despachar({ t: 'cicloAtivo', itemId: i.id, ativo });
    avisar('ok', ativo ? 'Disciplina volta a participar do ciclo.' : 'Disciplina fora do ciclo. Histórico e progresso mantidos.');
  };

  const opcoesTopicos = seed.disciplinas.map((d) => (
    <optgroup key={d.id} label={d.nomeCurto}>
      {seed.topicos.filter((t) => t.disciplinaId === d.id).map((t) => <option key={t.id} value={t.id}>{t.numero} · {t.titulo}</option>)}
    </optgroup>
  ));

  return (
    <div className="pagina">
      <Cabecalho sobre="Configurações" titulo="Preferências de estudo" subtitulo="Disciplinas do ciclo, prioridades e pré-requisitos entre conteúdos." />

      <Painel
        titulo="Disciplinas"
        semPadding
        info="As 14 disciplinas do Anexo II para o B02. Tirar uma disciplina do ciclo desativa as sessões dela, sem apagar progresso nem histórico. A prioridade da disciplina é estratégica (não oficial) e entra na distribuição sugerida de tempo. A prioridade de cada conteúdo é ajustada na ficha do conteúdo."
      >
        <div className="tabela-wrap">
          <table className="tabela">
            <thead><tr><th>Disciplina</th><th>No ciclo</th><th>Prioridade</th></tr></thead>
            <tbody>
              {seed.disciplinas.map((d) => (
                <tr key={d.id}>
                  <td><span className="forte">{d.nome}</span> <NucleoTag n={d.nucleo} /></td>
                  <td>
                    <label className="interruptor">
                      <input type="checkbox" checked={participa(d.id)} onChange={(e) => alternarDisc(d.id, e.target.checked)} aria-label={`${d.nomeCurto} participa do ciclo`} />
                      <span>{participa(d.id) ? 'Participa' : 'Fora'}</span>
                    </label>
                  </td>
                  <td>
                    <select aria-label={`Prioridade de ${d.nomeCurto}`} value={u.prioridadeDisciplina[d.id] ?? ''} onChange={(e) => despachar({ t: 'prioridadeDisciplina', disciplinaId: d.id, valor: (e.target.value || null) as Prioridade | null }, 'Prioridade salva.')}>
                      <option value="">Automática</option>
                      {PRIORIDADES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Painel>

      <Painel
        titulo={<>Pré-requisitos <span className="contador">{u.dependencias.length}</span></>}
        info={`As ${seed.dependenciasSugeridas.length} dependências iniciais são sugestões pedagógicas, não constam do edital. Obrigatório: a recomendação manda estudar a base antes. Recomendado: só avisa.`}
        acoes={<button className="btn fantasma pq" onClick={async () => { if (await confirmar('Restaurar sugestões?', 'As dependências sugeridas voltam ao estado original (inclusive as que você removeu ou mudou de tipo). As que você criou são mantidas.', 'Restaurar')) despachar({ t: 'depRestaurar' }, 'Sugestões restauradas.'); }}><Icone nome="revisao" tam={14} /> Restaurar sugestões</button>}
      >
        <div className="pilha">
          <form className="form-linha" onSubmit={(e) => { e.preventDefault(); if (despachar({ t: 'depAdicionar', ...nova }, 'Pré-requisito adicionado.')) setNova({ ...nova, de: '', para: '' }); }}>
            <div className="campo">
              <label htmlFor="dp-de">Estudar antes</label>
              <select id="dp-de" value={nova.de} onChange={(e) => setNova({ ...nova, de: e.target.value })}><option value="">Escolha…</option>{opcoesTopicos}</select>
            </div>
            <div className="campo">
              <label htmlFor="dp-para">Para poder estudar</label>
              <select id="dp-para" value={nova.para} onChange={(e) => setNova({ ...nova, para: e.target.value })}><option value="">Escolha…</option>{opcoesTopicos}</select>
            </div>
            <div className="campo" style={{ flex: '0 1 160px' }}>
              <label htmlFor="dp-tipo">Tipo</label>
              <select id="dp-tipo" value={nova.tipo} onChange={(e) => setNova({ ...nova, tipo: e.target.value as TipoDependencia })}>
                <option value="recomendado">Recomendado</option>
                <option value="obrigatorio">Obrigatório</option>
              </select>
            </div>
            <button className="btn" type="submit" disabled={!nova.de || !nova.para}><Icone nome="mais" tam={15} /> Adicionar</button>
          </form>
          <div className="campo-icone">
            <Icone nome="busca" tam={16} />
            <input type="search" aria-label="Filtrar pré-requisitos" value={buscaDep} onChange={(e) => setBuscaDep(e.target.value)} placeholder="Filtrar por nº ou título" />
          </div>
          {deps.length === 0 ? (
            <Vazio icone="busca">Nenhuma dependência.</Vazio>
          ) : (
            <div className="tabela-wrap tabela-rolagem" style={{ border: '1px solid var(--linha)', borderRadius: 'var(--r)' }}>
              <table className="tabela">
                <thead><tr><th>Estudar antes</th><th>Para poder estudar</th><th>Tipo</th><th><span className="sr">Remover</span></th></tr></thead>
                <tbody>
                  {deps.map((d) => {
                    const a = byId.get(d.de)!, b = byId.get(d.para)!;
                    const ok = isConcluido(estadoDe(u, a.id).status);
                    return (
                      <tr key={d.id}>
                        <td>
                          <button className="link link-sutil" onClick={() => abrirTopico(a.id)}><span className="num-item">nº {a.numero}</span>{a.titulo}</button>
                          {ok && <span className="chip chip-ok" style={{ marginLeft: 6 }}>concluído</span>}
                        </td>
                        <td>
                          <button className="link link-sutil" onClick={() => abrirTopico(b.id)}><span className="num-item">nº {b.numero}</span>{b.titulo}</button>
                          {d.origem === 'usuario' && <span className="chip" style={{ marginLeft: 6 }}>sua</span>}
                        </td>
                        <td>
                          <select aria-label={`Tipo do pré-requisito nº ${a.numero} para nº ${b.numero}`} value={d.tipo} onChange={(e) => despachar({ t: 'depTipo', id: d.id, tipo: e.target.value as TipoDependencia })} style={{ height: 32 }}>
                            <option value="recomendado">Recomendado</option>
                            <option value="obrigatorio">Obrigatório</option>
                          </select>
                        </td>
                        <td className="acoes-celula">
                          <button className="btn-icone perigo" aria-label={`Remover pré-requisito nº ${a.numero} para nº ${b.numero}`} title="Remover" onClick={async () => { if (await confirmar('Remover pré-requisito?', `nº ${a.numero} deixa de ser pré-requisito de nº ${b.numero}.`, 'Remover')) despachar({ t: 'depRemover', id: d.id }, 'Pré-requisito removido.'); }}><Icone nome="lixeira" tam={15} /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Painel>
    </div>
  );
}
