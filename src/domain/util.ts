// Datas são guardadas como AAAA-MM-DD no fuso do usuário, para que "hoje" seja o dia dele
// mesmo quando o código roda num servidor em outro fuso (por exemplo, uma VPS em UTC).

export const FUSO_PADRAO = 'America/Sao_Paulo';

let fusoAtual: string | null = null;
let fmtFuso: Intl.DateTimeFormat | null = null;

export function fusoValido(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// Define o fuso usado por isoDia. null volta ao fuso local do ambiente.
export function definirFuso(tz: string | null | undefined): void {
  const novo = tz && fusoValido(tz) ? tz : null;
  if (novo === fusoAtual) return;
  fusoAtual = novo;
  fmtFuso = novo ? new Intl.DateTimeFormat('en-CA', { timeZone: novo, year: 'numeric', month: '2-digit', day: '2-digit' }) : null;
}

export function fusoEmUso(): string | null {
  return fusoAtual;
}

export function isoDia(d: Date = new Date()): string {
  if (fmtFuso) {
    const p = Object.fromEntries(fmtFuso.formatToParts(d).map((x) => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day}`;
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDia(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export function somarDias(s: string, n: number): string {
  const d = parseDia(s);
  d.setDate(d.getDate() + n);
  return isoDia(d);
}

export function diffDias(a: string, b: string): number {
  return Math.round((parseDia(b).getTime() - parseDia(a).getTime()) / 86400000);
}

// Segunda-feira da semana de uma data.
export function inicioSemana(s: string): string {
  const d = parseDia(s);
  const wd = (d.getDay() + 6) % 7;
  return somarDias(s, -wd);
}

export function fmtDia(s: string, opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit' }): string {
  return parseDia(s).toLocaleDateString('pt-BR', opts);
}

export function fmtMin(min: number): string {
  const m = Math.round(min);
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r}min`;
  return r === 0 ? `${h}h` : `${h}h${String(r).padStart(2, '0')}`;
}

export function fmtPct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

export function uid(prefix = ''): string {
  const r = Math.random().toString(36).slice(2, 10);
  return `${prefix}${Date.now().toString(36)}${r}`;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
