import type { CargoInfo, Seed } from '../src/domain/types';
import type { BD } from './sqlite';
import { transacao } from './db';

// Estrutura do edital no banco: núcleos, disciplinas, conteúdos, referências, dependências
// sugeridas e dados oficiais. Cada cargo tem o seu edital (seed). Ela é gravada a partir do
// seed quando a versão do seed muda (upsert pelos mesmos ids, sem apagar nada que os dados
// dos usuários referenciem). Os núcleos Conhecimentos Gerais e Específicos são compartilhados;
// o texto e a página de cada um ficam por cargo (cargo_nucleos).

type Linha = Record<string, string | number | null>;

export function sincronizarEdital(db: BD, seed: Seed): boolean {
  const cargo = seed.cargo;
  if (!cargo) throw new Error('O seed do edital precisa informar o cargo (bloco "cargo").');

  // Dados do cargo: gravados sempre (são baratos e não mexem nos dados de estudo).
  db.prepare(`INSERT INTO cargos (id, codigo, nome, nome_curto, escolaridade, data_prova, meta_diaria_min, meta_semanal_min, duracao_padrao_min, ciclo_inicial, fonte)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET codigo = excluded.codigo, nome = excluded.nome, nome_curto = excluded.nome_curto, escolaridade = excluded.escolaridade,
      data_prova = excluded.data_prova, meta_diaria_min = excluded.meta_diaria_min, meta_semanal_min = excluded.meta_semanal_min,
      duracao_padrao_min = excluded.duracao_padrao_min, ciclo_inicial = excluded.ciclo_inicial, fonte = excluded.fonte`)
    .run(cargo.id, cargo.codigo, cargo.nome, cargo.nomeCurto, cargo.escolaridade, cargo.dataProva, cargo.metaDiariaMin, cargo.metaSemanalMin, cargo.duracaoPadraoMin,
      JSON.stringify(cargo.cicloInicial), JSON.stringify(seed.fonte));

  const atual = db.prepare('SELECT seed_versao FROM cargos WHERE id = ?').get(cargo.id) as { seed_versao: number };
  if (atual.seed_versao >= seed.seedVersion) return false;

  transacao(db, () => {
    const nuc = db.prepare(`INSERT INTO nucleos (id, nome, apelido, descricao, pagina, ordem) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET nome = excluded.nome, apelido = excluded.apelido, ordem = excluded.ordem`);
    const cnuc = db.prepare(`INSERT INTO cargo_nucleos (cargo_id, nucleo_id, descricao, pagina) VALUES (?, ?, ?, ?)
      ON CONFLICT(cargo_id, nucleo_id) DO UPDATE SET descricao = excluded.descricao, pagina = excluded.pagina`);
    seed.nucleos.forEach((n, i) => {
      nuc.run(n.id, n.nome, n.apelido, n.descricao, n.pagina, i);
      cnuc.run(cargo.id, n.id, n.descricao, n.pagina);
    });
    const disc = db.prepare(`INSERT INTO disciplinas (id, nome, nome_curto, nucleo_id, ordem_edital, paginas, texto_oficial, ordem, cargo_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET nome = excluded.nome, nome_curto = excluded.nome_curto, nucleo_id = excluded.nucleo_id, ordem_edital = excluded.ordem_edital,
        paginas = excluded.paginas, texto_oficial = excluded.texto_oficial, ordem = excluded.ordem, cargo_id = excluded.cargo_id`);
    seed.disciplinas.forEach((d, i) => disc.run(d.id, d.nome, d.nomeCurto, d.nucleo, d.ordemEdital, JSON.stringify(d.paginas), d.textoOficial, i, cargo.id));
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
    const fato = db.prepare(`INSERT INTO fatos (id, rotulo, valor, ref, pagina, ordem, cargo_id) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET rotulo = excluded.rotulo, valor = excluded.valor, ref = excluded.ref, pagina = excluded.pagina, ordem = excluded.ordem, cargo_id = excluded.cargo_id`);
    seed.fatos.forEach((f, i) => fato.run(f.id, f.rotulo, f.valor, f.ref, f.pagina, i, cargo.id));
    db.prepare('UPDATE cargos SET seed_versao = ? WHERE id = ?').run(seed.seedVersion, cargo.id);
    // Compatibilidade com versões anteriores do servidor, que liam a versão do edital daqui.
    if (cargo.id === 'B02') {
      const meta = db.prepare('INSERT INTO meta (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor');
      meta.run('seed_versao', String(seed.seedVersion));
      meta.run('fonte', JSON.stringify(seed.fonte));
    }
  });
  return true;
}

export interface CargoResumo { id: string; codigo: string; nome: string; nomeCurto: string }

// Cargos que já têm o edital gravado (podem receber contas).
export function listarCargos(db: BD): CargoResumo[] {
  return (db.prepare('SELECT id, codigo, nome, nome_curto FROM cargos WHERE seed_versao > 0 ORDER BY id').all() as Linha[]).map((r) => ({
    id: r.id as string, codigo: r.codigo as string, nome: r.nome as string, nomeCurto: r.nome_curto as string,
  }));
}

export function cargoExiste(db: BD, cargoId: string): boolean {
  return !!db.prepare('SELECT 1 FROM cargos WHERE id = ? AND seed_versao > 0').get(cargoId);
}

// Reconstrói o Seed de um cargo a partir do banco, na mesma ordem do arquivo original.
export function lerEdital(db: BD, cargoId = 'B02'): Seed {
  const c = db.prepare('SELECT * FROM cargos WHERE id = ?').get(cargoId) as Linha | undefined;
  if (!c || !c.seed_versao) throw new Error(`A estrutura do edital do cargo ${cargoId} ainda não foi gravada no banco.`);
  const todas = (sql: string) => db.prepare(sql).all(cargoId) as Linha[];
  const cargo: CargoInfo = {
    id: c.id as string,
    codigo: c.codigo as string,
    nome: c.nome as string,
    nomeCurto: c.nome_curto as string,
    escolaridade: c.escolaridade as string,
    dataProva: c.data_prova as string,
    metaDiariaMin: c.meta_diaria_min as number,
    metaSemanalMin: c.meta_semanal_min as number,
    duracaoPadraoMin: c.duracao_padrao_min as number,
    cicloInicial: JSON.parse(c.ciclo_inicial as string),
  };
  return {
    seedVersion: c.seed_versao as number,
    cargo,
    fonte: JSON.parse(c.fonte as string),
    nucleos: todas(`SELECT n.id, n.nome, n.apelido, cn.descricao, cn.pagina FROM cargo_nucleos cn JOIN nucleos n ON n.id = cn.nucleo_id WHERE cn.cargo_id = ? ORDER BY n.ordem`).map((r) => ({
      id: r.id as 'CG' | 'CE',
      nome: r.nome as string,
      apelido: r.apelido as string,
      descricao: r.descricao as string,
      pagina: r.pagina as number,
    })),
    disciplinas: todas('SELECT * FROM disciplinas WHERE cargo_id = ? ORDER BY ordem').map((r) => ({
      id: r.id as string,
      nome: r.nome as string,
      nomeCurto: r.nome_curto as string,
      nucleo: r.nucleo_id as 'CG' | 'CE',
      ordemEdital: r.ordem_edital as number,
      paginas: JSON.parse(r.paginas as string),
      textoOficial: r.texto_oficial as string,
    })),
    topicos: todas(`SELECT t.*, r.documento, r.anexo, r.secao, r.disciplina, r.paginas, r.trecho, r.confianca
      FROM topicos t JOIN referencias r ON r.topico_id = t.id JOIN disciplinas d ON d.id = t.disciplina_id WHERE d.cargo_id = ? ORDER BY t.ordem`).map((r) => ({
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
    dependenciasSugeridas: todas(`SELECT s.* FROM dependencias_sugeridas s JOIN topicos t ON t.id = s.para_topico JOIN disciplinas d ON d.id = t.disciplina_id
      WHERE d.cargo_id = ? ORDER BY s.ordem`).map((r) => ({
      id: r.id as string,
      de: r.de_topico as string,
      para: r.para_topico as string,
      tipo: r.tipo as 'obrigatorio' | 'recomendado',
      origem: 'sugestao' as const,
    })),
    fatos: todas('SELECT * FROM fatos WHERE cargo_id = ? ORDER BY ordem').map((r) => ({
      id: r.id as string,
      rotulo: r.rotulo as string,
      valor: r.valor as string,
      ref: r.ref as string,
      pagina: r.pagina as number,
    })),
  };
}
