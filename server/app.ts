import { createReadStream, existsSync, statSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import type { Seed } from '../src/domain/types';
import { ErroAcao } from '../src/domain/actions';
import { limparCfg, POMODORO_PADRAO } from '../src/domain/pomodoro';
import type { BD } from './sqlite';
import { prep } from './db';
import type { Config } from './config';
import * as auth from './auth';
import { ServicoDados } from './servico';
import { acharFoto } from './foto';
import { criarBackup, rotacionarBackups } from './backup';
import { log, logErro } from './log';

export class ErroHttp extends Error {
  constructor(public status: number, msg: string, public extra: Record<string, unknown> = {}) {
    super(msg);
  }
}

// Cabeçalho exigido em toda requisição que altera dados. Navegadores não permitem que outro
// site envie cabeçalhos personalizados sem uma liberação de CORS (que não existe aqui).
export const CABECALHO_CSRF = 'x-requested-with';
export const VALOR_CSRF = 'estudo-tce-go';

const TIPOS: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

// Arquivos estáticos que só usuários autenticados podem baixar.
const ESTATICOS_PRIVADOS = new Set(['/edital.pdf']);

interface Req {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  ip: string;
  token?: string;
  usuario?: auth.Usuario;
}

export function criarApp(db: BD, seed: Seed, cfg: Config) {
  const servico = new ServicoDados(db, seed);
  const nomeCookie = cfg.cookieSeguro ? '__Host-sid' : 'sid';

  const backupAntesDeSubstituir = () => {
    try {
      criarBackup(db, cfg.pastaBackups, 'antes-substituir');
      rotacionarBackups(cfg.pastaBackups, cfg.backupManter);
    } catch (e) {
      logErro('falha no backup automático antes de substituir dados', e);
      throw new ErroHttp(500, 'Não foi possível fazer a cópia de segurança antes de substituir os dados. Nada foi alterado.');
    }
  };

  // -------------------------------------------------------------------------
  // Rotas da API

  type Rota = { metodo: string; caminho: string; privada: boolean; limite?: number; h: (r: Req, corpo: any) => unknown | Promise<unknown> };
  const rotas: Rota[] = [
    { metodo: 'GET', caminho: '/api/saude', privada: false, h: () => ({ ok: true }) },

    {
      metodo: 'POST', caminho: '/api/auth/entrar', privada: false, limite: 4096,
      h: async (r, corpo) => {
        const email = typeof corpo?.email === 'string' ? corpo.email.trim().toLowerCase() : '';
        const senha = typeof corpo?.senha === 'string' ? corpo.senha : '';
        const chaves = [`ip:${r.ip}`, `email:${email}`];
        const ate = auth.bloqueadoAte(db, chaves);
        if (ate) {
          log('aviso', 'login bloqueado', { ip: r.ip });
          throw new ErroHttp(429, `Muitas tentativas. Tente de novo em ${Math.ceil((ate - Date.now()) / 60000)} minuto(s).`);
        }
        const u = email && senha ? auth.buscarPorEmail(db, email) : null;
        const ok = await auth.conferirSenha(senha || 'x', u?.senhaHash ?? (await auth.hashParaComparacaoFalsa()));
        if (!u || !ok || !u.ativo) {
          auth.registrarFalha(db, `ip:${r.ip}`, cfg.bloqueio.maxPorIp, cfg.bloqueio);
          if (email) auth.registrarFalha(db, `email:${email}`, cfg.bloqueio.maxPorEmail, cfg.bloqueio);
          log('aviso', 'login recusado', { ip: r.ip });
          throw new ErroHttp(401, 'E-mail ou senha incorretos.');
        }
        auth.limparFalhas(db, `email:${email}`);
        const token = auth.criarSessao(db, u.id, { ip: r.ip, agente: String(r.req.headers['user-agent'] ?? '') }, cfg.sessao);
        definirCookie(r.res, token);
        log('info', 'login', { usuario: u.id, ip: r.ip });
        return { usuario: publico(auth.buscarUsuario(db, u.id)!) };
      },
    },
    {
      metodo: 'POST', caminho: '/api/auth/sair', privada: false,
      h: (r) => {
        if (r.token) auth.encerrarSessao(db, r.token);
        limparCookie(r.res);
        return { ok: true };
      },
    },
    { metodo: 'GET', caminho: '/api/auth/eu', privada: true, h: (r) => ({ usuario: publico(r.usuario!) }) },
    { metodo: 'GET', caminho: '/api/auth/sessoes', privada: true, h: (r) => ({ sessoes: auth.listarSessoes(db, r.usuario!.id, r.token!) }) },
    { metodo: 'POST', caminho: '/api/auth/encerrar-outras', privada: true, h: (r) => ({ encerradas: auth.encerrarOutrasSessoes(db, r.usuario!.id, r.token!) }) },
    {
      metodo: 'POST', caminho: '/api/auth/senha', privada: true, limite: 4096,
      h: async (r, corpo) => {
        const u = auth.buscarPorEmail(db, r.usuario!.email)!;
        const chave = `senha:${u.id}`;
        if (auth.bloqueadoAte(db, [chave])) throw new ErroHttp(429, 'Muitas tentativas com a senha atual errada. Aguarde alguns minutos.');
        if (!(await auth.conferirSenha(String(corpo?.atual ?? ''), u.senhaHash))) {
          auth.registrarFalha(db, chave, cfg.bloqueio.maxPorEmail, cfg.bloqueio);
          throw new ErroHttp(400, 'A senha atual está incorreta.');
        }
        try {
          await auth.definirSenha(db, u.id, String(corpo?.nova ?? ''), r.token);
        } catch (e) {
          throw new ErroHttp(400, (e as Error).message);
        }
        auth.limparFalhas(db, chave);
        log('info', 'senha alterada', { usuario: u.id });
        return { ok: true };
      },
    },

    { metodo: 'GET', caminho: '/api/edital', privada: true, h: () => seed },
    {
      metodo: 'GET', caminho: '/api/dados', privada: true,
      h: (r) => {
        const c = servico.obter(r.usuario!.id);
        if (r.url.searchParams.get('versao') === String(c.versao)) return { versao: c.versao, inalterado: true };
        return { versao: c.versao, dados: c.dados };
      },
    },
    {
      metodo: 'POST', caminho: '/api/acoes', privada: true, limite: 25 * 1024 * 1024,
      h: (r, corpo) => servico.aplicar(r.usuario!.id, corpo ?? {}, backupAntesDeSubstituir),
    },
    {
      metodo: 'GET', caminho: '/api/exportar', privada: true,
      h: (r) => {
        const { dados } = servico.obter(r.usuario!.id);
        r.res.setHeader('Content-Disposition', `attachment; filename="estudo-tce-go-backup-${servico.hoje(r.usuario!.id)}.json"`);
        return dados;
      },
    },
    {
      // A foto só é entregue ao próprio dono, depois do login.
      metodo: 'GET', caminho: '/api/perfil/foto', privada: true,
      h: (r) => {
        const foto = acharFoto(cfg.pastaDados, r.usuario!.id);
        if (!foto) throw new ErroHttp(404, 'Sem foto de perfil.');
        r.res.writeHead(200, { 'Content-Type': foto.tipo, 'Content-Length': statSync(foto.arquivo).size, 'Cache-Control': 'private, max-age=86400' });
        if (r.req.method === 'HEAD') r.res.end();
        else createReadStream(foto.arquivo).pipe(r.res);
      },
    },
    {
      metodo: 'GET', caminho: '/api/preferencias', privada: true,
      h: (r) => lerPreferencias(r.usuario!.id),
    },
    {
      metodo: 'PUT', caminho: '/api/preferencias', privada: true, limite: 2048,
      h: (r, corpo) => {
        const atual = lerPreferencias(r.usuario!.id);
        const tema = corpo?.tema ?? atual.tema;
        const menuRecolhido = corpo?.menuRecolhido ?? atual.menuRecolhido;
        if (!['sistema', 'claro', 'escuro'].includes(tema) || typeof menuRecolhido !== 'boolean') throw new ErroHttp(400, 'Preferência inválida.');
        if (corpo?.pomodoro !== undefined && (typeof corpo.pomodoro !== 'object' || corpo.pomodoro === null)) throw new ErroHttp(400, 'Preferência inválida.');
        // Os tempos do pomodoro são corrigidos para a faixa permitida em vez de recusados.
        const pomodoro = limparCfg({ ...atual.pomodoro, ...(corpo?.pomodoro ?? {}) });
        prep(db, `INSERT INTO preferencias (usuario_id, tema, menu_recolhido, pomodoro) VALUES (?, ?, ?, ?)
          ON CONFLICT(usuario_id) DO UPDATE SET tema = excluded.tema, menu_recolhido = excluded.menu_recolhido, pomodoro = excluded.pomodoro`).run(r.usuario!.id, tema, menuRecolhido ? 1 : 0, JSON.stringify(pomodoro));
        return lerPreferencias(r.usuario!.id);
      },
    },
  ];

  function lerPreferencias(usuarioId: number) {
    const p = prep(db, 'SELECT tema, menu_recolhido, pomodoro FROM preferencias WHERE usuario_id = ?').get(usuarioId) as { tema: string; menu_recolhido: number; pomodoro: string } | undefined;
    let pomodoro = POMODORO_PADRAO;
    try {
      if (p?.pomodoro) pomodoro = limparCfg(JSON.parse(p.pomodoro));
    } catch {
      /* valor ilegível: volta ao padrão */
    }
    return { tema: (p?.tema ?? 'sistema') as 'sistema' | 'claro' | 'escuro', menuRecolhido: p?.menu_recolhido === 1, pomodoro };
  }

  const publico = (u: auth.Usuario) => ({ id: u.id, email: u.email, nome: u.nome, papel: u.papel, criadoEm: u.criadoEm, senhaAlteradaEm: u.senhaAlteradaEm, foto: acharFoto(cfg.pastaDados, u.id)?.versao ?? null });

  // -------------------------------------------------------------------------
  // Cookies

  function definirCookie(res: ServerResponse, token: string) {
    const partes = [`${nomeCookie}=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${Math.floor(cfg.sessao.maximaMs / 1000)}`];
    if (cfg.cookieSeguro) partes.push('Secure');
    res.setHeader('Set-Cookie', partes.join('; '));
  }
  function limparCookie(res: ServerResponse) {
    res.setHeader('Set-Cookie', `${nomeCookie}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${cfg.cookieSeguro ? '; Secure' : ''}`);
  }
  function lerCookie(req: IncomingMessage): string | undefined {
    for (const parte of (req.headers.cookie ?? '').split(';')) {
      const [k, ...v] = parte.trim().split('=');
      if (k === nomeCookie) return v.join('=');
    }
    return undefined;
  }

  // -------------------------------------------------------------------------
  // Requisições

  function ipDe(req: IncomingMessage): string {
    if (cfg.confiarProxy) {
      // O último endereço é o que o nosso proxy acrescentou; os anteriores vêm do cliente e podem ser forjados.
      const xff = String(req.headers['x-forwarded-for'] ?? '').split(',').map((x) => x.trim()).filter(Boolean).pop();
      if (xff) return xff;
    }
    return req.socket.remoteAddress ?? '';
  }

  function cabecalhosSeguranca(res: ServerResponse) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'",
    );
    if (cfg.cookieSeguro) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  function enviarJson(res: ServerResponse, status: number, corpo: unknown) {
    const txt = JSON.stringify(corpo);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(txt);
  }

  async function lerCorpo(req: IncomingMessage, limite: number): Promise<unknown> {
    const tipo = String(req.headers['content-type'] ?? '');
    if (!tipo.startsWith('application/json')) throw new ErroHttp(415, 'Envie os dados em JSON.');
    const declarado = Number(req.headers['content-length'] ?? 0);
    if (declarado > limite) throw new ErroHttp(413, 'Conteúdo grande demais.');
    const partes: Buffer[] = [];
    let total = 0;
    for await (const p of req) {
      total += (p as Buffer).length;
      if (total > limite) throw new ErroHttp(413, 'Conteúdo grande demais.');
      partes.push(p as Buffer);
    }
    if (!total) return {};
    try {
      return JSON.parse(Buffer.concat(partes).toString('utf8'));
    } catch {
      throw new ErroHttp(400, 'JSON inválido.');
    }
  }

  // Bloqueia requisições de alteração vindas de outros sites (CSRF).
  function conferirOrigem(req: IncomingMessage) {
    if (req.headers[CABECALHO_CSRF] !== VALOR_CSRF) throw new ErroHttp(403, 'Requisição recusada.');
    const origem = req.headers.origin;
    if (!origem) return;
    let host: string;
    try {
      host = new URL(origem).host;
    } catch {
      throw new ErroHttp(403, 'Origem inválida.');
    }
    const esperado = cfg.confiarProxy ? String(req.headers['x-forwarded-host'] ?? req.headers.host) : req.headers.host;
    if (host !== esperado && !cfg.origensPermitidas.includes(origem)) throw new ErroHttp(403, 'Origem não permitida.');
  }

  function autenticar(r: Req) {
    r.token = lerCookie(r.req);
    const u = auth.validarSessao(db, r.token, cfg.sessao);
    if (u) r.usuario = u;
  }

  async function api(r: Req) {
    const doCaminho = rotas.filter((x) => x.caminho === r.url.pathname);
    if (!doCaminho.length) throw new ErroHttp(404, 'Endereço da API não encontrado.');
    const rota = doCaminho.find((x) => x.metodo === r.req.method);
    if (!rota) throw new ErroHttp(405, 'Método não permitido.');
    const altera = r.req.method !== 'GET' && r.req.method !== 'HEAD';
    if (altera) conferirOrigem(r.req);
    autenticar(r);
    if (rota.privada && !r.usuario) {
      if (r.token) limparCookie(r.res);
      throw new ErroHttp(401, 'Sessão expirada ou inexistente. Entre novamente.');
    }
    const corpo = altera ? await lerCorpo(r.req, rota.limite ?? 64 * 1024) : undefined;
    const out = await rota.h(r, corpo);
    if (!r.res.headersSent) enviarJson(r.res, 200, out);
  }

  // -------------------------------------------------------------------------
  // Frontend (arquivos de build/web)

  const raizWeb = resolve(cfg.pastaWeb);
  function estatico(r: Req) {
    if (r.req.method !== 'GET' && r.req.method !== 'HEAD') throw new ErroHttp(405, 'Método não permitido.');
    let caminho = decodeURIComponent(r.url.pathname);
    if (ESTATICOS_PRIVADOS.has(caminho)) {
      autenticar(r);
      if (!r.usuario) {
        r.res.writeHead(401, { 'Content-Type': 'text/plain; charset=utf-8' });
        r.res.end('Entre na plataforma para consultar o edital.');
        return;
      }
    }
    if (caminho.endsWith('/')) caminho += 'index.html';
    let arquivo = normalize(join(raizWeb, caminho));
    if (arquivo !== raizWeb && !arquivo.startsWith(raizWeb + sep)) throw new ErroHttp(404, 'Não encontrado.');
    if (!existsSync(arquivo) || !statSync(arquivo).isFile()) {
      // Rotas da aplicação (sem extensão) devolvem o index.html.
      if (extname(caminho)) throw new ErroHttp(404, 'Não encontrado.');
      arquivo = join(raizWeb, 'index.html');
      if (!existsSync(arquivo)) throw new ErroHttp(503, 'O frontend ainda não foi gerado. Rode "npm run build".');
    }
    const ext = extname(arquivo);
    // O visualizador de PDF do navegador é um plugin: a CSP da aplicação (object-src 'none') o bloquearia.
    if (ext === '.pdf') r.res.removeHeader('Content-Security-Policy');
    const imutavel = arquivo.startsWith(join(raizWeb, 'assets') + sep);
    r.res.writeHead(200, {
      'Content-Type': TIPOS[ext] ?? 'application/octet-stream',
      'Content-Length': statSync(arquivo).size,
      'Cache-Control': imutavel ? 'public, max-age=31536000, immutable' : ESTATICOS_PRIVADOS.has(caminho) ? 'private, max-age=3600' : 'no-cache',
    });
    if (r.req.method === 'HEAD') return r.res.end();
    createReadStream(arquivo).pipe(r.res);
  }

  // -------------------------------------------------------------------------

  return async function tratar(req: IncomingMessage, res: ServerResponse) {
    const inicio = Date.now();
    const url = new URL(req.url ?? '/', 'http://local');
    const r: Req = { req, res, url, ip: ipDe(req) };
    res.on('finish', () => {
      const nivel = url.pathname.startsWith('/api/') ? (res.statusCode >= 500 ? 'erro' : 'info') : 'debug';
      log(nivel, 'requisição', { metodo: req.method, caminho: url.pathname, status: res.statusCode, ms: Date.now() - inicio, usuario: r.usuario?.id });
    });
    cabecalhosSeguranca(res);
    try {
      if (url.pathname.startsWith('/api/')) await api(r);
      else estatico(r);
    } catch (e) {
      if (res.headersSent) {
        res.destroy();
      } else if (e instanceof ErroHttp) {
        enviarJson(res, e.status, { erro: e.message, ...e.extra });
      } else if (e instanceof ErroAcao) {
        enviarJson(res, 422, { erro: e.message });
      } else {
        logErro('erro não tratado', e, { metodo: req.method, caminho: url.pathname });
        enviarJson(res, 500, { erro: 'Erro interno. Tente novamente; se persistir, consulte os logs do servidor.' });
      }
    }
  };
}
