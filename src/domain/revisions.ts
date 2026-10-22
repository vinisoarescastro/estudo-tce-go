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
