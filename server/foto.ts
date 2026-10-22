import { copyFileSync, existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
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
