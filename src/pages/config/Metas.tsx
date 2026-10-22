import { useEffect, useState } from 'react';
import { useApp } from '../../store/AppStore';
import { diffDias, fmtMin, FUSO_PADRAO, isoDia } from '../../domain/util';
import { Cabecalho, Icone, Painel } from '../../ui/primitives';

const FUSOS: [string, string][] = [
  ['America/Sao_Paulo', 'Brasília (GO, DF, SP, MG, RJ, Sul…) · UTC−3'],
  ['America/Bahia', 'Bahia · UTC−3'],
  ['America/Fortaleza', 'Nordeste (CE, RN, PB, PI, MA) · UTC−3'],
  ['America/Recife', 'Pernambuco · UTC−3'],
  ['America/Belem', 'Pará e Amapá · UTC−3'],
  ['America/Araguaina', 'Tocantins · UTC−3'],
  ['America/Cuiaba', 'Mato Grosso · UTC−4'],
  ['America/Campo_Grande', 'Mato Grosso do Sul · UTC−4'],
  ['America/Manaus', 'Amazonas · UTC−4'],
  ['America/Porto_Velho', 'Rondônia · UTC−4'],
  ['America/Boa_Vista', 'Roraima · UTC−4'],
  ['America/Rio_Branco', 'Acre · UTC−5'],
  ['America/Noronha', 'Fernando de Noronha · UTC−2'],
  ['UTC', 'UTC'],
];

// Planejamento: metas, duração das sessões, revisões, data da prova e fuso horário.
// A data da prova vive só aqui (config.dataProva): a contagem regressiva e os indicadores leem dela.
export function ConfigMetas() {
  const { dados, despachar } = useApp();
  const cfg = dados.user.config;
  const inicial = () => ({ diaria: cfg.metaDiariaMin, semanal: cfg.metaSemanalMin, duracao: cfg.duracaoPadraoMin, revisao: cfg.revisaoDias.join(', '), prova: cfg.dataProva, fuso: cfg.fusoHorario ?? FUSO_PADRAO });
  const [form, setForm] = useState(inicial);
  useEffect(() => setForm(inicial()), [cfg]); // eslint-disable-line react-hooks/exhaustive-deps
  const alterado = JSON.stringify(form) !== JSON.stringify(inicial());

  const salvar = (e: React.FormEvent) => {
    e.preventDefault();
    const revisaoDias = form.revisao.split(/[,;\s]+/).filter(Boolean).map(Number);
    despachar({ t: 'config', valor: { metaDiariaMin: Number(form.diaria), metaSemanalMin: Number(form.semanal), duracaoPadraoMin: Number(form.duracao), revisaoDias, dataProva: form.prova, fusoHorario: form.fuso } }, 'Configurações salvas.');
  };
  const faltam = form.prova ? diffDias(isoDia(), form.prova) : null;
  const fusos = FUSOS.some(([v]) => v === form.fuso) ? FUSOS : [[form.fuso, form.fuso] as [string, string], ...FUSOS];

  return (
    <div className="pagina pagina-estreita">
      <Cabecalho sobre="Configurações" titulo="Metas e planejamento" subtitulo="Valem para o Início, o Dashboard, o cronômetro e as revisões." />

      <form onSubmit={salvar} className="pilha">
        <Painel>
          <div className="config">
            <div className="config-secao">
              <div className="config-desc">
                <h2>Data da prova</h2>
                <p>Fonte única da contagem regressiva. Oficial: 17/01/2027 (Anexo III, item 12).</p>
              </div>
              <div className="config-campos">
                <div className="form-linha">
                  <div className="campo">
                    <label htmlFor="cf-pv">Data</label>
                    <input id="cf-pv" type="date" value={form.prova} onChange={(e) => setForm({ ...form, prova: e.target.value })} aria-describedby="cf-pv-d" />
                  </div>
                  {form.prova && <button type="button" className="btn fantasma" onClick={() => setForm({ ...form, prova: '' })}>Deixar sem data</button>}
                </div>
                <span className="campo-ajuda" id="cf-pv-d">{faltam === null ? 'Sem data, o Início mostra um convite para cadastrá-la.' : faltam >= 0 ? `Faltam ${faltam} dia(s).` : 'Essa data já passou.'}</span>
              </div>
            </div>

            <div className="config-secao">
              <div className="config-desc">
                <h2>Metas de estudo</h2>
                <p>Sugestão pela sua disponibilidade: 6h30/dia de segunda a sexta e 3h30/dia no fim de semana = 39h30 por semana.</p>
              </div>
              <div className="config-campos form-grade">
                <div className="campo">
                  <label htmlFor="cf-d">Meta diária (min)</label>
                  <input id="cf-d" type="number" min={0} max={1440} step={5} value={form.diaria} onChange={(e) => setForm({ ...form, diaria: Number(e.target.value) })} aria-describedby="cf-d-d" />
                  <span className="campo-ajuda" id="cf-d-d">{form.diaria ? fmtMin(form.diaria) : 'sem meta'}</span>
                </div>
                <div className="campo">
                  <label htmlFor="cf-s">Meta semanal (min)</label>
                  <input id="cf-s" type="number" min={0} max={10080} step={15} value={form.semanal} onChange={(e) => setForm({ ...form, semanal: Number(e.target.value) })} aria-describedby="cf-s-d" />
                  <span className="campo-ajuda" id="cf-s-d">{form.semanal ? fmtMin(form.semanal) : 'sem meta'}</span>
                </div>
              </div>
            </div>

            <div className="config-secao">
              <div className="config-desc">
                <h2>Sessões e revisões</h2>
                <p>A duração padrão vale para estudos fora do ciclo e novas sessões.</p>
              </div>
              <div className="config-campos form-grade">
                <div className="campo">
                  <label htmlFor="cf-p">Duração padrão (min)</label>
                  <input id="cf-p" type="number" min={5} max={600} step={5} value={form.duracao} onChange={(e) => setForm({ ...form, duracao: Number(e.target.value) })} />
                </div>
                <div className="campo">
                  <label htmlFor="cf-r">Intervalos de revisão (dias)</label>
                  <input id="cf-r" value={form.revisao} onChange={(e) => setForm({ ...form, revisao: e.target.value })} aria-describedby="cf-r-d" />
                  <span className="campo-ajuda" id="cf-r-d">Separados por vírgula. Depois do último, repete o maior.</span>
                </div>
              </div>
            </div>

            <div className="config-secao">
              <div className="config-desc">
                <h2>Fuso horário</h2>
                <p>Define quando começam “hoje” e “esta semana” e o dia de cada sessão, mesmo com o servidor em outro fuso.</p>
              </div>
              <div className="config-campos">
                <div className="campo">
                  <label htmlFor="cf-fuso">Fuso</label>
                  <select id="cf-fuso" value={form.fuso} onChange={(e) => setForm({ ...form, fuso: e.target.value })}>
                    {fusos.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </Painel>

        {alterado && (
          <div className="salvar-flutuante">
            <span className="nota">Há alterações não salvas.</span>
            <button type="button" className="btn fantasma" onClick={() => setForm(inicial())}>Descartar</button>
            <button className="btn primario" type="submit"><Icone nome="check" tam={15} /> Salvar</button>
          </div>
        )}
      </form>
    </div>
  );
}
