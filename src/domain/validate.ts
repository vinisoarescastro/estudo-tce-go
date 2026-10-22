import type { AppData, Seed } from './types';
import { STATUS, PRIORIDADES } from './types';
import { fusoValido } from './util';

// Valida um arquivo importado antes de substituir os dados. Devolve a lista de problemas;
// lista vazia = pode importar.
export function validarAppData(x: unknown, seed: Seed): string[] {
  const erros: string[] = [];
  const o = x as AppData;
  if (!o || typeof o !== 'object') return ['O arquivo não contém um objeto JSON.'];
  if (o.schemaVersion !== 1) erros.push('Versão de dados desconhecida (esperado schemaVersion 1).');
  const u = o.user;
  if (!u || typeof u !== 'object') return [...erros, 'Faltam os dados do usuário ("user").'];
  const topIds = new Set(seed.topicos.map((t) => t.id));
  const discIds = new Set(seed.disciplinas.map((d) => d.id));
  if (typeof u.topicos !== 'object' || u.topicos === null) erros.push('"user.topicos" inválido.');
  else
    for (const [id, e] of Object.entries(u.topicos)) {
      if (!topIds.has(id)) erros.push(`Tópico desconhecido: ${id}.`);
      else if (!STATUS.includes(e.status)) erros.push(`Status inválido no tópico ${id}.`);
      else if (e.prioridade && !PRIORIDADES.includes(e.prioridade)) erros.push(`Prioridade inválida no tópico ${id}.`);
    }
  if (!u.ciclo || !Array.isArray(u.ciclo.itens)) erros.push('"user.ciclo" inválido.');
  else for (const i of u.ciclo.itens) if (!discIds.has(i.disciplinaId) || !(i.minutos > 0)) erros.push(`Item de ciclo inválido: ${i.id}.`);
  if (!Array.isArray(u.sessoes)) erros.push('"user.sessoes" inválido.');
  else {
    const ids = new Set<string>();
    for (const s of u.sessoes) {
      if (ids.has(s.id)) erros.push(`Sessão duplicada: ${s.id}.`);
      ids.add(s.id);
      if (!discIds.has(s.disciplinaId)) erros.push(`Sessão ${s.id} com disciplina desconhecida.`);
      if (s.topicoId && !topIds.has(s.topicoId)) erros.push(`Sessão ${s.id} com tópico desconhecido.`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s.data)) erros.push(`Sessão ${s.id} com data inválida.`);
      if (!(s.realizadoMin >= 0) || !(s.planejadoMin >= 0)) erros.push(`Sessão ${s.id} com duração inválida.`);
    }
  }
  if (!Array.isArray(u.dependencias)) erros.push('"user.dependencias" inválido.');
  else {
    const ids = new Set<string>();
    for (const d of u.dependencias) {
      if (!d || typeof d.id !== 'string' || ids.has(d.id)) erros.push('Dependência sem id ou com id repetido.');
      else ids.add(d.id);
      if (d && (!topIds.has(d.de) || !topIds.has(d.para))) erros.push(`Dependência ${d.id} aponta para conteúdo desconhecido.`);
      if (d && d.tipo !== 'obrigatorio' && d.tipo !== 'recomendado') erros.push(`Dependência ${d.id} com tipo inválido.`);
    }
  }
  if (u.prioridadeDisciplina && typeof u.prioridadeDisciplina === 'object')
    for (const [id, p] of Object.entries(u.prioridadeDisciplina)) if (p && (!discIds.has(id) || !PRIORIDADES.includes(p))) erros.push(`Prioridade de disciplina inválida: ${id}.`);
  if (u.timer && (!discIds.has(u.timer.disciplinaId) || (u.timer.topicoId && !topIds.has(u.timer.topicoId)))) erros.push('Cronômetro com disciplina ou conteúdo desconhecido.');
  if (!u.config || !Array.isArray(u.config.revisaoDias)) erros.push('"user.config" inválido.');
  else if (u.config.fusoHorario !== undefined && (typeof u.config.fusoHorario !== 'string' || !fusoValido(u.config.fusoHorario))) erros.push('Fuso horário inválido em "user.config".');
  if (!Array.isArray(u.historico)) erros.push('"user.historico" inválido.');
  else if (new Set(u.historico.map((e) => e?.id)).size !== u.historico.length) erros.push('Histórico com eventos de id repetido.');
  return erros.slice(0, 20);
}
