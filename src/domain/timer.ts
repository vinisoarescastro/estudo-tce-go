import type { Sessao, Timer } from './types';
import { isoDia } from './util';

// Cronômetro baseado em marcas de tempo. Só o intervalo entre "rodandoDesde" e agora
// soma ao acumulado; tempo pausado nunca conta. Como o estado é salvo, recarregar a
// página continua o mesmo cronômetro em vez de criar outro.

export function iniciar(p: Omit<Timer, 'iniciadoEm' | 'acumuladoMs' | 'rodandoDesde'>, agora: number, pausado = false): Timer {
  return { ...p, iniciadoEm: agora, acumuladoMs: 0, rodandoDesde: pausado ? null : agora };
}

export function pausar(t: Timer, agora: number): Timer {
  if (t.rodandoDesde === null) return t;
  return { ...t, acumuladoMs: t.acumuladoMs + Math.max(0, agora - t.rodandoDesde), rodandoDesde: null };
}

export function retomar(t: Timer, agora: number): Timer {
  if (t.rodandoDesde !== null) return t;
  return { ...t, rodandoDesde: agora };
}

export function decorridoMs(t: Timer, agora: number): number {
  return t.acumuladoMs + (t.rodandoDesde === null ? 0 : Math.max(0, agora - t.rodandoDesde));
}

// Gera a sessão final. O id da sessão é o id do cronômetro: finalizar duas vezes
// (por exemplo, por um recarregamento no meio) não duplica o registro.
export function finalizar(t: Timer, agora: number, notas = ''): Sessao {
  const ms = decorridoMs(t, agora);
  const iso = new Date(agora).toISOString();
  return {
    id: t.id,
    data: isoDia(new Date(t.iniciadoEm)),
    disciplinaId: t.disciplinaId,
    topicoId: t.topicoId,
    planejadoMin: t.planejadoMin,
    realizadoMin: Math.round(ms / 60000),
    notas,
    origem: 'cronometro',
    cicloItemId: t.cicloItemId,
    criadoEm: iso,
    atualizadoEm: iso,
  };
}

// Insere ou substitui pelo id. Garante que não haja duas sessões com o mesmo id.
export function upsertSessao(lista: Sessao[], s: Sessao): Sessao[] {
  const i = lista.findIndex((x) => x.id === s.id);
  if (i === -1) return [...lista, s];
  const copia = lista.slice();
  copia[i] = s;
  return copia;
}

export function fmtCronometro(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}
