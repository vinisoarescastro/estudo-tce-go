import type { Config, Topico, TopicoEstado, UserData } from './types';
import { estadoDe, isConcluido } from './progress';
import { diffDias, somarDias } from './util';

// Próxima revisão = último estudo + intervalo da vez (1ª, 2ª, 3ª revisão...).
// Depois do último intervalo configurado, repete o maior.
export function proximaRevisao(e: TopicoEstado, cfg: Config): string | null {
  if (!isConcluido(e.status) || !e.ultimoEstudo || !cfg.revisaoDias.length) return null;
  const i = Math.min(e.revisoesFeitas, cfg.revisaoDias.length - 1);
  return somarDias(e.ultimoEstudo, cfg.revisaoDias[i]);
}

export interface RevisaoDevida {
  topico: Topico;
  vence: string;
  atrasoDias: number;
}

export function revisoesDevidas(topicos: Topico[], user: UserData, hoje: string): RevisaoDevida[] {
  const out: RevisaoDevida[] = [];
  for (const t of topicos) {
    const v = proximaRevisao(estadoDe(user, t.id), user.config);
    if (v && v <= hoje) out.push({ topico: t, vence: v, atrasoDias: diffDias(v, hoje) });
  }
  return out.sort((a, b) => b.atrasoDias - a.atrasoDias);
}

export function registrarRevisao(e: TopicoEstado, hoje: string): TopicoEstado {
  return { ...e, status: 'em_revisao', ultimoEstudo: hoje, revisoesFeitas: e.revisoesFeitas + 1, concluidoEm: e.concluidoEm ?? hoje };
}

// Revisões agendadas depois de hoje, até `ate` (inclusive), por data. `numero` é a revisão da vez (1ª, 2ª...).
export interface RevisaoAgendada { topico: Topico; data: string; numero: number }

export function agendaRevisoes(topicos: Topico[], user: UserData, hoje: string, ate: string): RevisaoAgendada[] {
  const out: RevisaoAgendada[] = [];
  for (const t of topicos) {
    const e = estadoDe(user, t.id);
    const v = proximaRevisao(e, user.config);
    if (v && v > hoje && v <= ate) out.push({ topico: t, data: v, numero: e.revisoesFeitas + 1 });
  }
  return out.sort((a, b) => a.data.localeCompare(b.data) || a.topico.numero - b.topico.numero);
}

// Revisões registradas (histórico) a partir de `desde`, da mais recente para a mais antiga.
// `dia` converte o horário do evento no dia local (isoDia no fuso da pessoa).
export interface RevisaoFeita { topico: Topico; dia: string; ts: string; numero: number | null }

export function revisoesFeitas(topicos: Topico[], user: UserData, desde: string, dia: (ts: string) => string): RevisaoFeita[] {
  const porId = new Map(topicos.map((t) => [t.id, t]));
  const out: RevisaoFeita[] = [];
  for (const ev of user.historico) {
    if (ev.tipo !== 'revisao' || !ev.topicoId) continue;
    const t = porId.get(ev.topicoId);
    if (!t) continue;
    const d = dia(ev.ts);
    if (d < desde) continue;
    const n = /revisão nº (\d+)/.exec(ev.descricao);
    out.push({ topico: t, dia: d, ts: ev.ts, numero: n ? Number(n[1]) : null });
  }
  return out.sort((a, b) => b.ts.localeCompare(a.ts));
}
