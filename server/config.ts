import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { BLOQUEIO_PADRAO, POLITICA_PADRAO, type PoliticaBloqueio, type PoliticaSessao } from './auth';

// Configuração lida das variáveis de ambiente (veja .env.example). Nenhum segredo fica no código:
// as sessões usam tokens aleatórios guardados com hash, então não há chave de assinatura.

export interface Config {
  producao: boolean;
  host: string;
  porta: number;
  pastaDados: string;
  arquivoBanco: string;
  pastaBackups: string;
  pastaWeb: string;
  cookieSeguro: boolean;
  confiarProxy: boolean;
  origensPermitidas: string[];
  sessao: PoliticaSessao;
  bloqueio: PoliticaBloqueio;
  backupIntervaloHoras: number;
  backupManter: number;
  logNivel: 'debug' | 'info' | 'aviso' | 'erro';
}

const num = (v: string | undefined, padrao: number) => (v && !Number.isNaN(Number(v)) ? Number(v) : padrao);
const bool = (v: string | undefined, padrao: boolean) => (v === undefined || v === '' ? padrao : ['1', 'true', 'sim', 'yes'].includes(v.toLowerCase()));

export function carregarEnv(arquivo = '.env'): void {
  // Node 20.12+ lê arquivos .env sem dependências. Variáveis já definidas no ambiente têm prioridade.
  if (existsSync(arquivo)) process.loadEnvFile(arquivo);
}

export function lerConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const producao = env.NODE_ENV === 'production';
  const pastaDados = resolve(env.DATA_DIR ?? 'data');
  return {
    producao,
    host: env.HOST ?? '127.0.0.1',
    porta: num(env.PORT, 3000),
    pastaDados,
    arquivoBanco: resolve(pastaDados, env.DB_FILE ?? 'estudo.db'),
    pastaBackups: resolve(env.BACKUP_DIR ?? resolve(pastaDados, 'backups')),
    pastaWeb: resolve(env.WEB_DIR ?? 'build/web'),
    // Em produção o cookie só trafega por HTTPS. Desligue apenas para testes locais sem HTTPS.
    cookieSeguro: bool(env.COOKIE_SECURE, producao),
    confiarProxy: bool(env.TRUST_PROXY, false),
    origensPermitidas: (env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    sessao: {
      inatividadeMs: num(env.SESSION_IDLE_DAYS, POLITICA_PADRAO.inatividadeMs / 864e5) * 864e5,
      maximaMs: num(env.SESSION_MAX_DAYS, POLITICA_PADRAO.maximaMs / 864e5) * 864e5,
    },
    bloqueio: {
      ...BLOQUEIO_PADRAO,
      maxPorEmail: num(env.LOGIN_MAX_FAILS_EMAIL, BLOQUEIO_PADRAO.maxPorEmail),
      maxPorIp: num(env.LOGIN_MAX_FAILS_IP, BLOQUEIO_PADRAO.maxPorIp),
      bloqueioMs: num(env.LOGIN_LOCK_MINUTES, BLOQUEIO_PADRAO.bloqueioMs / 60_000) * 60_000,
    },
    backupIntervaloHoras: num(env.BACKUP_INTERVAL_HOURS, 24),
    backupManter: num(env.BACKUP_KEEP, 14),
    logNivel: (env.LOG_LEVEL as Config['logNivel']) ?? 'info',
  };
}
