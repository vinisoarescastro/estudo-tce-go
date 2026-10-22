import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync, type BD } from './sqlite';

// Migrações de esquema, aplicadas em ordem e registradas em schema_migracoes.
// Nunca altere uma migração já publicada: crie uma nova com a próxima versão.
export const MIGRACOES: { versao: number; nome: string; sql: string }[] = [
  {
    versao: 1,
    nome: 'esquema inicial',
    sql: `
      -- Contas e acesso
      CREATE TABLE usuarios (
        id INTEGER PRIMARY KEY,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        nome TEXT NOT NULL DEFAULT '',
        senha_hash TEXT NOT NULL,
        papel TEXT NOT NULL DEFAULT 'admin' CHECK (papel IN ('admin', 'usuario')),
        ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
        versao_dados INTEGER NOT NULL DEFAULT 0,
        senha_alterada_em TEXT NOT NULL,
        criado_em TEXT NOT NULL,
        atualizado_em TEXT NOT NULL
      );
      CREATE TABLE sessoes_login (
        token_hash TEXT PRIMARY KEY,
        usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        criada_em TEXT NOT NULL,
        ultimo_uso TEXT NOT NULL,
        expira_em TEXT NOT NULL,
        ip TEXT NOT NULL DEFAULT '',
        agente TEXT NOT NULL DEFAULT ''
      );
      CREATE INDEX ix_sessoes_login_usuario ON sessoes_login(usuario_id);
      CREATE TABLE tentativas_login (
        chave TEXT PRIMARY KEY,
        falhas INTEGER NOT NULL,
        primeira_em INTEGER NOT NULL,
        bloqueado_ate INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE preferencias (
        usuario_id INTEGER PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
        tema TEXT NOT NULL DEFAULT 'sistema' CHECK (tema IN ('sistema', 'claro', 'escuro')),
        menu_recolhido INTEGER NOT NULL DEFAULT 0 CHECK (menu_recolhido IN (0, 1))
      );

      -- Estrutura do edital (vem de src/data/seed.json e é sincronizada na inicialização)
      CREATE TABLE meta (chave TEXT PRIMARY KEY, valor TEXT NOT NULL);
      CREATE TABLE nucleos (
        id TEXT PRIMARY KEY,
        nome TEXT NOT NULL,
        apelido TEXT NOT NULL,
        descricao TEXT NOT NULL,
        pagina INTEGER NOT NULL,
        ordem INTEGER NOT NULL
      );
      CREATE TABLE disciplinas (
        id TEXT PRIMARY KEY,
        nome TEXT NOT NULL,
        nome_curto TEXT NOT NULL,
        nucleo_id TEXT NOT NULL REFERENCES nucleos(id),
        ordem_edital INTEGER NOT NULL,
        paginas TEXT NOT NULL,
        texto_oficial TEXT NOT NULL,
        ordem INTEGER NOT NULL
      );
      CREATE TABLE topicos (
        id TEXT PRIMARY KEY,
        numero INTEGER NOT NULL,
        disciplina_id TEXT NOT NULL REFERENCES disciplinas(id),
        titulo TEXT NOT NULL,
        desdobramento INTEGER NOT NULL,
        prioridade_planilha TEXT NOT NULL,
        incidencia TEXT NOT NULL,
        status_planilha TEXT NOT NULL,
        ordem INTEGER NOT NULL
      );
      CREATE INDEX ix_topicos_disciplina ON topicos(disciplina_id);
      CREATE TABLE referencias (
        topico_id TEXT PRIMARY KEY REFERENCES topicos(id),
        documento TEXT NOT NULL,
        anexo TEXT NOT NULL,
        secao TEXT NOT NULL,
        disciplina TEXT NOT NULL,
        paginas TEXT NOT NULL,
        trecho TEXT,
        confianca TEXT NOT NULL CHECK (confianca IN ('alta', 'media', 'baixa'))
      );
      CREATE TABLE dependencias_sugeridas (
        id TEXT PRIMARY KEY,
        de_topico TEXT NOT NULL REFERENCES topicos(id),
        para_topico TEXT NOT NULL REFERENCES topicos(id),
        tipo TEXT NOT NULL CHECK (tipo IN ('obrigatorio', 'recomendado')),
        ordem INTEGER NOT NULL
      );
      CREATE TABLE fatos (
        id TEXT PRIMARY KEY,
        rotulo TEXT NOT NULL,
        valor TEXT NOT NULL,
        ref TEXT NOT NULL,
        pagina INTEGER NOT NULL,
        ordem INTEGER NOT NULL
      );

      -- Dados de estudo de cada usuário
      CREATE TABLE configuracoes (
        usuario_id INTEGER PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
        meta_diaria_min INTEGER NOT NULL,
        meta_semanal_min INTEGER NOT NULL,
        duracao_padrao_min INTEGER NOT NULL,
        revisao_dias TEXT NOT NULL,
        data_prova TEXT NOT NULL DEFAULT '',
        fuso_horario TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
        schema_dados INTEGER NOT NULL DEFAULT 1,
        seed_versao INTEGER NOT NULL
      );
      CREATE TABLE ciclos (
        usuario_id INTEGER PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
        proximo_item_id TEXT,
        numero INTEGER NOT NULL
      );
      CREATE TABLE ciclo_itens (
        usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        id TEXT NOT NULL,
        posicao INTEGER NOT NULL,
        disciplina_id TEXT NOT NULL REFERENCES disciplinas(id),
        minutos INTEGER NOT NULL,
        ativo INTEGER NOT NULL CHECK (ativo IN (0, 1)),
        PRIMARY KEY (usuario_id, id)
      );
      CREATE TABLE estados_topico (
        usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        topico_id TEXT NOT NULL REFERENCES topicos(id),
        status TEXT NOT NULL CHECK (status IN ('nao_iniciado', 'em_andamento', 'estudado', 'em_revisao')),
        dominado INTEGER NOT NULL CHECK (dominado IN (0, 1)),
        prioridade TEXT CHECK (prioridade IN ('Urgente', 'Alta', 'Média', 'Baixa')),
        notas TEXT NOT NULL DEFAULT '',
        concluido_em TEXT,
        ultimo_estudo TEXT,
        revisoes_feitas INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (usuario_id, topico_id)
      );
      CREATE TABLE prioridades_disciplina (
        usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        disciplina_id TEXT NOT NULL REFERENCES disciplinas(id),
        prioridade TEXT NOT NULL CHECK (prioridade IN ('Urgente', 'Alta', 'Média', 'Baixa')),
        PRIMARY KEY (usuario_id, disciplina_id)
      );
      CREATE TABLE dependencias (
        usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        id TEXT NOT NULL,
        posicao INTEGER NOT NULL,
        de_topico TEXT NOT NULL REFERENCES topicos(id),
        para_topico TEXT NOT NULL REFERENCES topicos(id),
        tipo TEXT NOT NULL CHECK (tipo IN ('obrigatorio', 'recomendado')),
        origem TEXT NOT NULL CHECK (origem IN ('sugestao', 'usuario')),
        PRIMARY KEY (usuario_id, id)
      );
      CREATE TABLE sessoes_estudo (
        usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        id TEXT NOT NULL,
        seq INTEGER NOT NULL,
        data TEXT NOT NULL,
        disciplina_id TEXT NOT NULL REFERENCES disciplinas(id),
        topico_id TEXT REFERENCES topicos(id),
        planejado_min INTEGER NOT NULL CHECK (planejado_min >= 0),
        realizado_min INTEGER NOT NULL CHECK (realizado_min >= 0),
        notas TEXT NOT NULL DEFAULT '',
        origem TEXT NOT NULL CHECK (origem IN ('cronometro', 'manual')),
        ciclo_item_id TEXT,
        criado_em TEXT NOT NULL,
        atualizado_em TEXT NOT NULL,
        PRIMARY KEY (usuario_id, id)
      );
      CREATE INDEX ix_sessoes_estudo_data ON sessoes_estudo(usuario_id, data);
      CREATE TABLE cronometros (
        usuario_id INTEGER PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
        id TEXT NOT NULL,
        disciplina_id TEXT NOT NULL REFERENCES disciplinas(id),
        topico_id TEXT REFERENCES topicos(id),
        ciclo_item_id TEXT,
        planejado_min INTEGER NOT NULL,
        iniciado_em INTEGER NOT NULL,
        acumulado_ms INTEGER NOT NULL,
        rodando_desde INTEGER
      );
      CREATE TABLE historico (
        usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        id TEXT NOT NULL,
        seq INTEGER NOT NULL,
        ts TEXT NOT NULL,
        tipo TEXT NOT NULL,
        descricao TEXT NOT NULL,
        topico_id TEXT,
        disciplina_id TEXT,
        PRIMARY KEY (usuario_id, id)
      );
      CREATE INDEX ix_historico_seq ON historico(usuario_id, seq);
    `,
  },
  {
    versao: 2,
    nome: 'tempos do pomodoro nas preferencias',
    sql: `ALTER TABLE preferencias ADD COLUMN pomodoro TEXT NOT NULL DEFAULT '';`,
  },
];

export function abrirBanco(caminho: string): BD {
  if (caminho !== ':memory:') mkdirSync(dirname(caminho), { recursive: true });
  const db = new DatabaseSync(caminho);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA synchronous = NORMAL;');
  migrar(db);
  return db;
}

export function migrar(db: BD): number[] {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migracoes (versao INTEGER PRIMARY KEY, nome TEXT NOT NULL, aplicada_em TEXT NOT NULL)');
  const feitas = new Set((db.prepare('SELECT versao FROM schema_migracoes').all() as { versao: number }[]).map((r) => r.versao));
  const aplicadas: number[] = [];
  for (const m of MIGRACOES) {
    if (feitas.has(m.versao)) continue;
    transacao(db, () => {
      db.exec(m.sql);
      db.prepare('INSERT INTO schema_migracoes (versao, nome, aplicada_em) VALUES (?, ?, ?)').run(m.versao, m.nome, new Date().toISOString());
    });
    aplicadas.push(m.versao);
  }
  return aplicadas;
}

// Cache de comandos preparados por conexão (a gravação de uma importação roda milhares deles).
const cacheComandos = new WeakMap<BD, Map<string, ReturnType<BD['prepare']>>>();
export function prep(db: BD, sql: string): ReturnType<BD['prepare']> {
  let m = cacheComandos.get(db);
  if (!m) cacheComandos.set(db, (m = new Map()));
  let st = m.get(sql);
  if (!st) m.set(sql, (st = db.prepare(sql)));
  return st;
}

// Executa fn numa transação; desfaz tudo se algo falhar.
export function transacao<T>(db: BD, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
