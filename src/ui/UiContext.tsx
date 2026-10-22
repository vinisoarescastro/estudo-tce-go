import { createContext, useContext } from 'react';
import type { Sessao } from '../domain/types';

export type PresetSessao = Partial<Omit<Sessao, 'criadoEm' | 'atualizadoEm'>>;

export interface UiCtx {
  abrirTopico: (id: string) => void;
  abrirSessao: (preset?: PresetSessao) => void;
  iniciarEstudo: (p: { disciplinaId: string; topicoId: string | null; cicloItemId: string | null; planejadoMin: number }) => void;
  confirmar: (titulo: string, texto: string, acao?: string) => Promise<boolean>;
  navegar: (rota: string) => void;
}

export const Ui = createContext<UiCtx | null>(null);

export function useUi(): UiCtx {
  const c = useContext(Ui);
  if (!c) throw new Error('useUi fora do provider');
  return c;
}
