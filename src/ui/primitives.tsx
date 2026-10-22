import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { NucleoId, Prioridade, Status } from '../domain/types';
import { PRIORIDADES, STATUS, STATUS_LABEL } from '../domain/types';
import { seed } from '../store/seed';

// ---------------------------------------------------------------------------
// Ícones em traço (24×24, estilo Lucide), desenhados inline: funcionam offline e herdam a cor do texto.
const ICONES = {
  painel: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
  ciclo: 'M21 12a9 9 0 0 1-15.5 6.2L3 16M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M3 21v-5h5',
  conteudos: 'M4 19.5V5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2zM4 19.5A2 2 0 0 0 6 21h14M9 7h7M9 11h5',
  sessoes: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  config: 'M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4',
  edital: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h5',
  play: 'M7 4.5v15l12-7.5z',
  pause: 'M7 4h3v16H7zM14 4h3v16h-3z',
  check: 'M5 12.5l4.5 4.5L19 7',
  x: 'M6 6l12 12M18 6L6 18',
  mais: 'M12 5v14M5 12h14',
  menos: 'M5 12h14',
  telaCheia: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  cima: 'M12 19V5M6 11l6-6 6 6',
  baixo: 'M12 5v14M6 13l6 6 6-6',
  direita: 'M9 6l6 6-6 6',
  esquerda: 'M15 6l-6 6 6 6',
  abaixo: 'M6 9l6 6 6-6',
  alca: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
  pontos: 'M5 12h.01M12 12h.01M19 12h.01',
  menu: 'M4 6h16M4 12h16M4 18h16',
  busca: 'M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14zM20 20l-4-4',
  filtro: 'M4 5h16l-6 8v5l-4 2v-7z',
  lixeira: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  editar: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
  pular: 'M5 5l8 7-8 7zM17 5v14',
  alvo: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  calendario: 'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4',
  alerta: 'M12 3l10 18H2zM12 10v4M12 17.5h.01',
  nota: 'M5 4h14v16H5zM9 8h6M9 12h6M9 16h3',
  baixar: 'M12 4v12M7 11l5 5 5-5M5 20h14',
  subir: 'M12 20V8M7 13l5-5 5 5M5 4h14',
  externo: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  revisao: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 8v4l3 2',
  livro: 'M2 5h7a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H2zM22 5h-7a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h8z',
  inicio: 'M3 10.5L12 3l9 7.5M5 9v11h5v-6h4v6h5V9',
  grafico: 'M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6',
  historico: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 3',
  sair: 'M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H3',
  escudo: 'M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6zM9 12l2 2 4-4',
  usuario: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  paleta: 'M12 3a9 9 0 1 0 0 18c1 0 1.5-.8 1.5-1.6 0-1.3-1-1.6-1-2.9 0-.9.7-1.5 1.6-1.5H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8zM7.5 11h.01M10 7h.01M15 7h.01',
  banco: 'M12 8c4.4 0 8-1.3 8-3s-3.6-3-8-3-8 1.3-8 3 3.6 3 8 3zM4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  recolher: 'M4 4h16v16H4zM9 4v16M15 10l-2 2 2 2',
  expandir: 'M4 4h16v16H4zM9 4v16M13 10l2 2-2 2',
  olho: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  olhoFechado: 'M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7c1.7 0 3.2-.5 4.5-1.2M9.9 9.9a3 3 0 0 0 4.2 4.2',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01',
  raio: 'M13 2L4 14h7l-1 8 9-12h-7z',
  bandeira: 'M5 21V4M5 4h11l-2 4 2 4H5',
} as const;

export type NomeIcone = keyof typeof ICONES;

export function Icone({ nome, tam = 18, className }: { nome: NomeIcone; tam?: number; className?: string }) {
  const cheio = nome === 'play' || nome === 'pause';
  const pontos = nome === 'alca' || nome === 'pontos';
  return (
    <svg className={`icone ${className ?? ''}`} width={tam} height={tam} viewBox="0 0 24 24" aria-hidden="true" focusable="false"
      fill={cheio ? 'currentColor' : 'none'} stroke={cheio ? 'none' : 'currentColor'} strokeWidth={pontos ? 3 : 1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d={ICONES[nome]} />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Indicadores

export function Barra({ valor, rotulo, tom }: { valor: number; rotulo?: string; tom?: 'cg' | 'ce' | 'ok' | 'alerta' }) {
  const pct = Math.round(Math.max(0, Math.min(1, valor)) * 100);
  return (
    <div className={`barra ${tom ? `barra-${tom}` : ''}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={rotulo}>
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}

const classePri = (p: Prioridade) => (p === 'Média' ? 'media' : p.toLowerCase());

export function PrioridadeTag({ p, propria }: { p: Prioridade; propria?: boolean }) {
  return (
    <span className={`marca-pri pri-${classePri(p)}`} title={propria ? 'Prioridade definida por você' : 'Prioridade da planilha (estratégica, não oficial)'}>
      <i aria-hidden="true" />
      {p}
      {propria && <span className="propria" aria-label="(definida por você)">•</span>}
    </span>
  );
}

export function NucleoTag({ n }: { n: NucleoId }) {
  const nuc = seed.nucleos.find((x) => x.id === n)!;
  return <span className={`marca-nucleo nu-${n}`} title={nuc.nome}>{n === 'CG' ? 'Gerais' : 'Específicos'}</span>;
}

export function StatusPill({ s }: { s: Status }) {
  return <span className={`marca-status st-${s}`}><i aria-hidden="true" />{STATUS_LABEL[s]}</span>;
}

export function Kpi({ rotulo, valor, sub, children, icone, className }: { rotulo: string; valor: ReactNode; sub?: ReactNode; children?: ReactNode; icone?: NomeIcone; className?: string }) {
  return (
    <div className={`kpi ${className ?? ''}`}>
      <div className="kpi-k">{icone && <Icone nome={icone} tam={15} />}{rotulo}</div>
      <div className="kpi-v">{valor}</div>
      {sub && <div className="kpi-s">{sub}</div>}
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Controles

export function StatusSeletor({ valor, onChange, id }: { valor: Status; onChange: (s: Status) => void; id?: string }) {
  return (
    <div className="segmentado segmentado-largo" role="radiogroup" aria-label="Situação de estudo" id={id}>
      {STATUS.map((s) => (
        <button key={s} type="button" role="radio" aria-checked={valor === s} className={`st-${s} ${valor === s ? 'on' : ''}`} onClick={() => onChange(s)}>
          <i aria-hidden="true" />
          {STATUS_LABEL[s]}
        </button>
      ))}
    </div>
  );
}

// Opções mutuamente exclusivas, navegáveis pelas setas como um grupo de rádio.
export function Segmentado<T extends string>({ opcoes, valor, onChange, rotulo }: { opcoes: { valor: T; rotulo: string }[]; valor: T; onChange: (v: T) => void; rotulo: string }) {
  const tecla = (e: React.KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const k = (i + d + opcoes.length) % opcoes.length;
    onChange(opcoes[k].valor);
    (e.currentTarget.parentElement?.children[k] as HTMLElement | undefined)?.focus();
  };
  return (
    <div className="segmentado" role="radiogroup" aria-label={rotulo}>
      {opcoes.map((o, i) => (
        <button key={o.valor} type="button" role="radio" aria-checked={valor === o.valor} tabIndex={valor === o.valor ? 0 : -1} className={valor === o.valor ? 'on' : ''} onClick={() => onChange(o.valor)} onKeyDown={(e) => tecla(e, i)}>
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}

export function PrioridadeSeletor({ valor, padrao, onChange, id }: { valor: Prioridade | undefined; padrao: Prioridade; onChange: (p: Prioridade | null) => void; id?: string }) {
  return (
    <select id={id} value={valor ?? ''} onChange={(e) => onChange((e.target.value || null) as Prioridade | null)} aria-label="Prioridade">
      <option value="">Planilha: {padrao}</option>
      {PRIORIDADES.map((p) => (
        <option key={p} value={p}>{p}</option>
      ))}
    </select>
  );
}

// Abas acessíveis (setas alternam). O conteúdo é renderizado por quem usa, com id `painel-<id>`.
export function Abas<T extends string>({ abas, ativa, onChange, rotulo }: { abas: { id: T; rotulo: string; contador?: number }[]; ativa: T; onChange: (id: T) => void; rotulo: string }) {
  const tecla = (e: React.KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const k = (i + d + abas.length) % abas.length;
    onChange(abas[k].id);
    (e.currentTarget.parentElement?.children[k] as HTMLElement | undefined)?.focus();
  };
  return (
    <div className="abas" role="tablist" aria-label={rotulo}>
      {abas.map((a, i) => (
        <button key={a.id} role="tab" id={`aba-${a.id}`} aria-controls={`painel-${a.id}`} aria-selected={ativa === a.id} tabIndex={ativa === a.id ? 0 : -1} className={ativa === a.id ? 'on' : ''} onClick={() => onChange(a.id)} onKeyDown={(e) => tecla(e, i)}>
          {a.rotulo}
          {a.contador !== undefined && <span className="contador">{a.contador}</span>}
        </button>
      ))}
    </div>
  );
}

// Fecha um popover ao clicar fora ou apertar Esc.
function useFecharFora(aberto: boolean, fechar: () => void, ref: React.RefObject<HTMLElement>, botao: React.RefObject<HTMLElement>) {
  useEffect(() => {
    if (!aberto) return;
    const clique = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node) && !botao.current?.contains(e.target as Node)) fechar();
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        fechar();
        botao.current?.focus();
      }
    };
    document.addEventListener('mousedown', clique);
    document.addEventListener('keydown', tecla, true);
    return () => {
      document.removeEventListener('mousedown', clique);
      document.removeEventListener('keydown', tecla, true);
    };
  }, [aberto, fechar, ref, botao]);
}

// Explicação sob demanda: um ícone (i) que abre um balão. Mantém a tela limpa sem esconder informação.
export function Info({ children, rotulo = 'Mais informações' }: { children: ReactNode; rotulo?: string }) {
  const [aberto, setAberto] = useState(false);
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  useFecharFora(aberto, () => setAberto(false), ref, botao);
  return (
    <span className="info">
      <button ref={botao} type="button" className="info-botao" aria-label={rotulo} aria-expanded={aberto} aria-controls={id} onClick={() => setAberto((a) => !a)}>
        <Icone nome="info" tam={15} />
      </button>
      {aberto && (
        <div ref={ref} id={id} role="note" className="popover info-balao">
          {children}
        </div>
      )}
    </span>
  );
}

export interface ItemMenu {
  rotulo: string;
  icone?: NomeIcone;
  onClick: () => void;
  perigo?: boolean;
  desabilitado?: boolean;
}

// Menu "⋯" para ações secundárias.
export function MenuAcoes({ itens, rotulo }: { itens: (ItemMenu | null | false)[]; rotulo: string }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const validos = itens.filter(Boolean) as ItemMenu[];
  useFecharFora(aberto, () => setAberto(false), ref, botao);
  useEffect(() => {
    if (aberto) ref.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus();
  }, [aberto]);
  const tecla = (e: React.KeyboardEvent) => {
    const d = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const els = Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? []);
    const i = els.indexOf(document.activeElement as HTMLElement);
    els[(i + d + els.length) % els.length]?.focus();
  };
  return (
    <span className="menu-acoes">
      <button ref={botao} type="button" className="btn-icone" aria-label={rotulo} aria-haspopup="menu" aria-expanded={aberto} onClick={() => setAberto((a) => !a)}>
        <Icone nome="pontos" />
      </button>
      {aberto && (
        <div ref={ref} role="menu" className="popover menu-lista" onKeyDown={tecla}>
          {validos.map((it) => (
            <button key={it.rotulo} role="menuitem" type="button" disabled={it.desabilitado} className={it.perigo ? 'perigo' : ''} onClick={() => { setAberto(false); it.onClick(); }}>
              {it.icone && <Icone nome={it.icone} tam={16} />}
              {it.rotulo}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Estrutura

export function Cabecalho({ titulo, subtitulo, acoes, sobre, info }: { titulo: ReactNode; subtitulo?: ReactNode; acoes?: ReactNode; sobre?: ReactNode; info?: ReactNode }) {
  return (
    <header className="cabecalho">
      <div className="cabecalho-txt">
        {sobre && <p className="cabecalho-sobre">{sobre}</p>}
        <h1>
          {titulo}
          {info && <Info rotulo="Sobre esta página">{info}</Info>}
        </h1>
        {subtitulo && <p className="cabecalho-sub">{subtitulo}</p>}
      </div>
      {acoes && <div className="cabecalho-acoes">{acoes}</div>}
    </header>
  );
}

export function Painel({ titulo, info, acoes, children, className, id, semPadding }: { titulo?: ReactNode; info?: ReactNode; acoes?: ReactNode; children: ReactNode; className?: string; id?: string; semPadding?: boolean }) {
  return (
    <section className={`painel ${semPadding ? 'painel-colado' : ''} ${className ?? ''}`} aria-labelledby={titulo && id ? `${id}-t` : undefined} id={id}>
      {(titulo || acoes) && (
        <div className="painel-cab">
          {titulo && (
            <h2 id={id ? `${id}-t` : undefined}>
              {titulo}
              {info && <Info>{info}</Info>}
            </h2>
          )}
          {acoes && <div className="painel-acoes">{acoes}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Vazio({ children, icone, titulo, acao }: { children?: ReactNode; icone?: NomeIcone; titulo?: string; acao?: ReactNode }) {
  return (
    <div className="vazio">
      {icone && <span className="vazio-ic"><Icone nome={icone} tam={20} /></span>}
      {titulo && <b>{titulo}</b>}
      {children && <span>{children}</span>}
      {acao}
    </div>
  );
}

export function LinkEdital({ pagina, children }: { pagina: number; children?: ReactNode }) {
  return (
    <a className="link-edital" href={`edital.pdf#page=${pagina}`} target="_blank" rel="noreferrer" title={`Abrir o edital na página ${pagina}`}>
      {children ?? `edital, p. ${pagina}`}
    </a>
  );
}

// Diálogo modal acessível (foco preso, Esc fecha). Com `lado`, abre como painel lateral.
export function Modal({ titulo, aberto, onFechar, children, largura, lado, subtitulo }: { titulo: string; aberto: boolean; onFechar: () => void; children: ReactNode; largura?: number; lado?: boolean; subtitulo?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const anterior = document.activeElement as HTMLElement | null;
    const el = ref.current;
    el?.querySelector<HTMLElement>('[data-foco], input:not([type="hidden"]), select, textarea, .modal-c button')?.focus();
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar();
      if (e.key === 'Tab' && el) {
        const f = Array.from(el.querySelectorAll<HTMLElement>('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])')).filter((x) => !x.hasAttribute('disabled') && x.offsetParent !== null);
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) {
          e.preventDefault();
          f[f.length - 1].focus();
        } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) {
          e.preventDefault();
          f[0].focus();
        }
      }
    };
    document.addEventListener('keydown', h);
    document.body.classList.add('sem-rolagem');
    return () => {
      document.removeEventListener('keydown', h);
      document.body.classList.remove('sem-rolagem');
      anterior?.focus();
    };
  }, [aberto, onFechar]);
  if (!aberto) return null;
  return (
    <div className={`modal-fundo ${lado ? 'modal-fundo-lado' : ''}`} onMouseDown={(e) => e.target === e.currentTarget && onFechar()}>
      <div className={`modal ${lado ? 'modal-lado' : ''}`} role="dialog" aria-modal="true" aria-label={titulo} ref={ref} style={largura ? { maxWidth: largura } : undefined}>
        <header className="modal-h">
          <div>
            <h2>{titulo}</h2>
            {subtitulo && <p className="modal-sub">{subtitulo}</p>}
          </div>
          <button className="btn-icone" onClick={onFechar} aria-label="Fechar">
            <Icone nome="x" />
          </button>
        </header>
        <div className="modal-c">{children}</div>
      </div>
    </div>
  );
}

// Confirmação antes de ações destrutivas.
export function useConfirmacao() {
  const [pedido, setPedido] = useState<{ titulo: string; texto: string; acao: string; resolve: (ok: boolean) => void } | null>(null);
  const confirmar = (titulo: string, texto: string, acao = 'Confirmar') => new Promise<boolean>((resolve) => setPedido({ titulo, texto, acao, resolve }));
  const fechar = (ok: boolean) => {
    pedido?.resolve(ok);
    setPedido(null);
  };
  const dialogo = (
    <Modal titulo={pedido?.titulo ?? ''} aberto={!!pedido} onFechar={() => fechar(false)} largura={440}>
      <p className="confirmar-txt">{pedido?.texto}</p>
      <div className="acoes">
        <button className="btn" data-foco onClick={() => fechar(false)}>Cancelar</button>
        <button className="btn perigo-cheio" onClick={() => fechar(true)}>{pedido?.acao}</button>
      </div>
    </Modal>
  );
  return { confirmar, dialogo };
}

export function useAgora(intervalo = 1000, ativo = true): number {
  const [t, setT] = useState(Date.now());
  useEffect(() => {
    if (!ativo) return;
    const id = window.setInterval(() => setT(Date.now()), intervalo);
    return () => window.clearInterval(id);
  }, [intervalo, ativo]);
  return t;
}
