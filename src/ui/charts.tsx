import { useEffect, useRef, useState } from 'react';
import { fmtMin } from '../domain/util';

// Gráficos em SVG próprios: leves, temáveis e sem dependências externas.
// São desenhados na largura real do contêiner, para o texto manter o mesmo tamanho em qualquer tela.

function useLargura(inicial = 640) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(inicial);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export interface Ponto {
  rotulo: string;
  valor: number;
  ref?: number; // valor de referência (ex.: planejado)
  dica?: string;
}

function escala(max: number): number[] {
  if (max <= 0) return [0, 1];
  const passos = [1, 2, 5, 10, 15, 30, 60, 120, 180, 240, 300, 600, 1200, 1800, 3000, 6000];
  const alvo = max / 4;
  const p = passos.find((x) => x >= alvo) ?? Math.ceil(alvo);
  const out = [];
  for (let v = 0; v <= max + p * 0.001; v += p) out.push(v);
  if (out[out.length - 1] < max) out.push(out[out.length - 1] + p);
  return out;
}

export function Barras({ dados, altura = 200, fmt = fmtMin, legendaRef, legendaValor = 'Realizado' }: { dados: Ponto[]; altura?: number; fmt?: (n: number) => string; legendaRef?: string; legendaValor?: string }) {
  const [ref, larg] = useLargura();
  const W = Math.max(larg, dados.length * 16 + 54);
  const H = altura;
  const pl = 46, pr = 8, pt = 10, pb = 26;
  const max = Math.max(1, ...dados.map((d) => Math.max(d.valor, d.ref ?? 0)));
  const ticks = escala(max);
  const top = ticks[ticks.length - 1];
  const y = (v: number) => pt + (H - pt - pb) * (1 - v / top);
  const bw = (W - pl - pr) / Math.max(1, dados.length);
  const passoRot = Math.max(1, Math.ceil((dados.length * 44) / (W - pl - pr)));
  const larguraBarra = Math.min(bw * 0.62, 36);
  return (
    <div className="grafico">
      {legendaRef && (
        <div className="legenda">
          <span><i className="lg-real" />{legendaValor}</span>
          <span><i className="lg-ref" />{legendaRef}</span>
        </div>
      )}
      <div className="grafico-scroll" ref={ref}>
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Gráfico de barras">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pl} x2={W - pr} y1={y(t)} y2={y(t)} className="g-grade" />
              <text x={pl - 6} y={y(t) + 4} textAnchor="end" className="g-txt">{fmt(t)}</text>
            </g>
          ))}
          {dados.map((d, i) => {
            const x = pl + i * bw;
            return (
              <g key={i}>
                <rect x={x + (bw - larguraBarra) / 2} y={y(d.valor)} width={larguraBarra} height={Math.max(0, H - pb - y(d.valor))} className="g-barra" rx={Math.min(4, larguraBarra / 3)}>
                  <title>{d.dica ?? `${d.rotulo}: ${fmt(d.valor)}${d.ref !== undefined ? ` (ref. ${fmt(d.ref)})` : ''}`}</title>
                </rect>
                {d.ref !== undefined && d.ref > 0 && <line x1={x + (bw - larguraBarra) / 2 - 3} x2={x + (bw + larguraBarra) / 2 + 3} y1={y(d.ref)} y2={y(d.ref)} className="g-ref" />}
                {i % passoRot === 0 && <text x={x + bw / 2} y={H - 8} textAnchor="middle" className="g-txt">{d.rotulo}</text>}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export function Linhas({ series, rotulos, altura = 200, max, fmt = (n: number) => String(Math.round(n)) }: { series: { nome: string; valores: number[]; classe: string }[]; rotulos: string[]; altura?: number; max?: number; fmt?: (n: number) => string }) {
  const [ref, W] = useLargura();
  const H = altura, pl = 40, pr = 16, pt = 12, pb = 26;
  const mx = max ?? Math.max(1, ...series.flatMap((s) => s.valores));
  const ticks = escala(mx);
  const top = max ?? ticks[ticks.length - 1];
  const n = Math.max(1, rotulos.length - 1);
  const x = (i: number) => pl + (i * (W - pl - pr)) / n;
  const y = (v: number) => pt + (H - pt - pb) * (1 - v / top);
  const passo = Math.max(1, Math.ceil((rotulos.length * 48) / (W - pl - pr)));
  const tks = max !== undefined ? [0, max * 0.25, max * 0.5, max * 0.75, max] : ticks;
  return (
    <div className="grafico">
      <div className="legenda">
        {series.map((s) => (
          <span key={s.nome}><i className={`lg-${s.classe}`} />{s.nome}</span>
        ))}
      </div>
      <div className="grafico-area" ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Gráfico de linhas">
        {tks.map((t) => (
          <g key={t}>
            <line x1={pl} x2={W - pr} y1={y(t)} y2={y(t)} className="g-grade" />
            <text x={pl - 6} y={y(t) + 4} textAnchor="end" className="g-txt">{fmt(t)}</text>
          </g>
        ))}
        {rotulos.map((r, i) => {
          const ultimo = i === rotulos.length - 1;
          if (!ultimo && (i % passo !== 0 || rotulos.length - 1 - i < passo * 0.7)) return null;
          return <text key={i} x={x(i)} y={H - 8} textAnchor={ultimo ? 'end' : i === 0 ? 'start' : 'middle'} className="g-txt">{r}</text>;
        })}
        {series.map((s) => (
          <g key={s.nome}>
            {s.valores.length > 1 && <polygon className={`g-area ${s.classe}`} points={`${x(0)},${y(0)} ${s.valores.map((v, i) => `${x(i)},${y(v)}`).join(' ')} ${x(s.valores.length - 1)},${y(0)}`} />}
            <polyline fill="none" className={`g-linha ${s.classe}`} points={s.valores.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />
            {s.valores.length > 0 && <circle cx={x(s.valores.length - 1)} cy={y(s.valores[s.valores.length - 1])} r={4} className={`g-ponto ${s.classe}`} />}
          </g>
        ))}
      </svg>
      </div>
    </div>
  );
}

export function BarrasH({ itens, fmt = fmtMin }: { itens: { rotulo: string; valor: number; classe?: string; sub?: string }[]; fmt?: (n: number) => string }) {
  const max = Math.max(1, ...itens.map((i) => i.valor));
  return (
    <ul className="barras-h">
      {itens.map((i) => (
        <li key={i.rotulo}>
          <span className="bh-r" title={i.rotulo}>{i.rotulo}</span>
          <span className="bh-t"><i className={i.classe} style={{ width: `${(i.valor / max) * 100}%` }} /></span>
          <span className="bh-v">{fmt(i.valor)}{i.sub ? <small> {i.sub}</small> : null}</span>
        </li>
      ))}
    </ul>
  );
}
