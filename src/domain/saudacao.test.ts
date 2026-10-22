import { describe, expect, it } from 'vitest';
import { FRASES, horaNoFuso, periodoDoDia, primeiroNome, proximaFrase, saudacaoDoDia, type BaralhoFrases } from './saudacao';

describe('saudação', () => {
  it('divide o dia em madrugada, manhã, tarde e noite', () => {
    expect([0, 4, 5, 11, 12, 17, 18, 23].map(periodoDoDia)).toEqual(['madrugada', 'madrugada', 'manha', 'manha', 'tarde', 'tarde', 'noite', 'noite']);
    expect([2, 9, 15, 21].map(saudacaoDoDia)).toEqual(['Boa madrugada', 'Bom dia', 'Boa tarde', 'Boa noite']);
  });

  it('lê a hora no fuso do usuário', () => {
    const t = new Date('2026-01-10T03:30:00Z');
    expect(horaNoFuso(t, 'America/Sao_Paulo')).toBe(0);
    expect(horaNoFuso(t, 'UTC')).toBe(3);
    expect(horaNoFuso(t, 'Fuso/Inexistente')).toBeGreaterThanOrEqual(0);
  });

  it('usa o primeiro nome ou o começo do e-mail', () => {
    expect(primeiroNome('vinicius soares', 'a@b.com')).toBe('Vinicius');
    expect(primeiroNome('', 'vinicius.castro@gmail.com')).toBe('Vinicius');
    expect(primeiroNome('  ', 'maria@x.com')).toBe('Maria');
  });

  it('não repete frase antes de acabar o baralho nem na virada', () => {
    const total = FRASES.length;
    let baralho: BaralhoFrases | null = null;
    let anterior = -1;
    const vistas = new Set<number>();
    for (let i = 0; i < total * 3; i++) {
      const r = proximaFrase(baralho, total);
      expect(r.indice).not.toBe(anterior);
      if (i < total) expect(vistas.has(r.indice)).toBe(false);
      if (i < total) vistas.add(r.indice);
      anterior = r.indice;
      baralho = r.baralho;
    }
    expect(vistas.size).toBe(total);
  });
});
