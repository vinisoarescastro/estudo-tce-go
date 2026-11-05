import seedB02 from '../src/data/seed.json';
import seedA01 from '../src/data/seed-a01.json';
import type { Seed } from '../src/domain/types';
import type { BD } from './sqlite';
import { lerEdital, sincronizarEdital } from './edital';

// Todos os editais verticalizados que o servidor conhece, um por cargo.
export const SEEDS = [seedB02, seedA01] as unknown as Seed[];

// Grava (se mudaram) os editais de todos os cargos e devolve o seed de cada um, por id do cargo.
export function prepararEditais(db: BD, seeds: Seed[] = SEEDS): { gravados: string[]; porCargo: Record<string, Seed> } {
  const gravados: string[] = [];
  const porCargo: Record<string, Seed> = {};
  for (const s of seeds) {
    if (sincronizarEdital(db, s)) gravados.push(s.cargo!.id);
    porCargo[s.cargo!.id] = lerEdital(db, s.cargo!.id);
  }
  return { gravados, porCargo };
}
