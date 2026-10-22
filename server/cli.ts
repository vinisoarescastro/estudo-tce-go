import { copyFileSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import seedJson from '../src/data/seed.json';
import type { AppData, Seed } from '../src/domain/types';
import { carregarEnv, lerConfig } from './config';
import { abrirBanco } from './db';
import { lerEdital, sincronizarEdital } from './edital';
import * as auth from './auth';
import { ServicoDados } from './servico';
import { conferirArquivoBanco, criarBackup, listarBackups, rotacionarBackups } from './backup';
import { configurarLog } from './log';
import { salvarFoto } from './foto';

// Administração pelo terminal do servidor. Só quem tem acesso à máquina consegue rodar,
// por isso é o caminho para criar a primeira conta e redefinir senhas esquecidas.

const AJUDA = `Uso: node build/cli.mjs <comando> [opções]   (ou npm run <script> -- [opções])

  usuario:criar  --email E [--nome N] [--importar backup.json]   cria uma conta (pede a senha)
  usuario:senha  --email E                                       redefine a senha e encerra as sessões
  usuario:nome   --email E --nome N                              define o nome exibido na saudação
  usuario:foto   --email E --arquivo imagem.png                  define a foto de perfil (.webp, .png ou .jpg, até 2 MB)
  usuario:listar                                                 lista as contas
  importar       --email E --arquivo backup.json                 importa um backup JSON do app
  exportar       --email E [--saida arquivo.json]                exporta os dados de estudo em JSON
  backup                                                         cria uma cópia do banco agora
  backups                                                        lista as cópias existentes
  restaurar      --arquivo copia.db --confirmar                  substitui o banco por uma cópia (pare o servidor antes)

A senha pode vir da variável SENHA (útil em scripts); sem ela, é pedida sem eco no terminal.`;

function opcoes(args: string[]): Record<string, string | true> {
  const o: Record<string, string | true> = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith('--')) continue;
    const prox = args[i + 1];
    if (prox && !prox.startsWith('--')) {
      o[a.slice(2)] = prox;
      i++;
    } else o[a.slice(2)] = true;
  }
  return o;
}

function perguntar(msg: string, oculto = false): Promise<string> {
  return new Promise((ok) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
    if (oculto && process.stdin.isTTY) {
      const escrever = (rl as unknown as { _writeToOutput: (s: string) => void });
      escrever._writeToOutput = (s: string) => {
        if (s.startsWith(msg)) process.stdout.write(msg);
        else if (s.includes('\n') || s.includes('\r')) process.stdout.write('\n');
      };
    }
    rl.question(msg, (r) => {
      rl.close();
      ok(r);
    });
  });
}

async function lerSenhaNova(email: string): Promise<string> {
  if (process.env.SENHA) return process.env.SENHA;
  for (;;) {
    const s1 = await perguntar('Nova senha (mín. 10 caracteres): ', true);
    const prob = auth.problemaNaSenha(s1, email);
    if (prob) {
      console.log(prob);
      continue;
    }
    const s2 = await perguntar('Repita a senha: ', true);
    if (s1 !== s2) {
      console.log('As senhas não conferem.');
      continue;
    }
    return s1;
  }
}

function sair(msg: string, codigo = 1): never {
  console.error(msg);
  process.exit(codigo);
}

async function main() {
  carregarEnv();
  configurarLog('erro', true);
  const cfg = lerConfig();
  const [cmd, ...resto] = process.argv.slice(2);
  const o = opcoes(resto);
  if (!cmd || cmd === 'ajuda' || cmd === '--help') return console.log(AJUDA);

  if (cmd === 'restaurar') {
    const arq = typeof o.arquivo === 'string' ? o.arquivo : sair('Informe --arquivo.');
    const prob = conferirArquivoBanco(arq);
    if (prob) sair(prob);
    if (!o.confirmar) sair('Isto substitui o banco atual. Pare o servidor e repita com --confirmar.');
    if (existsSync(cfg.arquivoBanco)) {
      const atual = abrirBanco(cfg.arquivoBanco);
      const copia = criarBackup(atual, cfg.pastaBackups, 'antes-restaurar');
      atual.close();
      console.log(`Cópia do banco atual guardada em ${copia}`);
    }
    for (const sufixo of ['-wal', '-shm']) rmSync(cfg.arquivoBanco + sufixo, { force: true });
    copyFileSync(arq, cfg.arquivoBanco);
    abrirBanco(cfg.arquivoBanco).close(); // aplica migrações pendentes, se a cópia for antiga
    return console.log(`Banco restaurado a partir de ${arq}. Inicie o servidor novamente.`);
  }

  const db = abrirBanco(cfg.arquivoBanco);
  sincronizarEdital(db, seedJson as unknown as Seed);
  const seed = lerEdital(db);
  const servico = new ServicoDados(db, seed);
  const conta = () => {
    const e = typeof o.email === 'string' ? o.email : sair('Informe --email.');
    return auth.buscarPorEmail(db, e) ?? sair(`Não existe conta com o e-mail ${e}.`);
  };
  const lerBackupJson = (arq: string): AppData => {
    if (!existsSync(arq)) sair(`Arquivo não encontrado: ${arq}`);
    try {
      return JSON.parse(readFileSync(arq, 'utf8'));
    } catch {
      return sair('O arquivo não é um JSON válido.');
    }
  };
  const importar = (usuarioId: number, arq: string) => {
    const dados = lerBackupJson(arq);
    const r = servico.aplicar(usuarioId, { acao: { t: 'importar', dados } }, () => {
      const c = criarBackup(db, cfg.pastaBackups, 'antes-substituir');
      console.log(`Cópia de segurança: ${c}`);
    });
    const d = servico.obter(usuarioId).dados.user;
    console.log(`Importado: ${d.sessoes.length} sessões, ${Object.keys(d.topicos).length} conteúdos com situação registrada, ${d.historico.length} eventos (versão ${r.versao}).`);
  };

  try {
    switch (cmd) {
      case 'usuario:criar': {
        const email = typeof o.email === 'string' ? o.email.trim().toLowerCase() : sair('Informe --email.');
        if (!auth.emailValido(email)) sair('E-mail inválido.');
        if (auth.buscarPorEmail(db, email)) sair('Já existe uma conta com esse e-mail.');
        const senha = await lerSenhaNova(email);
        const u = await auth.criarUsuario(db, { email, nome: typeof o.nome === 'string' ? o.nome : '', senha, papel: auth.contarUsuarios(db) === 0 ? 'admin' : 'usuario' });
        console.log(`Conta criada: ${u.email} (${u.papel}).`);
        if (typeof o.importar === 'string') importar(u.id, o.importar);
        break;
      }
      case 'usuario:senha': {
        const u = conta();
        await auth.definirSenha(db, u.id, await lerSenhaNova(u.email));
        console.log('Senha redefinida. Todas as sessões abertas foram encerradas.');
        break;
      }
      case 'usuario:nome': {
        const u = conta();
        const nome = typeof o.nome === 'string' ? o.nome.trim() : sair('Informe --nome.');
        if (!nome || nome.length > 80) sair('O nome deve ter de 1 a 80 caracteres.');
        db.prepare('UPDATE usuarios SET nome = ?, atualizado_em = ? WHERE id = ?').run(nome, new Date().toISOString(), u.id);
        console.log(`Nome de ${u.email} definido como "${nome}".`);
        break;
      }
      case 'usuario:foto': {
        const u = conta();
        try {
          console.log(`Foto de ${u.email} salva em ${salvarFoto(cfg.pastaDados, u.id, typeof o.arquivo === 'string' ? o.arquivo : sair('Informe --arquivo.'))}`);
        } catch (e) {
          sair((e as Error).message);
        }
        break;
      }
      case 'usuario:listar':
        for (const u of db.prepare('SELECT id, email, nome, papel, ativo, criado_em FROM usuarios ORDER BY id').all()) console.log(u);
        break;
      case 'importar':
        importar(conta().id, typeof o.arquivo === 'string' ? o.arquivo : sair('Informe --arquivo.'));
        break;
      case 'exportar': {
        const u = conta();
        const json = JSON.stringify(servico.obter(u.id).dados, null, 2);
        if (typeof o.saida === 'string') {
          writeFileSync(o.saida, json);
          console.log(`Dados exportados para ${o.saida}`);
        } else process.stdout.write(json + '\n');
        break;
      }
      case 'backup': {
        const arq = criarBackup(db, cfg.pastaBackups, 'manual');
        rotacionarBackups(cfg.pastaBackups, cfg.backupManter);
        console.log(`Cópia criada: ${arq}`);
        break;
      }
      case 'backups':
        for (const b of listarBackups(cfg.pastaBackups)) console.log(`${b.criadoEm}  ${(b.tamanho / 1024).toFixed(0).padStart(7)} KB  ${b.arquivo}`);
        break;
      default:
        sair(`Comando desconhecido: ${cmd}\n\n${AJUDA}`);
    }
  } catch (e) {
    sair(`Erro: ${(e as Error).message}`);
  } finally {
    db.close();
  }
}

main();
