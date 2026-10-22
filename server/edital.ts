import type { Seed } from '../src/domain/types';
import type { BD } from './sqlite';
import { transacao } from './db';

// Estrutura do edital no banco: núcleos, disciplinas, conteúdos, referências, dependências
// sugeridas e dados oficiais. É gravada a partir do seed.json quando a versão do seed muda
// (upsert pelos mesmos ids, sem apagar nada que os dados dos usuários referenciem).

export function sincronizarEdital(db: BD, seed: Seed): boolean {
  const atual = db.prepare("SELECT valor FROM meta WHERE chave = 'seed_versao'").get() as { valor: string } | undefined;
  if (atual && Number(atual.valor) >= seed.seedVersion) return false;
  transacao(db, () => {
    const nuc = db.prepare(`INSERT INTO nucleos (id, nome, apelido, descricao, pagina, ordem) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET nome = excluded.nome, apelido = excluded.apelido, descricao = excluded.descricao, pagina = excluded.pagina, ordem = excluded.ordem`);
    seed.nucleos.forEach((n, i) => nuc.run(n.id, n.nome, n.apelido, n.descricao, n.pagina, i));
    const disc = db.prepare(`INSERT INTO disciplinas (id, nome, nome_curto, nucleo_id, ordem_edital, paginas, texto_oficial, ordem) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET nome = excluded.nome, nome_curto = excluded.nome_curto, nucleo_id = excluded.nucleo_id, ordem_edital = excluded.ordem_edital,
        paginas = excluded.paginas, texto_oficial = excluded.texto_oficial, ordem = excluded.ordem`);
    seed.disciplinas.forEach((d, i) => disc.run(d.id, d.nome, d.nomeCurto, d.nucleo, d.ordemEdital, JSON.stringify(d.paginas), d.textoOficial, i));
    const top = db.prepare(`INSERT INTO topicos (id, numero, disciplina_id, titulo, desdobramento, prioridade_planilha, incidencia, status_planilha, ordem) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET numero = excluded.numero, disciplina_id = excluded.disciplina_id, titulo = excluded.titulo, desdobramento = excluded.desdobramento,
        prioridade_planilha = excluded.prioridade_planilha, incidencia = excluded.incidencia, status_planilha = excluded.status_planilha, ordem = excluded.ordem`);
    const ref = db.prepare(`INSERT INTO referencias (topico_id, documento, anexo, secao, disciplina, paginas, trecho, confianca) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(topico_id) DO UPDATE SET documento = excluded.documento, anexo = excluded.anexo, secao = excluded.secao, disciplina = excluded.disciplina,
        paginas = excluded.paginas, trecho = excluded.trecho, confianca = excluded.confianca`);
    seed.topicos.forEach((t, i) => {
      top.run(t.id, t.numero, t.disciplinaId, t.titulo, t.desdobramentoPlanilha ? 1 : 0, t.prioridadePlanilha, t.incidencia, t.statusPlanilha, i);
      ref.run(t.id, t.ref.documento, t.ref.anexo, t.ref.secao, t.ref.disciplina, JSON.stringify(t.ref.paginas), t.ref.trecho, t.ref.confianca);
    });
    const dep = db.prepare(`INSERT INTO dependencias_sugeridas (id, de_topico, para_topico, tipo, ordem) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET de_topico = excluded.de_topico, para_topico = excluded.para_topico, tipo = excluded.tipo, ordem = excluded.ordem`);
    seed.dependenciasSugeridas.forEach((d, i) => dep.run(d.id, d.de, d.para, d.tipo, i));
    const fato = db.prepare(`INSERT INTO fatos (id, rotulo, valor, ref, pagina, ordem) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET rotulo = excluded.rotulo, valor = excluded.valor, ref = excluded.ref, pagina = excluded.pagina, ordem = excluded.ordem`);
    seed.fatos.forEach((f, i) => fato.run(f.id, f.rotulo, f.valor, f.ref, f.pagina, i));
    const meta = db.prepare('INSERT INTO meta (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor');
    meta.run('seed_versao', String(seed.seedVersion));
    meta.run('fonte', JSON.stringify(seed.fonte));
  });
  return true;
}

type Linha = Record<string, string | number | null>;

// Reconstrói o Seed a partir do banco, na mesma ordem do arquivo original.
export function lerEdital(db: BD): Seed {
  const meta = Object.fromEntries((db.prepare('SELECT chave, valor FROM meta').all() as { chave: string; valor: string }[]).map((r) => [r.chave, r.valor]));
  if (!meta.seed_versao) throw new Error('A estrutura do edital ainda não foi gravada no banco.');
  const todas = (sql: string) => db.prepare(sql).all() as Linha[];
  return {
    seedVersion: Number(meta.seed_versao),
    fonte: JSON.parse(meta.fonte),
    nucleos: todas('SELECT * FROM nucleos ORDER BY ordem').map((r) => ({
      id: r.id as 'CG' | 'CE',
      nome: r.nome as string,
      apelido: r.apelido as string,
      descricao: r.descricao as string,
      pagina: r.pagina as number,
    })),
    disciplinas: todas('SELECT * FROM disciplinas ORDER BY ordem').map((r) => ({
      id: r.id as string,
      nome: r.nome as string,
      nomeCurto: r.nome_curto as string,
      nucleo: r.nucleo_id as 'CG' | 'CE',
      ordemEdital: r.ordem_edital as number,
      paginas: JSON.parse(r.paginas as string),
      textoOficial: r.texto_oficial as string,
    })),
    topicos: todas('SELECT t.*, r.documento, r.anexo, r.secao, r.disciplina, r.paginas, r.trecho, r.confianca FROM topicos t JOIN referencias r ON r.topico_id = t.id ORDER BY t.ordem').map((r) => ({
      id: r.id as string,
      numero: r.numero as number,
      disciplinaId: r.disciplina_id as string,
      titulo: r.titulo as string,
      desdobramentoPlanilha: r.desdobramento === 1,
      ref: {
        documento: r.documento as string,
        anexo: r.anexo as string,
        secao: r.secao as string,
        disciplina: r.disciplina as string,
        paginas: JSON.parse(r.paginas as string),
        trecho: r.trecho as string | null,
        confianca: r.confianca as 'alta' | 'media' | 'baixa',
      },
      prioridadePlanilha: r.prioridade_planilha as Seed['topicos'][number]['prioridadePlanilha'],
      incidencia: r.incidencia as string,
      statusPlanilha: r.status_planilha as string,
    })),
    dependenciasSugeridas: todas('SELECT * FROM dependencias_sugeridas ORDER BY ordem').map((r) => ({
      id: r.id as string,
      de: r.de_topico as string,
      para: r.para_topico as string,
      tipo: r.tipo as 'obrigatorio' | 'recomendado',
      origem: 'sugestao' as const,
    })),
    fatos: todas('SELECT * FROM fatos ORDER BY ordem').map((r) => ({
      id: r.id as string,
      rotulo: r.rotulo as string,
      valor: r.valor as string,
      ref: r.ref as string,
      pagina: r.pagina as number,
    })),
  };
}
