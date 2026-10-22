import { useState } from 'react';
import type { Status } from '../domain/types';
import { STATUS, STATUS_LABEL } from '../domain/types';
import { useApp, seed } from '../store/AppStore';
import { decorridoMs } from '../domain/timer';
import { estadoDe } from '../domain/progress';
import { fmtMin } from '../domain/util';
import { Modal, useAgora } from './primitives';

// Janela para salvar a sessão do cronômetro. Usada no cronômetro flutuante e na tela de foco.
// "Voltar a estudar" retoma o cronômetro, que quem abriu a janela pausou.
export function FinalizarSessao({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const { dados, despachar } = useApp();
  const t = dados.user.timer;
  const agora = useAgora(1000, aberto && !!t);
  const [notas, setNotas] = useState('');
  const [status, setStatus] = useState<Status | ''>('');
  if (!t) return null;
  const ms = decorridoMs(t, agora);
  const disc = seed.disciplinas.find((d) => d.id === t.disciplinaId);
  const top = t.topicoId ? seed.topicos.find((x) => x.id === t.topicoId) : null;

  const finalizar = () => {
    if (despachar({ t: 'timerFinalizar', notas, novoStatus: status || null }, `Sessão salva: ${fmtMin(Math.round(ms / 60000))} estudados.`)) {
      onFechar();
      setNotas('');
      setStatus('');
    }
  };

  return (
    <Modal titulo="Finalizar sessão" subtitulo={disc?.nome} aberto={aberto} onFechar={onFechar} largura={500}>
      <div className="form">
        <div className="resumo-sessao">
          <div><span>Tempo estudado</span><b>{fmtMin(Math.round(ms / 60000))}</b></div>
          <div><span>Planejado</span><b>{fmtMin(t.planejadoMin)}</b></div>
        </div>
        {top && (
          <div className="campo">
            <label htmlFor="cr-st">Situação do conteúdo depois da sessão</label>
            <select id="cr-st" value={status} onChange={(e) => setStatus(e.target.value as Status | '')}>
              <option value="">Manter ({STATUS_LABEL[estadoDe(dados.user, top.id).status]})</option>
              {STATUS.map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
            <span className="campo-ajuda">nº {top.numero} · {top.titulo}</span>
          </div>
        )}
        <div className="campo">
          <label htmlFor="cr-notas">Observações <span className="nota">(opcional)</span></label>
          <textarea id="cr-notas" rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="O que estudou, dúvidas, questões erradas…" />
        </div>
        <p className="nota">O tempo em pausa não é contado.{t.cicloItemId ? ' Ao salvar, o ciclo avança para a próxima disciplina.' : ''}</p>
        <div className="acoes">
          <button className="btn" onClick={() => { despachar({ t: 'timerRetomar' }); onFechar(); }}>Voltar a estudar</button>
          <button className="btn primario" onClick={finalizar}>Salvar sessão</button>
        </div>
      </div>
    </Modal>
  );
}
