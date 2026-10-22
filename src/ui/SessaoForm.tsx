import { useEffect, useMemo, useState } from 'react';
import type { Status } from '../domain/types';
import { STATUS, STATUS_LABEL } from '../domain/types';
import { useApp, seed } from '../store/AppStore';
import { isoDia } from '../domain/util';
import { estadoDe } from '../domain/progress';
import { Modal } from './primitives';
import type { PresetSessao } from './UiContext';

// Registro manual ou correção de uma sessão de estudo.
export function SessaoForm({ aberto, preset, onFechar }: { aberto: boolean; preset?: PresetSessao; onFechar: () => void }) {
  const { dados, despachar } = useApp();
  const u = dados.user;
  const editando = !!preset?.id && u.sessoes.some((s) => s.id === preset.id);
  const [disc, setDisc] = useState('');
  const [top, setTop] = useState('');
  const [data, setData] = useState(isoDia());
  const [real, setReal] = useState(60);
  const [plan, setPlan] = useState(u.config.duracaoPadraoMin);
  const [notas, setNotas] = useState('');
  const [status, setStatus] = useState<Status | ''>('');
  const [avancar, setAvancar] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setDisc(preset?.disciplinaId ?? '');
    setTop(preset?.topicoId ?? '');
    setData(preset?.data ?? isoDia());
    setReal(preset?.realizadoMin ?? u.config.duracaoPadraoMin);
    setPlan(preset?.planejadoMin ?? u.config.duracaoPadraoMin);
    setNotas(preset?.notas ?? '');
    setStatus('');
    setAvancar(!!preset?.cicloItemId && !editando);
  }, [aberto, preset, u.config.duracaoPadraoMin, editando]);

  const topicos = useMemo(() => seed.topicos.filter((t) => t.disciplinaId === disc), [disc]);

  const salvar = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = despachar(
      {
        t: 'sessaoSalvar',
        sessao: {
          id: editando ? preset!.id : undefined,
          data,
          disciplinaId: disc,
          topicoId: top || null,
          planejadoMin: Number(plan),
          realizadoMin: Number(real),
          notas,
          origem: editando ? (u.sessoes.find((s) => s.id === preset!.id)?.origem ?? 'manual') : 'manual',
          cicloItemId: preset?.cicloItemId ?? null,
        },
        avancarCiclo: avancar,
        novoStatus: status || null,
      },
      editando ? 'Sessão corrigida. Os indicadores foram recalculados.' : 'Sessão registrada.',
    );
    if (ok) onFechar();
  };

  return (
    <Modal titulo={editando ? 'Corrigir sessão' : 'Registrar sessão'} subtitulo={editando ? 'Os totais são recalculados ao salvar.' : 'Para tempo estudado sem o cronômetro.'} aberto={aberto} onFechar={onFechar} largura={540}>
      <form className="form" onSubmit={salvar}>
        <div className="campo">
          <label htmlFor="sf-disc">Disciplina</label>
          <select id="sf-disc" required value={disc} onChange={(e) => { setDisc(e.target.value); setTop(''); }}>
            <option value="">Escolha…</option>
            {seed.disciplinas.map((d) => (
              <option key={d.id} value={d.id}>{d.nomeCurto}</option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="sf-top">Conteúdo <span className="nota">(opcional)</span></label>
          <select id="sf-top" value={top} onChange={(e) => setTop(e.target.value)} disabled={!disc}>
            <option value="">Sem conteúdo específico</option>
            {topicos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.numero} · {t.titulo} ({STATUS_LABEL[estadoDe(u, t.id).status]})
              </option>
            ))}
          </select>
        </div>
        <div className="form-grade">
          <div className="campo">
            <label htmlFor="sf-data">Data</label>
            <input id="sf-data" type="date" required value={data} max={isoDia()} onChange={(e) => setData(e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor="sf-real">Estudado (min)</label>
            <input id="sf-real" type="number" min={1} max={1440} required value={real} onChange={(e) => setReal(Number(e.target.value))} />
          </div>
          <div className="campo">
            <label htmlFor="sf-plan">Planejado (min)</label>
            <input id="sf-plan" type="number" min={0} max={1440} required value={plan} onChange={(e) => setPlan(Number(e.target.value))} />
          </div>
        </div>
        {top && !editando && (
          <div className="campo">
            <label htmlFor="sf-st">Situação do conteúdo depois da sessão</label>
            <select id="sf-st" value={status} onChange={(e) => setStatus(e.target.value as Status | '')}>
              <option value="">Manter ({STATUS_LABEL[estadoDe(u, top).status]})</option>
              {STATUS.map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
          </div>
        )}
        <div className="campo">
          <label htmlFor="sf-notas">Observações <span className="nota">(opcional)</span></label>
          <textarea id="sf-notas" rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="O que estudou, dúvidas, questões erradas…" />
        </div>
        {preset?.cicloItemId && !editando && (
          <label className="check">
            <input type="checkbox" checked={avancar} onChange={(e) => setAvancar(e.target.checked)} /> Contar como a sessão do ciclo e avançar para a próxima disciplina
          </label>
        )}
        <div className="acoes">
          <button type="button" className="btn" onClick={onFechar}>Cancelar</button>
          <button type="submit" className="btn primario">{editando ? 'Salvar correção' : 'Registrar'}</button>
        </div>
      </form>
    </Modal>
  );
}
