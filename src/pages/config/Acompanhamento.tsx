import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../store/AppStore';
import { api } from '../../api';
import type { DetalheAcompanhamento, ResumoAcompanhamento } from '../../domain/acompanhamento';
import { fmtDia, fmtMin, fmtPct } from '../../domain/util';
import { Barras } from '../../ui/charts';
import { Barra, Cabecalho, Icone, Painel } from '../../ui/primitives';

export type Resumo = ResumoAcompanhamento;

const SITUACAO: Record<NonNullable<Resumo['situacao']>, { texto: string; classe: string }> = {
  ok: { texto: 'No ritmo', classe: 'chip-ok' },
  atras: { texto: 'Atrasado', classe: 'chip-erro' },
  'sem-ritmo': { texto: 'Sem ritmo', classe: 'chip-aviso' },
  'sem-prova': { texto: 'Sem prova', classe: '' },
};

export const ChipSituacao = ({ r }: { r: Resumo }) =>
  r.situacao ? <span className={`chip ${SITUACAO[r.situacao].classe}`}>{SITUACAO[r.situacao].texto}</span> : null;

export function textoUltimo(r: Resumo): string {
  if (!r.ultimoEstudo || r.diasSemEstudar === null) return 'nunca estudou';
  const d = r.diasSemEstudar;
  return d === 0 ? 'hoje' : d === 1 ? 'ontem' : `há ${d} dias`;
}

function Kpi({ rotulo, valor, sub, barra }: { rotulo: string; valor: React.ReactNode; sub?: React.ReactNode; barra?: number }) {
  return (
    <div className="kpi">
      <span className="kpi-k">{rotulo}</span>
      <span className="kpi-v">{valor}</span>
      {sub && <span className="kpi-s">{sub}</span>}
      {barra !== undefined && <Barra valor={barra} rotulo={rotulo} />}
    </div>
  );
}

function frasePrevisao(r: Resumo): string {
  if (r.concluidos === r.totalConteudos) return 'Todo o edital já foi concluído.';
  if (r.diasAteProva === null || r.diasAteProva < 0) return 'Sem data de prova futura definida.';
  const falta = r.totalConteudos - r.concluidos;
  const base = `Faltam ${r.diasAteProva} dias para a prova e ${falta} conteúdos.`;
  if (r.projecaoDias === null) return `${base} Nenhum conteúdo foi concluído nas últimas 4 semanas, então não há projeção.`;
  return `${base} No ritmo atual (${r.ritmoSemanal.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} por semana), concluir levaria cerca de ${r.projecaoDias} dias.`;
}

interface ContaBasica { id: number; email: string; nome: string; papel: 'admin' | 'usuario'; ativo: boolean; cargoId: string; senhaProvisoria: boolean; ultimoAcesso: string | null }

function Alerta({ tom, children }: { tom: 'erro' | 'aviso' | 'ok'; children: React.ReactNode }) {
  return (
    <li style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <span className={`chip chip-${tom}`} style={{ flex: 'none' }}>{tom === 'ok' ? 'Ok' : tom === 'erro' ? 'Atenção' : 'Observe'}</span>
      <span>{children}</span>
    </li>
  );
}

// Página de acompanhamento de uma conta para o administrador. Só números agregados: nada de notas nem texto de sessões.
export function PaginaAcompanhamento({ id }: { id: number }) {
  const { usuario } = useApp();
  const [conta, setConta] = useState<ContaBasica | null>(null);
  const [cargoNome, setCargoNome] = useState('');
  const [dados, setDados] = useState<{ resumo: Resumo | null; detalhe: DetalheAcompanhamento | null } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  const [filtroDisc, setFiltroDisc] = useState('');
  const [soUrgentes, setSoUrgentes] = useState(false);

  const carregar = useCallback(() => {
    setCarregando(true);
    setErro(null);
    Promise.all([
      api<{ usuarios: ContaBasica[]; cargos: { id: string; codigo: string; nome: string }[] }>('/api/admin/usuarios'),
      api<{ resumo: Resumo | null; detalhe: DetalheAcompanhamento | null }>(`/api/admin/acompanhamento/detalhe?id=${id}`),
    ])
      .then(([lista, det]) => {
        const c = lista.usuarios.find((u) => u.id === id) ?? null;
        setConta(c);
        setCargoNome(lista.cargos.find((x) => x.id === c?.cargoId)?.nome ?? '');
        setDados(det);
        setAtualizadoEm(new Date());
      })
      .catch((e: Error) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, [id]);
  useEffect(carregar, [carregar]);

  const nome = conta ? conta.nome || conta.email.split('@')[0] : 'Conta';
  const voltar = (
    <nav aria-label="Navegação estrutural" style={{ marginBottom: 10 }}>
      <a className="btn pq" href="#/config/usuarios"><Icone nome="esquerda" tam={15} /> Voltar para Usuários</a>
    </nav>
  );
  const atualizar = (
    <button className="btn pq" onClick={carregar} disabled={carregando}>{carregando ? 'Atualizando…' : 'Atualizar'}</button>
  );
  const hora = atualizadoEm?.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  if (erro) {
    return (
      <div className="pagina">
        {voltar}
        <Cabecalho sobre="Usuários" titulo="Acompanhamento" />
        <Painel><p className="erro-form" role="alert"><Icone nome="alerta" tam={16} /> {erro} <button className="btn pq" onClick={carregar}>Tentar de novo</button></p></Painel>
      </div>
    );
  }
  if (!dados) {
    return (
      <div className="pagina" aria-busy="true">
        {voltar}
        <Cabecalho sobre="Usuários" titulo="Acompanhamento" subtitulo="Carregando…" />
      </div>
    );
  }
  if (!conta) {
    return (
      <div className="pagina">
        {voltar}
        <Cabecalho sobre="Usuários" titulo="Conta não encontrada" subtitulo="Esta conta não existe mais ou o endereço está incorreto." />
      </div>
    );
  }

  const { resumo: r, detalhe: d } = dados;
  const cabecalho = (
    <Cabecalho
      sobre="Acompanhamento"
      titulo={nome}
      subtitulo={
        <>
          {conta.email} · {cargoNome || conta.cargoId}{' '}
          <span className={`chip ${conta.ativo ? 'chip-ok' : 'chip-erro'}`}>{conta.ativo ? 'Ativa' : 'Desativada'}</span>{' '}
          {conta.papel === 'admin' && <span className="chip">Administrador</span>}{' '}
          {conta.senhaProvisoria && <span className="chip chip-aviso">Senha provisória</span>}
          {conta.id === usuario.id && <> <span className="chip">você</span></>}
        </>
      }
      acoes={<>{hora && <span className="nota" aria-live="polite">Atualizado às {hora}</span>}{atualizar}</>}
    />
  );

  if (!r || !d) {
    return (
      <div className="pagina">
        {voltar}
        {cabecalho}
        <Painel><p className="nota">Esta pessoa ainda não entrou na plataforma, então não há estudos para mostrar. Quando ela começar a estudar, os números aparecem aqui.</p></Painel>
      </div>
    );
  }

  const alertas: { tom: 'erro' | 'aviso' | 'ok'; texto: string }[] = [];
  if (r.diasSemEstudar === null) alertas.push({ tom: 'aviso', texto: 'Ainda não registrou nenhuma sessão de estudo.' });
  else if (r.diasSemEstudar >= 4) alertas.push({ tom: 'erro', texto: `Parada há ${r.diasSemEstudar} dias (último estudo ${textoUltimo(r)}).` });
  if (r.situacao === 'atras') alertas.push({ tom: 'erro', texto: 'No ritmo atual, não conclui o edital antes da prova.' });
  if (r.revisoesAtrasadas > 0) alertas.push({ tom: 'aviso', texto: `${r.revisoesAtrasadas} revisão(ões) atrasada(s).` });
  if (d.negligenciadas.length) alertas.push({ tom: 'aviso', texto: `Abaixo do previsto no ciclo: ${d.negligenciadas.join(', ')}.` });
  if (r.metaSemanalMin && r.minutos7 < r.metaSemanalMin * 0.5 && r.diasSemEstudar !== null) alertas.push({ tom: 'aviso', texto: `Menos da metade da meta semanal nos últimos 7 dias (${fmtMin(r.minutos7)} de ${fmtMin(r.metaSemanalMin)}).` });
  if (!alertas.length) alertas.push({ tom: 'ok', texto: 'Nenhum ponto de atenção no momento.' });

  const pendentes = d.pendentesPrioritarios.filter((p) => (!filtroDisc || p.disciplina === filtroDisc) && (!soUrgentes || p.prioridade === 'Urgente'));
  const discPendentes = [...new Set(d.pendentesPrioritarios.map((p) => p.disciplina))];
  const totalPend = r.prioritarios.total - r.prioritarios.concluidos;

  return (
    <div className="pagina">
      {voltar}
      {cabecalho}

      <Painel titulo="Pontos de atenção">
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
          {alertas.map((a, i) => <Alerta key={i} tom={a.tom}>{a.texto}</Alerta>)}
        </ul>
      </Painel>

      <section className="kpis" aria-label="Resumo">
        <Kpi rotulo="Edital concluído" valor={fmtPct(r.pct)} sub={`${r.concluidos} de ${r.totalConteudos} conteúdos`} barra={r.pct} />
        <Kpi rotulo="Urgentes e altos" valor={fmtPct(r.prioritarios.pct)} sub={`${r.prioritarios.concluidos} de ${r.prioritarios.total} concluídos`} barra={r.prioritarios.pct} />
        <Kpi rotulo="Últimos 7 dias" valor={fmtMin(r.minutos7)} sub={`meta semanal ${fmtMin(r.metaSemanalMin)} · estudou em ${r.diasEstudados7} de 7 dias`} barra={r.metaSemanalMin ? r.minutos7 / r.metaSemanalMin : 0} />
        <Kpi rotulo="Último estudo" valor={textoUltimo(r)} sub={r.ultimoEstudo ? fmtDia(r.ultimoEstudo, { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'sem sessões registradas'} />
      </section>

      <Painel titulo="Previsão para a prova">
        <p style={{ margin: 0 }}><ChipSituacao r={r} /> {frasePrevisao(r)}</p>
        <p className="nota" style={{ marginBottom: 0 }}>Total registrado: {fmtMin(r.minutosTotais)} em {r.sessoes} sessões; {fmtMin(r.minutos30)} nos últimos 30 dias.</p>
      </Painel>

      <Painel titulo="Horas por semana (últimas 8)" info="Cada barra é uma semana (segunda a domingo); a linha de referência é a meta semanal da pessoa.">
        <Barras dados={d.semanas.map((s) => ({ rotulo: fmtDia(s.chave), valor: s.min, ref: s.metaMin }))} legendaRef="Meta semanal" altura={180} />
      </Painel>

      <Painel titulo="Progresso por disciplina" semPadding>
        <div className="tabela-wrap">
          <table className="tabela">
            <caption className="sr-only">Progresso por disciplina</caption>
            <thead><tr><th scope="col">Disciplina</th><th scope="col">Concluído</th><th scope="col">Urgentes/altos pendentes</th><th scope="col">30 dias: estudado × previsto no ciclo</th></tr></thead>
            <tbody>
              {d.porDisciplina.map((x) => (
                <tr key={x.id}>
                  <th scope="row" style={{ fontWeight: 500, textAlign: 'left' }}>{x.nomeCurto}</th>
                  <td style={{ minWidth: 180 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center' }}>
                      <Barra valor={x.pct} tom={x.nucleo === 'CG' ? 'cg' : 'ce'} rotulo={x.nomeCurto} />
                      <span className="nota">{fmtPct(x.pct)} · {x.concluidos}/{x.total}</span>
                    </div>
                  </td>
                  <td>{x.prioritariosPendentes}</td>
                  <td className="nota">{fmtMin(x.minutos30)} × {fmtMin(x.previstoMin30)}{d.negligenciadas.includes(x.nomeCurto) && <> <span className="chip chip-aviso">abaixo do previsto</span></>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Painel>

      <Painel
        titulo={`Urgentes e altos ainda não concluídos (${totalPend})`}
        semPadding
        acoes={d.pendentesPrioritarios.length > 0 && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <label className="sr-only" htmlFor="f-disc">Filtrar por disciplina</label>
            <select id="f-disc" value={filtroDisc} onChange={(e) => setFiltroDisc(e.target.value)}>
              <option value="">Todas as disciplinas</option>
              {discPendentes.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
              <input type="checkbox" checked={soUrgentes} onChange={(e) => setSoUrgentes(e.target.checked)} /> Só urgentes
            </label>
          </div>
        )}
      >
        {d.pendentesPrioritarios.length === 0 ? (
          <p className="nota" style={{ margin: 16 }}>Todos os conteúdos urgentes e altos foram concluídos.</p>
        ) : pendentes.length === 0 ? (
          <p className="nota" style={{ margin: 16 }}>Nenhum conteúdo com esses filtros.</p>
        ) : (
          <>
            <div className="tabela-wrap">
              <table className="tabela">
                <caption className="sr-only">Conteúdos urgentes e altos pendentes</caption>
                <thead><tr><th scope="col">Conteúdo</th><th scope="col">Disciplina</th><th scope="col">Prioridade</th><th scope="col">Situação</th></tr></thead>
                <tbody>
                  {pendentes.map((p) => (
                    <tr key={p.id}>
                      <td>{p.titulo}</td>
                      <td className="nota">{p.disciplina}</td>
                      <td>{p.prioridade}</td>
                      <td className="nota">{p.status === 'em_andamento' ? 'Em andamento' : 'Não iniciado'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPend > d.pendentesPrioritarios.length && <p className="nota" style={{ margin: 16 }}>Mostrando os {d.pendentesPrioritarios.length} primeiros de {totalPend}.</p>}
          </>
        )}
      </Painel>
    </div>
  );
}
