import type { BD } from './sqlite';
import { prep, transacao } from './db';
import { cargoExiste } from './edital';

// Inscrições: os editais (cargos) em que cada conta estuda. O edital principal é usuarios.cargo_id,
// sempre uma inscrição ativa. Só o administrador acrescenta, retira ou troca o principal.
// Retirar um edital só desativa a inscrição: os dados de estudo ficam guardados e voltam se a
// conta for inscrita de novo.

export interface Inscricao { cargoId: string; ativa: boolean; principal: boolean; criadaEm: string }

export function listarInscricoes(db: BD, usuarioId: number): Inscricao[] {
  const principal = (prep(db, 'SELECT cargo_id FROM usuarios WHERE id = ?').get(usuarioId) as { cargo_id: string } | undefined)?.cargo_id;
  return (prep(db, 'SELECT cargo_id, ativa, criada_em FROM inscricoes WHERE usuario_id = ? ORDER BY criada_em, cargo_id').all(usuarioId) as { cargo_id: string; ativa: number; criada_em: string }[])
    .map((r) => ({ cargoId: r.cargo_id, ativa: r.ativa === 1, principal: r.cargo_id === principal, criadaEm: r.criada_em }));
}

// Inscreve a conta no edital (ou reativa a inscrição) ou retira a inscrição.
export function definirInscricao(db: BD, usuarioId: number, cargoId: string, ativa: boolean): void {
  if (!cargoExiste(db, cargoId)) throw new Error(`Cargo desconhecido: ${cargoId}.`);
  const principal = (prep(db, 'SELECT cargo_id FROM usuarios WHERE id = ?').get(usuarioId) as { cargo_id: string } | undefined)?.cargo_id;
  if (!principal) throw new Error('Usuário não encontrado.');
  if (!ativa && principal === cargoId) throw new Error('Este é o edital principal da conta. Escolha outro edital como principal antes de retirá-lo.');
  prep(db, `INSERT INTO inscricoes (usuario_id, cargo_id, ativa, criada_em) VALUES (?, ?, ?, ?)
    ON CONFLICT(usuario_id, cargo_id) DO UPDATE SET ativa = excluded.ativa`).run(usuarioId, cargoId, ativa ? 1 : 0, new Date().toISOString());
}

// Troca o edital principal: o que a conta abre por padrão. Precisa ser uma inscrição ativa.
export function definirPrincipal(db: BD, usuarioId: number, cargoId: string): void {
  const r = prep(db, 'SELECT ativa FROM inscricoes WHERE usuario_id = ? AND cargo_id = ?').get(usuarioId, cargoId) as { ativa: number } | undefined;
  if (!r || r.ativa !== 1) throw new Error('A conta precisa estar inscrita nesse edital para ele ser o principal.');
  // A versão dos dados sobe: uma aba aberta sem o edital indicado recebe os dados do novo principal
  // em vez de ter alterações aplicadas no edital errado.
  transacao(db, () => {
    prep(db, 'UPDATE usuarios SET cargo_id = ?, versao_dados = versao_dados + 1, atualizado_em = ? WHERE id = ?').run(cargoId, new Date().toISOString(), usuarioId);
  });
}
