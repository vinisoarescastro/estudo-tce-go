import type { NucleoId } from '../domain/types';
import type { FiltroSessoes } from '../domain/stats';
import { isoDia, somarDias } from '../domain/util';
import { seed } from '../store/AppStore';

export type Periodo = '7' | '30' | '90' | 'tudo' | 'personalizado';

export interface EstadoFiltro {
  periodo: Periodo;
  de: string;
  ate: string;
  disciplinaId: string;
  nucleo: '' | NucleoId;
}

export const FILTRO_INICIAL: EstadoFiltro = { periodo: '30', de: somarDias(isoDia(), -29), ate: isoDia(), disciplinaId: '', nucleo: '' };

// Converte o estado da tela no filtro do domínio. "Tudo" vai do primeiro registro até hoje.
export function paraFiltro(f: EstadoFiltro, primeiroDia: string | null): FiltroSessoes & { de: string; ate: string } {
  const hoje = isoDia();
  let de = f.de;
  let ate = f.ate;
  if (f.periodo === 'tudo') {
    de = primeiroDia && primeiroDia < hoje ? primeiroDia : somarDias(hoje, -6);
    ate = hoje;
  } else if (f.periodo !== 'personalizado') {
    de = somarDias(hoje, -(Number(f.periodo) - 1));
    ate = hoje;
  }
  if (de > ate) [de, ate] = [ate, de];
  return { de, ate, disciplinaId: f.disciplinaId || undefined, nucleo: f.nucleo || undefined };
}

export function Filtros({ valor, onChange, prefixo, extra }: { valor: EstadoFiltro; onChange: (f: EstadoFiltro) => void; prefixo: string; extra?: React.ReactNode }) {
  const set = (p: Partial<EstadoFiltro>) => onChange({ ...valor, ...p });
  return (
    <div className="barra-ferramentas" role="group" aria-label="Filtros">
      <select id={`${prefixo}-per`} aria-label="Período" value={valor.periodo} onChange={(e) => set({ periodo: e.target.value as Periodo })}>
        <option value="7">Últimos 7 dias</option>
        <option value="30">Últimos 30 dias</option>
        <option value="90">Últimos 90 dias</option>
        <option value="tudo">Desde o início</option>
        <option value="personalizado">Período personalizado</option>
      </select>
      {valor.periodo === 'personalizado' && (
        <>
          <input id={`${prefixo}-de`} type="date" aria-label="De" value={valor.de} onChange={(e) => e.target.value && set({ de: e.target.value })} />
          <input id={`${prefixo}-ate`} type="date" aria-label="Até" value={valor.ate} onChange={(e) => e.target.value && set({ ate: e.target.value })} />
        </>
      )}
      <select id={`${prefixo}-nuc`} aria-label="Núcleo" value={valor.nucleo} onChange={(e) => set({ nucleo: e.target.value as EstadoFiltro['nucleo'], disciplinaId: '' })}>
        <option value="">Todos os núcleos</option>
        {seed.nucleos.map((n) => (
          <option key={n.id} value={n.id}>{n.id === 'CG' ? 'Conhecimentos Gerais' : 'Conhecimentos Específicos'}</option>
        ))}
      </select>
      <select id={`${prefixo}-disc`} aria-label="Disciplina" value={valor.disciplinaId} onChange={(e) => set({ disciplinaId: e.target.value })}>
        <option value="">Todas as disciplinas</option>
        {seed.disciplinas.filter((d) => !valor.nucleo || d.nucleo === valor.nucleo).map((d) => (
          <option key={d.id} value={d.id}>{d.nomeCurto}</option>
        ))}
      </select>
      {extra}
    </div>
  );
}
