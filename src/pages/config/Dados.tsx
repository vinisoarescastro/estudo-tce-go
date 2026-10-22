import { useRef } from 'react';
import type { AppData } from '../../domain/types';
import { useApp, seed } from '../../store/AppStore';
import { validarAppData } from '../../domain/validate';
import { isConcluido } from '../../domain/progress';
import { isoDia } from '../../domain/util';
import { Cabecalho, Icone, Painel } from '../../ui/primitives';
import { useUi } from '../../ui/UiContext';

function baixar(nome: string, conteudo: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const csv = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

// Backup e restauração dos dados de estudo da conta.
export function ConfigDados() {
  const { dados, despachar, avisar, salvo } = useApp();
  const { confirmar } = useUi();
  const u = dados.user;
  const arquivo = useRef<HTMLInputElement>(null);
  const pendente = salvo === 'salvando' || salvo === 'erro';

  const exportarCsv = () => {
    const linhas = [['data', 'disciplina', 'nucleo', 'conteudo_n', 'conteudo', 'realizado_min', 'planejado_min', 'origem', 'observacoes'].join(';')];
    for (const s of [...u.sessoes].sort((a, b) => a.data.localeCompare(b.data))) {
      const d = seed.disciplinas.find((x) => x.id === s.disciplinaId);
      const t = s.topicoId ? seed.topicos.find((x) => x.id === s.topicoId) : null;
      linhas.push([s.data, csv(d?.nomeCurto), d?.nucleo, t?.numero ?? '', csv(t?.titulo), s.realizadoMin, s.planejadoMin, s.origem, csv(s.notas)].join(';'));
    }
    baixar(`estudo-tce-go-sessoes-${isoDia()}.csv`, '﻿' + linhas.join('\r\n'), 'text/csv;charset=utf-8');
  };

  const importar = async (file: File) => {
    let obj: unknown;
    try {
      obj = JSON.parse(await file.text());
    } catch {
      avisar('erro', 'O arquivo não é um JSON válido.');
      return;
    }
    const erros = validarAppData(obj, seed);
    if (erros.length) {
      avisar('erro', `Arquivo recusado: ${erros.slice(0, 3).join(' ')}${erros.length > 3 ? ` (+${erros.length - 3} problemas)` : ''}`);
      return;
    }
    const d = obj as AppData;
    const n = Object.values(d.user.topicos).filter((e) => isConcluido(e.status)).length;
    if (await confirmar('Restaurar backup?', `O arquivo tem ${d.user.sessoes.length} sessões e ${n} conteúdos concluídos. Seus dados atuais (${u.sessoes.length} sessões) serão substituídos. O servidor guarda uma cópia do banco antes de substituir.`, 'Restaurar')) {
      despachar({ t: 'importar', dados: d }, 'Backup restaurado.');
    }
  };

  const zerar = async () => {
    if (!(await confirmar('Apagar todos os dados?', 'Sessões, situações, ciclo, dependências e configurações voltam ao estado inicial. O servidor guarda uma cópia do banco antes, mas restaurá-la exige acesso ao servidor. Exporte um backup antes.', 'Apagar tudo'))) return;
    despachar({ t: 'reiniciar' }, 'Dados apagados. O plano voltou ao estado inicial.');
  };

  const concluidos = Object.values(u.topicos).filter((e) => isConcluido(e.status)).length;

  return (
    <div className="pagina pagina-estreita">
      <Cabecalho sobre="Configurações" titulo="Dados e backup" subtitulo="Seus dados ficam no banco do servidor, disponíveis em qualquer dispositivo." />
      <Painel>
        <div className="config">
          <div className="config-secao">
            <div className="config-desc">
              <h2>Situação</h2>
              <p>O servidor também faz cópias automáticas do banco (uma por dia, mantendo as 14 mais recentes) e uma extra antes de cada importação ou exclusão total.</p>
            </div>
            <div className="config-campos">
              <span className={`estado salvo-${salvo}`} role="status">
                <span className="ponto" aria-hidden="true" />
                {salvo === 'salvo' ? 'Tudo salvo no servidor' : salvo === 'salvando' ? 'Salvando alterações…' : salvo === 'erro' ? 'Sem conexão: as alterações desta aba serão enviadas quando o servidor responder' : 'Carregando…'}
              </span>
              <dl className="dados-linhas">
                <div><dt>Sessões registradas</dt><dd>{u.sessoes.length}</dd></div>
                <div><dt>Conteúdos concluídos</dt><dd>{concluidos}</dd></div>
                <div><dt>Eventos no histórico</dt><dd>{u.historico.length}</dd></div>
              </dl>
            </div>
          </div>
          <div className="config-secao">
            <div className="config-desc">
              <h2>Exportar</h2>
              <p>O backup JSON contém tudo: situação dos conteúdos, ciclo, sessões, pré-requisitos, configurações e histórico.</p>
            </div>
            <div className="config-campos">
              <div className="acoes" style={{ justifyContent: 'flex-start' }}>
                <a className="btn primario" href="/api/exportar" download aria-disabled={pendente} onClick={(e) => { if (pendente) { e.preventDefault(); avisar('info', 'Aguarde as alterações serem salvas para exportar.'); } else avisar('ok', 'Backup exportado. Guarde o arquivo em local seguro.'); }}>
                  <Icone nome="baixar" tam={15} /> Backup completo (.json)
                </a>
                <button className="btn" onClick={exportarCsv} disabled={!u.sessoes.length}><Icone nome="baixar" tam={15} /> Sessões (.csv)</button>
              </div>
            </div>
          </div>
          <div className="config-secao">
            <div className="config-desc">
              <h2>Importar</h2>
              <p>Substitui os dados atuais por um backup JSON, depois de validá-lo.</p>
            </div>
            <div className="config-campos">
              <p className="campo-ajuda">Para trazer os dados da versão anterior (que guardava tudo no navegador), abra o arquivo antigo <code>dist/index.html</code>, vá em Configurações → Exportar backup e importe o arquivo aqui.</p>
              <div>
                <button className="btn" onClick={() => arquivo.current?.click()}><Icone nome="subir" tam={15} /> Importar backup</button>
                <input ref={arquivo} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importar(f); e.target.value = ''; }} />
              </div>
            </div>
          </div>
        </div>
      </Painel>

      <div className="zona-perigo">
        <div>
          <b>Apagar tudo</b>
          <span className="nota">Sessões, situações, ciclo, dependências e configurações voltam ao estado inicial.</span>
        </div>
        <button className="btn perigo" onClick={zerar}><Icone nome="lixeira" tam={15} /> Apagar tudo</button>
      </div>
    </div>
  );
}
