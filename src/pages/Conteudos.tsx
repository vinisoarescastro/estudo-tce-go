import { useMemo, useState } from 'react';
import type { Prioridade, Status, Topico } from '../domain/types';
import { PRIORIDADES, STATUS, STATUS_LABEL } from '../domain/types';
import { useApp, seed } from '../store/AppStore';
import { contar, estadoDe } from '../domain/progress';
import { prioridadeTopico } from '../domain/cycle';
import { pendentes, prereqsDe } from '../domain/deps';
import { porTopico } from '../domain/stats';
import { fmtMin, fmtPct, isoDia } from '../domain/util';
import { proximaRevisao } from '../domain/revisions';
import { Barra, Cabecalho, Icone, LinkEdital, PrioridadeTag, Vazio } from '../ui/primitives';
import { useUi } from '../ui/UiContext';

// Remove acentos para a busca.
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
type Extra = '' | 'bloqueados' | 'dominados' | 'semsessao' | 'notas' | 'revisao';

export function Conteudos({ params }: { params: URLSearchParams }) {
  const { dados, despachar } = useApp();
  const { abrirTopico } = useUi();
  const u = dados.user;
  const [busca, setBusca] = useState('');
  const [nucleo, setNucleo] = useState('');
  const [disc, setDisc] = useState(params.get('d') ?? '');
  const [status, setStatus] = useState<Status | ''>('');
  const [prio, setPrio] = useState<Prioridade | ''>('');
  const [extra, setExtra] = useState<Extra>('');
  const [maisFiltros, setMaisFiltros] = useState(false);
  const [abertas, setAbertas] = useState<Set<string>>(() => new Set(params.get('d') ? [params.get('d')!] : []));

  const minPorTopico = useMemo(() => porTopico(u.sessoes), [u.sessoes]);
  const nSessoes = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of u.sessoes) if (s.topicoId) m[s.topicoId] = (m[s.topicoId] ?? 0) + 1;
    return m;
  }, [u.sessoes]);

  const hoje = isoDia();
  const q = norm(busca.trim());
  const passa = (t: Topico) => {
    const e = estadoDe(u, t.id);
    if (status && e.status !== status) return false;
    if (prio && prioridadeTopico(t, u) !== prio) return false;
    if (extra === 'bloqueados' && !pendentes(u.dependencias, u, t.id, 'obrigatorio').length) return false;
    if (extra === 'dominados' && !e.dominado) return false;
    if (extra === 'semsessao' && nSessoes[t.id]) return false;
    if (extra === 'notas' && !e.notas) return false;
    if (extra === 'revisao') {
      const v = proximaRevisao(e, u.config);
      if (!v || v > hoje) return false;
    }
    if (q && !norm(`${t.numero} ${t.titulo} ${t.ref.trecho ?? ''} ${e.notas}`).includes(q)) return false;
    return true;
  };
  const filtrando = !!(q || status || prio || extra);
  const total = seed.topicos.filter((t) => passa(t) && (!disc || t.disciplinaId === disc) && (!nucleo || seed.disciplinas.find((d) => d.id === t.disciplinaId)?.nucleo === nucleo)).length;
  const temFiltro = filtrando || !!nucleo || !!disc;
  const nExtras = (prio ? 1 : 0) + (extra ? 1 : 0);

  const alternar = (id: string) =>
    setAbertas((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const limpar = () => { setBusca(''); setNucleo(''); setDisc(''); setStatus(''); setPrio(''); setExtra(''); };

  return (
    <div className="pagina">
      <Cabecalho
        titulo="Conteúdos do edital"
        subtitulo="Os 253 itens do edital, por núcleo e disciplina. Clique em um conteúdo para abrir a ficha."
        info={
          <>
            <p>Cada item é uma linha da sua planilha Edital Verticalizado, ligada ao trecho literal do Anexo II do edital.</p>
            <p>O edital não tem nível de subtópicos, então a lista não inventa um. Quando a planilha desdobrou um trecho em vários itens, o item é marcado como “desdobramento”.</p>
          </>
        }
      />

      <div className="pilha" style={{ gap: 0 }}>
        <div className="barra-filtros" role="search">
          <div className="campo-icone">
            <Icone nome="busca" tam={16} />
            <input type="search" aria-label="Buscar conteúdos" placeholder="Buscar por título, nº, trecho do edital ou observação" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <select aria-label="Núcleo" value={nucleo} onChange={(e) => { setNucleo(e.target.value); setDisc(''); }}>
            <option value="">Todos os núcleos</option>
            {seed.nucleos.map((n) => <option key={n.id} value={n.id}>{n.id === 'CG' ? 'Conhecimentos Gerais' : 'Conhecimentos Específicos'}</option>)}
          </select>
          <select aria-label="Disciplina" value={disc} onChange={(e) => { setDisc(e.target.value); if (e.target.value) setAbertas(new Set([e.target.value])); }}>
            <option value="">Todas as disciplinas</option>
            {seed.disciplinas.filter((d) => !nucleo || d.nucleo === nucleo).map((d) => <option key={d.id} value={d.id}>{d.nomeCurto}</option>)}
          </select>
          <select aria-label="Situação" value={status} onChange={(e) => setStatus(e.target.value as Status | '')}>
            <option value="">Qualquer situação</option>
            {STATUS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
          <button className={`btn ${maisFiltros || nExtras ? 'on' : ''}`} aria-expanded={maisFiltros} aria-controls="filtros-extra" onClick={() => setMaisFiltros((m) => !m)}>
            <Icone nome="filtro" tam={15} /> Mais filtros{nExtras ? <span className="contador">{nExtras}</span> : null}
          </button>
        </div>
        {(maisFiltros || nExtras > 0) && (
          <div className="filtros-extra" id="filtros-extra">
            <select aria-label="Prioridade" value={prio} onChange={(e) => setPrio(e.target.value as Prioridade | '')}>
              <option value="">Qualquer prioridade</option>
              {PRIORIDADES.map((p) => <option key={p} value={p}>Prioridade {p}</option>)}
            </select>
            <select aria-label="Outros filtros" value={extra} onChange={(e) => setExtra(e.target.value as Extra)}>
              <option value="">Sem filtro adicional</option>
              <option value="bloqueados">Com pré-requisito obrigatório pendente</option>
              <option value="revisao">Com revisão vencida</option>
              <option value="dominados">Dominados</option>
              <option value="semsessao">Sem nenhuma sessão</option>
              <option value="notas">Com observações</option>
            </select>
          </div>
        )}
      </div>

      <div className="resumo-filtro" aria-live="polite">
        <span>{total} conteúdo(s)</span>
        {temFiltro && <button className="btn fantasma pq" onClick={limpar}><Icone nome="x" tam={14} /> Limpar filtros</button>}
      </div>

      {seed.nucleos.filter((n) => !nucleo || n.id === nucleo).map((n) => {
        const discs = seed.disciplinas.filter((d) => d.nucleo === n.id && (!disc || d.id === disc));
        if (!discs.length) return null;
        const blocos = discs.map((d) => {
          const tops = seed.topicos.filter((t) => t.disciplinaId === d.id);
          const vis = tops.filter(passa);
          if (filtrando && !vis.length) return null;
          const ct = contar(tops, u);
          const aberta = abertas.has(d.id) || (filtrando && vis.length > 0);
          const min = tops.reduce((a, t) => a + (minPorTopico[t.id] ?? 0), 0);
          return (
            <div key={d.id} className="disc">
              <button className="disc-cab" aria-expanded={aberta} onClick={() => alternar(d.id)}>
                <Icone nome="direita" tam={16} />
                <span className="disc-nome">{d.nome}</span>
                <Barra valor={ct.pct} rotulo={`Progresso em ${d.nomeCurto}`} tom={n.id === 'CG' ? 'cg' : 'ce'} />
                <span className="disc-pct">{fmtPct(ct.pct)} <span className="nota">{ct.concluidos}/{ct.total}</span></span>
                <span className="disc-h">{fmtMin(min)}</span>
              </button>
              {aberta && (
                <>
                  <div className="disc-fonte">Anexo II · <LinkEdital pagina={d.paginas[0]}>p. {d.paginas.join(' e ')}</LinkEdital></div>
                  <ul className="topicos">
                    {vis.map((t) => (
                      <LinhaTopico key={t.id} t={t} min={minPorTopico[t.id] ?? 0} n={nSessoes[t.id] ?? 0} onAbrir={() => abrirTopico(t.id)} onStatus={(s) => despachar({ t: 'status', topicoId: t.id, status: s })} />
                    ))}
                    {!vis.length && <li><Vazio icone="busca">Nenhum conteúdo com esses filtros.</Vazio></li>}
                  </ul>
                </>
              )}
            </div>
          );
        }).filter(Boolean);
        if (!blocos.length) return null;
        return (
          <section key={n.id} className="nucleo-bloco">
            <div className="nucleo-cab">
              <h2>{n.nome}</h2>
              <span className="nota">{n.apelido} · <LinkEdital pagina={n.pagina}>Anexo II, p. {n.pagina}</LinkEdital></span>
            </div>
            {blocos}
          </section>
        );
      })}
      {total === 0 && <Vazio icone="busca" titulo="Nenhum conteúdo encontrado" acao={<button className="btn" onClick={limpar}>Limpar filtros</button>}>Tente outros termos ou filtros.</Vazio>}
    </div>
  );
}

function LinhaTopico({ t, min, n, onAbrir, onStatus }: { t: Topico; min: number; n: number; onAbrir: () => void; onStatus: (s: Status) => void }) {
  const { dados } = useApp();
  const u = dados.user;
  const e = estadoDe(u, t.id);
  const p = prioridadeTopico(t, u);
  const bloq = pendentes(u.dependencias, u, t.id, 'obrigatorio');
  const nPre = prereqsDe(u.dependencias, t.id).length;
  const alerta = bloq.length > 0 && (p === 'Urgente' || p === 'Alta');
  return (
    <li className="topico">
      <button className="topico-main" onClick={onAbrir} aria-label={`Abrir nº ${t.numero} ${t.titulo}`}>
        <span className="topico-n">{t.numero}</span>
        <span className="topico-t">
          <span className="topico-titulo">{t.titulo}</span>
          <span className="topico-meta">
            <PrioridadeTag p={p} propria={!!e.prioridade} />
            {e.dominado && <span className="chip chip-ok">Dominado</span>}
            {bloq.length > 0 && <span className="chip chip-erro" title="Há pré-requisito obrigatório ainda não estudado"><Icone nome="alerta" tam={12} /> {bloq.length} pré-requisito(s) pendente(s)</span>}
            {!bloq.length && nPre > 0 && <span title="Pré-requisitos concluídos"><Icone nome="check" tam={12} /> {nPre} pré-requisito(s)</span>}
            {n > 0 && <span><Icone nome="sessoes" tam={12} /> {fmtMin(min)}</span>}
            {e.notas && <span title={e.notas}><Icone nome="nota" tam={12} /> nota</span>}
            {t.desdobramentoPlanilha && <span title="A planilha desdobrou um trecho do edital neste item">desdobramento</span>}
            {t.ref.confianca !== 'alta' && <span className="chip chip-aviso" title="A correspondência com o trecho do edital é parcial">confira a referência</span>}
            {alerta && <span className="sr">Atenção: conteúdo de prioridade alta depende de conteúdo não estudado.</span>}
          </span>
        </span>
      </button>
      <div className={`status-sel st-${e.status}`}>
        <i aria-hidden="true" />
        <select value={e.status} aria-label={`Situação de nº ${t.numero}`} onChange={(ev) => onStatus(ev.target.value as Status)}>
          {STATUS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
      </div>
    </li>
  );
}
