import type { Recomendacao } from '../domain/recommend';
import { proximoItem, prioridadeTopico } from '../domain/cycle';
import { estadoDe } from '../domain/progress';
import { useApp } from '../store/AppStore';
import { Icone, Info, PrioridadeTag, StatusPill, Vazio } from './primitives';
import { useUi } from './UiContext';

const TITULO: Record<Recomendacao['tipo'], string> = {
  ciclo: 'Próximo do ciclo',
  prerequisito: 'Base antes do próximo',
  revisao: 'Revisão',
  equilibrio: 'Equilíbrio do ciclo',
};

export function ListaRecomendacoes({ itens }: { itens: Recomendacao[] }) {
  const { dados, despachar } = useApp();
  const { abrirTopico, iniciarEstudo } = useUi();
  const u = dados.user;
  const prox = proximoItem(u.ciclo);
  if (!itens.length) return <Vazio icone="check" titulo="Nada pendente">Todos os conteúdos das disciplinas ativas estão concluídos ou o ciclo está vazio.</Vazio>;
  return (
    <ol className="recs">
      {itens.map((r, i) => {
        const e = estadoDe(u, r.topico.id);
        // Só a recomendação do ciclo (ou a base dela) avança o ciclo ao ser estudada.
        const doCiclo = i === 0 && prox && prox.disciplinaId === r.disciplina.id && r.tipo !== 'revisao' && r.tipo !== 'equilibrio';
        return (
          <li key={r.topico.id} className={`rec rec-${r.tipo}`}>
            <div className="rec-corpo">
              <span className="rec-tipo"><i aria-hidden="true" />{TITULO[r.tipo]}</span>
              <button className="rec-titulo" onClick={() => abrirTopico(r.topico.id)}>
                <span className="num-item">nº {r.topico.numero}</span>{r.topico.titulo}
              </button>
              <div className="rec-meta">
                <span>{r.disciplina.nomeCurto}</span>
                <PrioridadeTag p={prioridadeTopico(r.topico, u)} propria={!!e.prioridade} />
                <StatusPill s={e.status} />
                <Info rotulo="Por que esta recomendação">
                  <ul className="lista-limitacoes">{r.motivos.map((m) => <li key={m}>{m}</li>)}</ul>
                </Info>
              </div>
            </div>
            {r.tipo === 'revisao' ? (
              <button className="btn pq" onClick={() => despachar({ t: 'revisao', topicoId: r.topico.id }, 'Revisão registrada.')}><Icone nome="check" tam={14} /> Revisão feita</button>
            ) : (
              <button
                className={`btn pq ${i === 0 ? 'primario' : ''}`}
                disabled={!!u.timer}
                title={u.timer ? 'Já há uma sessão em andamento' : undefined}
                onClick={() => iniciarEstudo({ disciplinaId: r.disciplina.id, topicoId: r.topico.id, cicloItemId: doCiclo ? prox!.id : null, planejadoMin: doCiclo ? prox!.minutos : u.config.duracaoPadraoMin })}
              >
                <Icone nome="play" tam={12} /> Estudar
              </button>
            )}
          </li>
        );
      })}
    </ol>
  );
}
