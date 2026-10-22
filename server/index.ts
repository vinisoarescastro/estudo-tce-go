import { createServer } from 'node:http';
import seedJson from '../src/data/seed.json';
import type { Seed } from '../src/domain/types';
import { carregarEnv, lerConfig } from './config';
import { abrirBanco } from './db';
import { lerEdital, sincronizarEdital } from './edital';
import { criarApp } from './app';
import { contarUsuarios } from './auth';
import { criarBackup, listarBackups, rotacionarBackups } from './backup';
import { configurarLog, log, logErro } from './log';

carregarEnv();
const cfg = lerConfig();
configurarLog(cfg.logNivel);

const db = abrirBanco(cfg.arquivoBanco);
if (sincronizarEdital(db, seedJson as unknown as Seed)) log('info', 'estrutura do edital gravada no banco', { seedVersion: (seedJson as { seedVersion: number }).seedVersion });
const seed = lerEdital(db);

if (cfg.producao && !cfg.cookieSeguro) log('aviso', 'COOKIE_SECURE está desligado em produção: o login só deve trafegar por HTTPS.');
if (contarUsuarios(db) === 0) log('aviso', 'Nenhuma conta cadastrada. Crie a primeira com: npm run usuario:criar -- --email voce@exemplo.com');

const servidor = createServer(criarApp(db, seed, cfg));
servidor.requestTimeout = 60_000;
servidor.headersTimeout = 20_000;
servidor.keepAliveTimeout = 5_000;

// Backup automático: na inicialização (se o último tiver passado do intervalo) e depois periodicamente.
function backupAgendado() {
  try {
    const ultimo = listarBackups(cfg.pastaBackups).find((b) => b.arquivo.endsWith('-auto.db'));
    if (ultimo && Date.now() - Date.parse(ultimo.criadoEm) < cfg.backupIntervaloHoras * 3600_000 * 0.9) return;
    const arq = criarBackup(db, cfg.pastaBackups, 'auto');
    const removidos = rotacionarBackups(cfg.pastaBackups, cfg.backupManter);
    log('info', 'backup automático criado', { arquivo: arq, removidos: removidos.length });
  } catch (e) {
    logErro('falha no backup automático', e);
  }
}
let timerBackup: NodeJS.Timeout | undefined;
if (cfg.backupIntervaloHoras > 0) {
  backupAgendado();
  timerBackup = setInterval(backupAgendado, Math.min(cfg.backupIntervaloHoras, 6) * 3600_000);
  timerBackup.unref();
}

servidor.listen(cfg.porta, cfg.host, () => {
  log('info', 'servidor iniciado', { endereco: `http://${cfg.host}:${cfg.porta}`, banco: cfg.arquivoBanco, producao: cfg.producao });
});

function encerrar(sinal: string) {
  log('info', 'encerrando', { sinal });
  clearInterval(timerBackup);
  servidor.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => encerrar('SIGTERM'));
process.on('SIGINT', () => encerrar('SIGINT'));
process.on('unhandledRejection', (e) => logErro('promessa rejeitada sem tratamento', e));
