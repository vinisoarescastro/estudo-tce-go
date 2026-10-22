import type { Ciclo, CicloItem, Disciplina, Prioridade, Topico, UserData } from './types';
import { estadoDe } from './progress';

// O ciclo guarda o id do próximo item, não uma posição. Assim, reordenar ou desativar
// disciplinas não muda o que vem a seguir nem toca no histórico de sessões.

export function ativos(c: Ciclo): CicloItem[] {
  return c.itens.filter((i) => i.ativo);
}

export function proximoItem(c: Ciclo): CicloItem | null {
  const at = ativos(c);
  if (!at.length) return null;
  return at.find((i) => i.id === c.proximoItemId) ?? at[0];
}

export function mover(c: Ciclo, de: number, para: number): Ciclo {
  if (de === para || de < 0 || para < 0 || de >= c.itens.length || para >= c.itens.length) return c;
  const itens = c.itens.slice();
  const [it] = itens.splice(de, 1);
  itens.splice(para, 0, it);
  return { ...c, itens };
}

// Avança o ciclo depois de uma sessão do item `feitoId`. Só avança se o item era o próximo,
// para que uma sessão fora de ordem não pule disciplinas.
export function avancar(c: Ciclo, feitoId: string): Ciclo {
  const at = ativos(c);
  const atual = proximoItem(c);
  if (!atual || atual.id !== feitoId) return c;
  const idx = at.findIndex((i) => i.id === atual.id);
  const prox = at[(idx + 1) % at.length];
  const volta = idx + 1 >= at.length;
  return { ...c, proximoItemId: prox.id, numero: volta ? c.numero + 1 : c.numero };
}

export function definirAtivo(c: Ciclo, itemId: string, ativo: boolean): Ciclo {
  const itens = c.itens.map((i) => (i.id === itemId ? { ...i, ativo } : i));
  let proximoItemId = c.proximoItemId;
  if (!ativo && proximoItemId === itemId) {
    // O próximo passa a ser o item ativo seguinte na ordem.
    const idx = c.itens.findIndex((i) => i.id === itemId);
    const seguinte = [...c.itens.slice(idx + 1), ...c.itens.slice(0, idx)].find((i) => i.ativo && i.id !== itemId);
    proximoItemId = seguinte?.id ?? null;
  }
  if (ativo && !itens.some((i) => i.ativo && i.id === proximoItemId)) proximoItemId = itemId;
  return { ...c, itens, proximoItemId };
}

export function remover(c: Ciclo, itemId: string): Ciclo {
  let next = definirAtivo(c, itemId, false);
  next = { ...next, itens: next.itens.filter((i) => i.id !== itemId) };
  return next;
}

export function adicionar(c: Ciclo, item: CicloItem): Ciclo {
  const itens = [...c.itens, item];
  return { ...c, itens, proximoItemId: c.proximoItemId ?? item.id };
}

export function minutosPorVolta(c: Ciclo): number {
  return ativos(c).reduce((a, i) => a + i.minutos, 0);
}

// Distribuição sugerida: o peso de cada disciplina é a soma dos pesos de prioridade dos tópicos
// ainda não concluídos, vezes o peso do bloco na prova (CG 1, CE 2; edital, item 7.1).
export const PESO_PRIORIDADE: Record<Prioridade, number> = { Urgente: 3, Alta: 2, Média: 1, Baixa: 0.5 };
export const PESO_NUCLEO = { CG: 1, CE: 2 } as const;

export function prioridadeTopico(t: Topico, user: UserData): Prioridade {
  return estadoDe(user, t.id).prioridade ?? t.prioridadePlanilha;
}

// Prioridade de uma disciplina: a definida pelo usuário ou, na falta dela, a mais frequente
// entre os tópicos (empate resolvido pela mais alta).
export function prioridadeDisciplina(d: Disciplina, topicos: Topico[], user: UserData): { p: Prioridade; propria: boolean } {
  const pd = user.prioridadeDisciplina[d.id];
  if (pd) return { p: pd, propria: true };
  const n: Record<string, number> = {};
  for (const t of topicos) if (t.disciplinaId === d.id) n[prioridadeTopico(t, user)] = (n[prioridadeTopico(t, user)] ?? 0) + 1;
  const ordem: Prioridade[] = ['Urgente', 'Alta', 'Média', 'Baixa'];
  let melhor: Prioridade = 'Média';
  let max = -1;
  for (const p of ordem) if ((n[p] ?? 0) > max) { max = n[p] ?? 0; melhor = p; }
  return { p: melhor, propria: false };
}

export function distribuicaoSugerida(
  c: Ciclo,
  disciplinas: Disciplina[],
  topicos: Topico[],
  user: UserData,
  minutosTotais: number,
  passo = 15,
): Record<string, number> {
  const at = ativos(c);
  const peso: Record<string, number> = {};
  for (const it of at) {
    const d = disciplinas.find((x) => x.id === it.disciplinaId);
    if (!d) continue;
    const w = topicos
      .filter((t) => t.disciplinaId === d.id)
      .reduce((a, t) => a + (estadoDe(user, t.id).status === 'estudado' || estadoDe(user, t.id).status === 'em_revisao' ? 0.25 : PESO_PRIORIDADE[prioridadeTopico(t, user)]), 0);
    // Prioridade da disciplina definida pelo usuário multiplica o peso (Média = neutro).
    const pd = user.prioridadeDisciplina[d.id];
    peso[it.id] = w * PESO_NUCLEO[d.nucleo] * (pd ? PESO_PRIORIDADE[pd] : 1);
  }
  // Cada item aparece uma vez por disciplina repetida no ciclo: divide o peso entre as repetições.
  const reps: Record<string, number> = {};
  for (const it of at) reps[it.disciplinaId] = (reps[it.disciplinaId] ?? 0) + 1;
  const tot = at.reduce((a, it) => a + (peso[it.id] ?? 0) / reps[it.disciplinaId], 0) || 1;
  const out: Record<string, number> = {};
  for (const it of at) {
    const bruto = (minutosTotais * ((peso[it.id] ?? 0) / reps[it.disciplinaId])) / tot;
    out[it.id] = Math.max(passo, Math.round(bruto / passo) * passo);
  }
  return out;
}
