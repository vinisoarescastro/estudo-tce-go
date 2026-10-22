import type { Dependencia, TipoDependencia, UserData } from './types';
import { estadoDe, isConcluido } from './progress';

export function prereqsDe(deps: Dependencia[], topicoId: string, tipo?: TipoDependencia): Dependencia[] {
  return deps.filter((d) => d.para === topicoId && (!tipo || d.tipo === tipo));
}

export function dependentesDe(deps: Dependencia[], topicoId: string): Dependencia[] {
  return deps.filter((d) => d.de === topicoId);
}

// Pré-requisitos ainda não concluídos (diretos).
export function pendentes(deps: Dependencia[], user: UserData, topicoId: string, tipo?: TipoDependencia): Dependencia[] {
  return prereqsDe(deps, topicoId, tipo).filter((d) => !isConcluido(estadoDe(user, d.de).status));
}

// Segue os pré-requisitos obrigatórios pendentes até achar um tópico que pode ser estudado agora.
// Retorna a cadeia do tópico desejado até o primeiro a estudar (ex.: [alvo, intermediário, base]).
export function cadeiaObrigatoria(deps: Dependencia[], user: UserData, topicoId: string): string[] {
  const cadeia = [topicoId];
  const visto = new Set(cadeia);
  let atual = topicoId;
  for (;;) {
    const p = pendentes(deps, user, atual, 'obrigatorio').find((d) => !visto.has(d.de));
    if (!p) return cadeia;
    cadeia.push(p.de);
    visto.add(p.de);
    atual = p.de;
  }
}

// Uma nova dependência não pode fechar um ciclo (A antes de B e B antes de A).
export function criaCiclo(deps: Dependencia[], de: string, para: string): boolean {
  if (de === para) return true;
  // Existe caminho de "para" até "de" seguindo dependentes?
  const pilha = [para];
  const visto = new Set<string>();
  while (pilha.length) {
    const x = pilha.pop() as string;
    if (x === de) return true;
    if (visto.has(x)) continue;
    visto.add(x);
    for (const d of dependentesDe(deps, x)) pilha.push(d.para);
  }
  return false;
}
