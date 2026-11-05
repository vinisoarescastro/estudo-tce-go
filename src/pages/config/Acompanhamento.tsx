import { useEffect, useState } from 'react';
import { api } from '../../api';
import type { DetalheAcompanhamento, ResumoAcompanhamento } from '../../domain/acompanhamento';
import { fmtDia, fmtMin, fmtPct } from '../../domain/util';
import { Barras } from '../../ui/charts';
import { Barra, Icone, Painel } from '../../ui/primitives';

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

// Detalhe de uma conta para o administrador. Só números agregados: nada de notas nem texto de sessões.
export function DetalhePessoa({ id, nome, aoFechar }: { id: number; nome: string; aoFechar: () => void }) {
  const [dados, setDados] = useState<{ resumo: Resumo | null; detalhe: DetalheAcompanhamento | null } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setDados(null);
    setErro(null);
    api<{ resumo: Resumo | null; detalhe: DetalheAcompanhamento | null }>(`/api/admin/acompanhamento/detalhe?id=${id}`)
      .then(setDados)
      .catch((e: Error) => setErro(e.message));
  }, [id]);

  const fechar = <button className="btn pq" onClick={aoFechar}>Fechar</button>;
  if (erro) return <Painel titulo={`Acompanhamento · ${nome}`} acoes={fechar}><p className="erro-form" role="alert"><Icone nome="alerta" tam={16} /> {erro}</p></Painel>;
  if (!dados) return <Painel titulo={`Acompanhamento · ${nome}`} acoes={fechar}><p className="nota">Carregando…</p></Painel>;
  const { resumo: r, detalhe: d } = dados;
  if (!r || !d) return <Painel titulo={`Acompanhamento · ${nome}`} acoes={fechar}><p className="nota">Esta pessoa ainda não entrou na plataforma, então não há estudos para mostrar.</p></Painel>;

  return (
    <>
      <Painel titulo={`Acompanhamento · ${nome}`} acoes={fechar}>
        <section className="kpis" aria-label="Resumo">
          <Kpi rotulo="Edital concluído" valor={fmtPct(r.pct)} sub={`${r.concluidos} de ${r.totalConteudos} conteúdos`} barra={r.pct} />
          <Kpi rotulo="Urgentes e altos" valor={fmtPct(r.prioritarios.pct)} sub={`${r.prioritarios.concluidos} de ${r.prioritarios.total} concluídos`} barra={r.prioritarios.pct} />
          <Kpi rotulo="Últimos 7 dias" valor={fmtMin(r.minutos7)} sub={`meta semanal ${fmtMin(r.metaSemanalMin)} · estudou em ${r.diasEstudados7} de 7 dias`} barra={r.metaSemanalMin ? r.minutos7 / r.metaSemanalMin : 0} />
          <Kpi rotulo="Último estudo" valor={textoUltimo(r)} sub={r.ultimoEstudo ? fmtDia(r.ultimoEstudo, { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'sem sessões registradas'} />
        </section>
        <p className="nota" style={{ marginTop: 14 }}>
          <ChipSituacao r={r} /> {frasePrevisao(r)} {r.revisoesAtrasadas > 0 ? `Há ${r.revisoesAtrasadas} revisão(ões) atrasada(s).` : 'Nenhuma revisão atrasada.'} Total registrado: {fmtMin(r.minutosTotais)} em {r.sessoes} sessões; {fmtMin(r.minutos30)} nos últimos 30 dias.
        </p>
      </Painel>

      <Painel titulo="Horas por semana (últimas 8)" info="Cada barra é uma semana (segunda a domingo); a linha de referência é a meta semanal da pessoa.">
        <Barras dados={d.semanas.map((s) => ({ rotulo: fmtDia(s.chave), valor: s.min, ref: s.metaMin }))} legendaRef="Meta semanal" altura={180} />
      </Painel>

      <Painel titulo="Progresso por disciplina" semPadding>
        <div className="tabela-wrap">
          <table className="tabela">
            <thead><tr><th>Disciplina</th><th>Concluído</th><th>Urgentes/altos pendentes</th><th>30 dias: estudado × previsto no ciclo</th></tr></thead>
            <tbody>
              {d.porDisciplina.map((x) => (
                <tr key={x.id}>
                  <td>{x.nomeCurto}</td>
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

      <Painel titulo={`Urgentes e altos ainda não concluídos (${d.pendentesPrioritarios.length}${r.prioritarios.total - r.prioritarios.concluidos > d.pendentesPrioritarios.length ? '+' : ''})`} semPadding>
        {d.pendentesPrioritarios.length === 0 ? (
          <p className="nota" style={{ margin: 16 }}>Todos os conteúdos urgentes e altos foram concluídos.</p>
        ) : (
          <div className="tabela-wrap">
            <table className="tabela">
              <thead><tr><th>Conteúdo</th><th>Disciplina</th><th>Prioridade</th><th>Situação</th></tr></thead>
              <tbody>
                {d.pendentesPrioritarios.map((p) => (
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
        )}
      </Painel>
    </>
  );
}
