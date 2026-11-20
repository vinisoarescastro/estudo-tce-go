// Cliente da API. Toda chamada leva o cookie de sessão (mesma origem) e, nas alterações,
// o cabeçalho anti-CSRF exigido pelo servidor.
import type { PomodoroCfg } from './domain/pomodoro';

export class ErroApi extends Error {
  constructor(public status: number, msg: string) {
    super(msg);
  }
}

// Avisado quando o servidor responde 401 (sessão expirada), para a interface voltar ao login.
let aoExpirar: (() => void) | null = null;
export function definirAoExpirar(f: (() => void) | null): void {
  aoExpirar = f;
}

// Edital ativo da tela: vai em toda chamada, e o servidor responde com os dados desse edital.
let editalAtivo: string | null = null;
export function definirEditalAtivo(cargoId: string | null): void {
  editalAtivo = cargoId;
}

// Avisado quando o servidor recusa o edital ativo (a inscrição foi retirada): a tela recarrega no principal.
let aoEditalInvalido: (() => void) | null = null;
export function definirAoEditalInvalido(f: (() => void) | null): void {
  aoEditalInvalido = f;
}

export async function api<T>(caminho: string, opcoes: { metodo?: 'GET' | 'POST' | 'PUT'; corpo?: unknown; silenciar401?: boolean } = {}): Promise<T> {
  const metodo = opcoes.metodo ?? 'GET';
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (editalAtivo) headers['X-Edital'] = editalAtivo;
  if (metodo !== 'GET') {
    headers['X-Requested-With'] = 'estudo-tce-go';
    headers['Content-Type'] = 'application/json';
  }
  let r: Response;
  try {
    r = await fetch(caminho, { method: metodo, headers, credentials: 'same-origin', body: metodo === 'GET' ? undefined : JSON.stringify(opcoes.corpo ?? {}) });
  } catch {
    throw new ErroApi(0, 'Sem conexão com o servidor. Verifique a internet e tente de novo.');
  }
  let json: { erro?: string; editalInvalido?: boolean } & Record<string, unknown> = {};
  try {
    json = await r.json();
  } catch {
    /* resposta sem JSON */
  }
  if (!r.ok) {
    if (r.status === 401 && !opcoes.silenciar401) aoExpirar?.();
    if (r.status === 409 && json.editalInvalido) aoEditalInvalido?.();
    throw new ErroApi(r.status, json.erro ?? `Erro ${r.status} ao falar com o servidor.`);
  }
  return json as T;
}

export interface UsuarioPublico {
  id: number;
  email: string;
  nome: string;
  papel: 'admin' | 'usuario';
  cargoId: string; // edital principal da conta
  editais: EditalConta[]; // editais em que a conta está inscrita, o principal primeiro
  senhaProvisoria: boolean; // criada por um administrador: o dono deve trocá-la
  criadoEm: string;
  senhaAlteradaEm: string;
  foto: number | null; // versão da foto de perfil; null = sem foto
}

export interface EditalConta {
  cargoId: string;
  codigo: string;
  nomeCurto: string;
  concursoId: string;
  principal: boolean;
}

// Cronômetro da conta em outro edital (a conta tem um só cronômetro).
export interface CronometroOutro { cargoId: string; nomeCurto: string; rodando: boolean }

export interface Preferencias {
  tema: 'sistema' | 'claro' | 'escuro';
  menuRecolhido: boolean;
  pomodoro: PomodoroCfg;
}
