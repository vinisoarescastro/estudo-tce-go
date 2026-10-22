import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import type { BD } from './sqlite';
import { prep } from './db';

// Senhas: scrypt (memória alta, resistente a força bruta em GPU) com sal aleatório.
// Formato guardado: scrypt$N$r$p$sal$hash (base64url).
const N = 2 ** 15, R = 8, P = 1, TAM = 64;

function scrypt(senha: string, sal: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  const opts: ScryptOptions = { N: n, r, p, maxmem: 128 * n * r * 2 };
  return new Promise((ok, erro) => scryptCb(senha.normalize('NFKC'), sal, TAM, opts, (e, k) => (e ? erro(e) : ok(k))));
}

export async function gerarHashSenha(senha: string): Promise<string> {
  const sal = randomBytes(16);
  const k = await scrypt(senha, sal, N, R, P);
  return `scrypt$${N}$${R}$${P}$${sal.toString('base64url')}$${k.toString('base64url')}`;
}

export async function conferirSenha(senha: string, guardado: string): Promise<boolean> {
  const [alg, n, r, p, sal, hash] = guardado.split('$');
  if (alg !== 'scrypt' || !sal || !hash) return false;
  const esperado = Buffer.from(hash, 'base64url');
  const k = await scrypt(senha, Buffer.from(sal, 'base64url'), Number(n), Number(r), Number(p));
  return k.length === esperado.length && timingSafeEqual(k, esperado);
}

// Hash fixo usado quando o e-mail não existe, para o tempo de resposta não revelar contas.
let hashFalso: Promise<string> | null = null;
export function hashParaComparacaoFalsa(): Promise<string> {
  return (hashFalso ??= gerarHashSenha(randomBytes(16).toString('hex')));
}

export function problemaNaSenha(senha: string, email = ''): string | null {
  if (typeof senha !== 'string' || senha.length < 10) return 'A senha precisa ter pelo menos 10 caracteres.';
  if (senha.length > 200) return 'A senha pode ter no máximo 200 caracteres.';
  if (!senha.trim()) return 'A senha não pode ser só espaços.';
  if (email && senha.toLowerCase().includes(email.split('@')[0].toLowerCase()) && email.split('@')[0].length >= 4) return 'A senha não pode conter o seu e-mail.';
  if (/^(.)\1+$/.test(senha)) return 'A senha não pode repetir um único caractere.';
  return null;
}

export const emailValido = (e: unknown): e is string => typeof e === 'string' && e.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

// ---------------------------------------------------------------------------
// Usuários

export interface Usuario {
  id: number;
  email: string;
  nome: string;
  papel: 'admin' | 'usuario';
  ativo: boolean;
  criadoEm: string;
  senhaAlteradaEm: string;
}

type Linha = Record<string, string | number | null>;
const usuarioDeLinha = (r: Linha): Usuario => ({
  id: r.id as number,
  email: r.email as string,
  nome: r.nome as string,
  papel: r.papel as Usuario['papel'],
  ativo: r.ativo === 1,
  criadoEm: r.criado_em as string,
  senhaAlteradaEm: r.senha_alterada_em as string,
});

export function contarUsuarios(db: BD): number {
  return (prep(db, 'SELECT COUNT(*) AS n FROM usuarios').get() as { n: number }).n;
}

export function buscarUsuario(db: BD, id: number): Usuario | null {
  const r = prep(db, 'SELECT * FROM usuarios WHERE id = ?').get(id) as Linha | undefined;
  return r ? usuarioDeLinha(r) : null;
}

export function buscarPorEmail(db: BD, email: string): (Usuario & { senhaHash: string }) | null {
  const r = prep(db, 'SELECT * FROM usuarios WHERE email = ?').get(email.trim()) as Linha | undefined;
  return r ? { ...usuarioDeLinha(r), senhaHash: r.senha_hash as string } : null;
}

export async function criarUsuario(db: BD, p: { email: string; nome: string; senha: string; papel?: Usuario['papel'] }): Promise<Usuario> {
  if (!emailValido(p.email)) throw new Error('E-mail inválido.');
  const prob = problemaNaSenha(p.senha, p.email);
  if (prob) throw new Error(prob);
  if (buscarPorEmail(db, p.email)) throw new Error('Já existe uma conta com esse e-mail.');
  const hash = await gerarHashSenha(p.senha);
  const agora = new Date().toISOString();
  const r = prep(db, `INSERT INTO usuarios (email, nome, senha_hash, papel, senha_alterada_em, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(p.email.trim().toLowerCase(), p.nome.trim().slice(0, 120), hash, p.papel ?? 'admin', agora, agora, agora);
  return buscarUsuario(db, Number(r.lastInsertRowid))!;
}

// Troca a senha e encerra todas as sessões do usuário, exceto a indicada.
export async function definirSenha(db: BD, usuarioId: number, senha: string, manterSessao?: string): Promise<void> {
  const u = buscarUsuario(db, usuarioId);
  if (!u) throw new Error('Usuário não encontrado.');
  const prob = problemaNaSenha(senha, u.email);
  if (prob) throw new Error(prob);
  const hash = await gerarHashSenha(senha);
  const agora = new Date().toISOString();
  prep(db, 'UPDATE usuarios SET senha_hash = ?, senha_alterada_em = ?, atualizado_em = ? WHERE id = ?').run(hash, agora, agora, usuarioId);
  if (manterSessao) prep(db, 'DELETE FROM sessoes_login WHERE usuario_id = ? AND token_hash <> ?').run(usuarioId, hashToken(manterSessao));
  else prep(db, 'DELETE FROM sessoes_login WHERE usuario_id = ?').run(usuarioId);
}

// ---------------------------------------------------------------------------
// Sessões de login. O navegador guarda só um token aleatório (cookie HttpOnly);
// o banco guarda o hash dele, então um vazamento do banco não dá acesso às sessões.

export interface PoliticaSessao {
  inatividadeMs: number; // expira se ficar sem uso por esse tempo
  maximaMs: number; // duração máxima, mesmo com uso contínuo
}
export const POLITICA_PADRAO: PoliticaSessao = { inatividadeMs: 7 * 864e5, maximaMs: 30 * 864e5 };

const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

export function criarSessao(db: BD, usuarioId: number, info: { ip: string; agente: string }, pol = POLITICA_PADRAO, agora = Date.now()): string {
  const token = randomBytes(32).toString('base64url');
  const iso = new Date(agora).toISOString();
  prep(db, 'INSERT INTO sessoes_login (token_hash, usuario_id, criada_em, ultimo_uso, expira_em, ip, agente) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(hashToken(token), usuarioId, iso, iso, new Date(agora + pol.inatividadeMs).toISOString(), info.ip.slice(0, 64), info.agente.slice(0, 300));
  // Limpeza oportunista de sessões vencidas.
  prep(db, 'DELETE FROM sessoes_login WHERE expira_em < ?').run(iso);
  return token;
}

export function validarSessao(db: BD, token: string | undefined, pol = POLITICA_PADRAO, agora = Date.now()): Usuario | null {
  if (!token || token.length > 100) return null;
  const h = hashToken(token);
  const s = prep(db, 'SELECT * FROM sessoes_login WHERE token_hash = ?').get(h) as Linha | undefined;
  if (!s) return null;
  const criada = Date.parse(s.criada_em as string);
  if (Date.parse(s.expira_em as string) <= agora || criada + pol.maximaMs <= agora) {
    prep(db, 'DELETE FROM sessoes_login WHERE token_hash = ?').run(h);
    return null;
  }
  const u = buscarUsuario(db, s.usuario_id as number);
  if (!u || !u.ativo) return null;
  // Renova a validade no máximo uma vez por minuto, para não gravar a cada requisição.
  if (agora - Date.parse(s.ultimo_uso as string) > 60_000) {
    const expira = Math.min(agora + pol.inatividadeMs, criada + pol.maximaMs);
    prep(db, 'UPDATE sessoes_login SET ultimo_uso = ?, expira_em = ? WHERE token_hash = ?').run(new Date(agora).toISOString(), new Date(expira).toISOString(), h);
  }
  return u;
}

export function encerrarSessao(db: BD, token: string): void {
  prep(db, 'DELETE FROM sessoes_login WHERE token_hash = ?').run(hashToken(token));
}

export function encerrarOutrasSessoes(db: BD, usuarioId: number, tokenAtual: string): number {
  return Number(prep(db, 'DELETE FROM sessoes_login WHERE usuario_id = ? AND token_hash <> ?').run(usuarioId, hashToken(tokenAtual)).changes);
}

export function listarSessoes(db: BD, usuarioId: number, tokenAtual: string) {
  const atual = hashToken(tokenAtual);
  return (prep(db, 'SELECT token_hash, criada_em, ultimo_uso, expira_em, ip, agente FROM sessoes_login WHERE usuario_id = ? AND expira_em > ? ORDER BY ultimo_uso DESC').all(usuarioId, new Date().toISOString()) as Linha[]).map((r) => ({
    atual: r.token_hash === atual,
    criadaEm: r.criada_em as string,
    ultimoUso: r.ultimo_uso as string,
    expiraEm: r.expira_em as string,
    ip: r.ip as string,
    agente: r.agente as string,
  }));
}

// ---------------------------------------------------------------------------
// Proteção contra tentativas abusivas: limita falhas por e-mail e por IP numa janela.

export interface PoliticaBloqueio {
  janelaMs: number;
  maxPorEmail: number;
  maxPorIp: number;
  bloqueioMs: number;
}
export const BLOQUEIO_PADRAO: PoliticaBloqueio = { janelaMs: 15 * 60_000, maxPorEmail: 5, maxPorIp: 20, bloqueioMs: 15 * 60_000 };

export function bloqueadoAte(db: BD, chaves: string[], agora = Date.now()): number {
  let ate = 0;
  for (const c of chaves) {
    const r = prep(db, 'SELECT bloqueado_ate FROM tentativas_login WHERE chave = ?').get(c) as { bloqueado_ate: number } | undefined;
    if (r && r.bloqueado_ate > agora) ate = Math.max(ate, r.bloqueado_ate);
  }
  return ate;
}

export function registrarFalha(db: BD, chave: string, limite: number, pol = BLOQUEIO_PADRAO, agora = Date.now()): void {
  const r = prep(db, 'SELECT * FROM tentativas_login WHERE chave = ?').get(chave) as { falhas: number; primeira_em: number } | undefined;
  const nova = !r || agora - r.primeira_em > pol.janelaMs;
  const falhas = nova ? 1 : r!.falhas + 1;
  const primeira = nova ? agora : r!.primeira_em;
  const bloqueio = falhas >= limite ? agora + pol.bloqueioMs : 0;
  prep(db, `INSERT INTO tentativas_login (chave, falhas, primeira_em, bloqueado_ate) VALUES (?, ?, ?, ?)
    ON CONFLICT(chave) DO UPDATE SET falhas = excluded.falhas, primeira_em = excluded.primeira_em, bloqueado_ate = excluded.bloqueado_ate`).run(chave, falhas, primeira, bloqueio);
}

export function limparFalhas(db: BD, chave: string): void {
  prep(db, 'DELETE FROM tentativas_login WHERE chave = ?').run(chave);
}
