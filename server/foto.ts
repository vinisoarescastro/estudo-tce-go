import { copyFileSync, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';

// Foto de perfil: um arquivo por usuário em <pasta de dados>/fotos/<id>.<ext>. Fica fora da
// pasta pública do site e só é entregue ao próprio dono, depois do login.

export const TIPOS_FOTO: Record<string, string> = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};
export const TAMANHO_MAX_FOTO = 2 * 1024 * 1024;

export interface Foto {
  arquivo: string;
  tipo: string;
  versao: number; // muda quando o arquivo muda; serve para o navegador atualizar o cache
}

export function acharFoto(pastaDados: string, usuarioId: number): Foto | null {
  for (const ext of Object.keys(TIPOS_FOTO)) {
    const arquivo = join(pastaDados, 'fotos', `${usuarioId}${ext}`);
    if (existsSync(arquivo)) return { arquivo, tipo: TIPOS_FOTO[ext], versao: Math.floor(statSync(arquivo).mtimeMs) };
  }
  return null;
}

// Copia a imagem para a pasta de fotos, no lugar da anterior. Lança Error com a causa em português.
export function salvarFoto(pastaDados: string, usuarioId: number, origem: string): string {
  if (!existsSync(origem) || !statSync(origem).isFile()) throw new Error(`Arquivo não encontrado: ${origem}`);
  const ext = extname(origem).toLowerCase();
  if (!TIPOS_FOTO[ext]) throw new Error('Use uma imagem .webp, .png ou .jpg.');
  if (statSync(origem).size > TAMANHO_MAX_FOTO) throw new Error('A imagem passa de 2 MB. Reduza-a (por exemplo, para 400 × 400 pixels) e tente de novo.');
  const pasta = join(pastaDados, 'fotos');
  mkdirSync(pasta, { recursive: true });
  for (const e of Object.keys(TIPOS_FOTO)) rmSync(join(pasta, `${usuarioId}${e}`), { force: true });
  const destino = join(pasta, `${usuarioId}${ext}`);
  copyFileSync(origem, destino);
  return destino;
}

// Reconhece o formato pelos primeiros bytes do arquivo (o tipo informado pelo navegador não é confiável).
function extensaoPorConteudo(b: Buffer): '.png' | '.jpg' | '.webp' | null {
  if (b.length > 12 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return '.png';
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return '.jpg';
  if (b.length > 12 && b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return '.webp';
  return null;
}

// Grava a foto enviada pelo próprio usuário (bytes já decodificados), no lugar da anterior.
export function salvarFotoBytes(pastaDados: string, usuarioId: number, bytes: Buffer): void {
  if (bytes.length > TAMANHO_MAX_FOTO) throw new Error('A imagem passa de 2 MB.');
  const ext = extensaoPorConteudo(bytes);
  if (!ext) throw new Error('Use uma imagem .webp, .png ou .jpg.');
  const pasta = join(pastaDados, 'fotos');
  mkdirSync(pasta, { recursive: true });
  removerFoto(pastaDados, usuarioId);
  writeFileSync(join(pasta, `${usuarioId}${ext}`), bytes);
}

export function removerFoto(pastaDados: string, usuarioId: number): void {
  for (const e of Object.keys(TIPOS_FOTO)) rmSync(join(pastaDados, 'fotos', `${usuarioId}${e}`), { force: true });
}
