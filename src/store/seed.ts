import type { Seed } from '../domain/types';

// Estrutura do edital (núcleos, disciplinas, conteúdos e referências), carregada da API,
// que a lê do banco. É uma ligação viva: depois de definirSeed, todo módulo que importou
// `seed` passa a ver o valor carregado. Os componentes só a usam depois do carregamento.
export let seed: Seed = null as unknown as Seed;

export function definirSeed(s: Seed): void {
  seed = s;
}
