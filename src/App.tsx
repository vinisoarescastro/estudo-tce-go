import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppProvider, useApp } from './store/AppStore';
import { Ui, type PresetSessao, type UiCtx } from './ui/UiContext';
import { Icone, useConfirmacao, type NomeIcone } from './ui/primitives';
import { TopicoDetalhe } from './ui/TopicoDetalhe';
import { SessaoForm } from './ui/SessaoForm';
import { Cronometro } from './ui/Cronometro';
import { Avatar } from './ui/Avatar';
import { PomodoroMotor } from './ui/pomodoro';
import { Foco } from './pages/Foco';
import { Inicio } from './pages/Inicio';
import { Dashboard } from './pages/Dashboard';
import { Historico } from './pages/Historico';
import { Ciclo } from './pages/Ciclo';
import { Conteudos } from './pages/Conteudos';
import { EditalOficial } from './pages/EditalOficial';
import { Referencias } from './pages/Referencias';
import { ConfigMetas } from './pages/config/Metas';
import { ConfigEstudo } from './pages/config/Estudo';
import { ConfigPomodoro } from './pages/config/Pomodoro';
import { ConfigPersonalizacao } from './pages/config/Personalizacao';
import { ConfigDados } from './pages/config/Dados';
import { ConfigConta } from './pages/config/Conta';

interface ItemMenu { id: string; rotulo: string; icone: NomeIcone }
interface GrupoMenu { id: string; rotulo: string; itens: ItemMenu[] }

// Estrutura de navegação: "Início" fica solto; os demais itens ficam em grupos que abrem e fecham.
const INICIO: ItemMenu = { id: 'inicio', rotulo: 'Início', icone: 'inicio' };
const GRUPOS: GrupoMenu[] = [
  { id: 'estudos', rotulo: 'Estudos', itens: [
    { id: 'conteudos', rotulo: 'Conteúdos', icone: 'conteudos' },
    { id: 'ciclo', rotulo: 'Ciclo de estudos', icone: 'ciclo' },
  ] },
  { id: 'acompanhamento', rotulo: 'Acompanhamento', itens: [
    { id: 'dashboard', rotulo: 'Dashboard', icone: 'grafico' },
    { id: 'historico', rotulo: 'Histórico', icone: 'historico' },
  ] },
  { id: 'edital', rotulo: 'Edital e fontes', itens: [
    { id: 'edital', rotulo: 'Edital oficial', icone: 'edital' },
    { id: 'referencias', rotulo: 'Referências', icone: 'link' },
  ] },
  { id: 'config', rotulo: 'Configurações', itens: [
    { id: 'config/metas', rotulo: 'Metas e planejamento', icone: 'alvo' },
    { id: 'config/estudo', rotulo: 'Preferências de estudo', icone: 'livro' },
    { id: 'config/pomodoro', rotulo: 'Pomodoro', icone: 'sessoes' },
    { id: 'config/personalizacao', rotulo: 'Personalização', icone: 'paleta' },
    { id: 'config/dados', rotulo: 'Dados e backup', icone: 'banco' },
    { id: 'config/conta', rotulo: 'Conta e segurança', icone: 'escudo' },
  ] },
];
// "foco" é a tela cheia de estudo: fica fora do menu.
const ROTAS = new Set([INICIO.id, 'foco', ...GRUPOS.flatMap((g) => g.itens.map((i) => i.id))]);
// Endereços antigos continuam funcionando.
const ALIASES: Record<string, string> = { painel: 'dashboard', sessoes: 'historico', config: 'config/metas' };

// Roteamento por hash (#/ciclo, #/conteudos?d=lp): não depende de configuração no servidor.
function lerHash(): { rota: string; params: URLSearchParams } {
  const h = window.location.hash.replace(/^#\/?/, '');
  const [r0, q] = h.split('?');
  const r = ALIASES[r0] ?? r0;
  return { rota: ROTAS.has(r) ? r : 'inicio', params: new URLSearchParams(q ?? '') };
}
const grupoDe = (rota: string) => GRUPOS.find((g) => g.itens.some((i) => i.id === rota))?.id ?? null;

function lerFechados(): Set<string> {
  try {
    const v = JSON.parse(localStorage.getItem('estudo:menu-fechados') ?? 'null');
    if (Array.isArray(v)) return new Set(v);
  } catch {
    /* sem armazenamento local: usa o padrão */
  }
  return new Set(['config']);
}

const Logo = () => <img className="marca-emblema" src="marca/emblema-tce-go.webp" alt="" width={42} height={26} />;

function Shell() {
  const { dados, despachar, toasts, fecharToast, salvo, usuario, sair, prefs, definirPrefs } = useApp();
  const { confirmar, dialogo } = useConfirmacao();
  const [loc, setLoc] = useState(lerHash);
  const [menu, setMenu] = useState(false);
  const [fechados, setFechados] = useState<Set<string>>(lerFechados);
  const [topico, setTopico] = useState<string | null>(null);
  const [sessao, setSessao] = useState<{ aberto: boolean; preset?: PresetSessao }>({ aberto: false });
  const botaoMenu = useRef<HTMLButtonElement>(null);
  const recolhido = prefs.menuRecolhido;

  useEffect(() => {
    const h = () => {
      setLoc(lerHash());
      setMenu(false);
      document.getElementById('conteudo')?.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);

  // O grupo da página atual nunca fica fechado.
  useEffect(() => {
    const g = grupoDe(loc.rota);
    if (g && fechados.has(g)) setFechados((s) => { const n = new Set(s); n.delete(g); return n; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.rota]);

  useEffect(() => {
    try {
      localStorage.setItem('estudo:menu-fechados', JSON.stringify([...fechados]));
    } catch {
      /* preferência só desta aba */
    }
  }, [fechados]);

  // Esc fecha o menu no celular e devolve o foco ao botão.
  useEffect(() => {
    if (!menu) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenu(false);
        botaoMenu.current?.focus();
      }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [menu]);

  const navegar = useCallback((r: string) => {
    window.location.hash = `#/${r}`;
  }, []);

  const ui: UiCtx = useMemo(
    () => ({
      abrirTopico: (id) => setTopico(id),
      abrirSessao: (preset) => setSessao({ aberto: true, preset }),
      iniciarEstudo: (p) => {
        if (despachar({ t: 'timerIniciar', ...p, pausado: true }, 'Sessão pronta. Inicie quando quiser.')) {
          setTopico(null);
          navegar('foco');
        }
      },
      confirmar,
      navegar,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [despachar, navegar],
  );

  let pagina;
  switch (loc.rota) {
    case 'conteudos': pagina = <Conteudos key={loc.params.toString()} params={loc.params} />; break;
    case 'ciclo': pagina = <Ciclo />; break;
    case 'dashboard': pagina = <Dashboard />; break;
    case 'historico': pagina = <Historico />; break;
    case 'edital': pagina = <EditalOficial />; break;
    case 'referencias': pagina = <Referencias key={loc.params.toString()} params={loc.params} />; break;
    case 'config/metas': pagina = <ConfigMetas />; break;
    case 'config/estudo': pagina = <ConfigEstudo />; break;
    case 'config/pomodoro': pagina = <ConfigPomodoro />; break;
    case 'config/personalizacao': pagina = <ConfigPersonalizacao />; break;
    case 'config/dados': pagina = <ConfigDados />; break;
    case 'config/conta': pagina = <ConfigConta />; break;
    default: pagina = <Inicio />;
  }

  // A tela de foco só existe com um cronômetro em andamento.
  const emFoco = loc.rota === 'foco' && !!dados.user.timer;
  useEffect(() => {
    if (loc.rota === 'foco' && !dados.user.timer) navegar('inicio');
  }, [loc.rota, dados.user.timer, navegar]);

  const alternarGrupo = (id: string) =>
    setFechados((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const item = (i: ItemMenu) => (
    <li key={i.id}>
      <a href={`#/${i.id}`} className={`nav-item ${loc.rota === i.id ? 'ativo' : ''}`} aria-current={loc.rota === i.id ? 'page' : undefined} title={recolhido ? i.rotulo : undefined}>
        <Icone nome={i.icone} />
        <span className="nav-txt">{i.rotulo}</span>
      </a>
    </li>
  );

  const nomeExibido = usuario.nome || usuario.email.split('@')[0];
  const textoSalvo = salvo === 'salvo' ? 'Tudo salvo' : salvo === 'salvando' ? 'Salvando…' : salvo === 'erro' ? 'Sem conexão · tentando salvar' : 'Carregando';

  if (emFoco) {
    return (
      <Ui.Provider value={ui}>
        <Foco />
        <PomodoroMotor />
        {dialogo}
        <div className="toasts" role="status" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`toast toast-${t.tipo}`} role={t.tipo === 'erro' ? 'alert' : undefined}>
              <span>{t.texto}</span>
              <button className="btn-icone pq" aria-label="Fechar aviso" onClick={() => fecharToast(t.id)}><Icone nome="x" tam={15} /></button>
            </div>
          ))}
        </div>
      </Ui.Provider>
    );
  }

  return (
    <Ui.Provider value={ui}>
      <a className="pular" href="#conteudo" onClick={(e) => { e.preventDefault(); document.getElementById('conteudo')?.focus(); }}>Pular para o conteúdo</a>
      <div className={`app ${menu ? 'menu-aberto' : ''} ${recolhido ? 'recolhido' : ''}`}>
        <header className="topo-mobile">
          <button ref={botaoMenu} className="btn-icone" aria-label="Abrir menu" aria-expanded={menu} aria-controls="navegacao" onClick={() => setMenu((m) => !m)}><Icone nome="menu" tam={20} /></button>
          <span className="marca"><Logo /><span className="marca-txt"><b>Estudo TCE-GO</b></span></span>
          <span className={`salvo-${salvo}`} style={{ marginLeft: 'auto' }}><span className="ponto" role="img" aria-label={textoSalvo} /></span>
        </header>

        <nav className="lateral" id="navegacao" aria-label="Navegação principal">
          <div className="lat-topo">
            <a href="#/inicio" className="marca" aria-label="Estudo TCE-GO, início">
              <Logo />
              <span className="marca-txt"><b>Estudo TCE-GO</b><span>Cargo B02 · TI</span></span>
            </a>
          </div>

          <button className="lat-recolher" onClick={() => definirPrefs({ menuRecolhido: !recolhido })} aria-label={recolhido ? 'Expandir menu lateral' : 'Recolher menu lateral'} title={recolhido ? 'Expandir menu' : 'Recolher menu'}>
            <Icone nome={recolhido ? 'direita' : 'esquerda'} tam={14} />
          </button>

          <div className="nav">
            <ul>{item(INICIO)}</ul>
            {GRUPOS.map((g) => {
              const aberto = !fechados.has(g.id);
              return (
                <div key={g.id} className="nav-grupo">
                  <button className="nav-grupo-cab" aria-expanded={aberto} aria-controls={`grupo-${g.id}`} onClick={() => alternarGrupo(g.id)}>
                    <span className="nav-txt">{g.rotulo}</span>
                    <Icone nome="abaixo" tam={14} className="icone-seta" />
                  </button>
                  <div className={`nav-sub ${aberto ? '' : 'fechado'}`} id={`grupo-${g.id}`}>
                    <ul>{g.itens.map(item)}</ul>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="lat-rodape">
            {salvo !== 'salvo' && (
              <div className={`salvamento salvo-${salvo}`} role="status" aria-live="polite" title={recolhido ? textoSalvo : undefined}>
                <span className="ponto" aria-hidden="true" />
                <span>{textoSalvo}</span>
              </div>
            )}
            <div className="usuario">
              <Avatar usuario={usuario} />
              <span className="usuario-txt"><b>{nomeExibido}</b><span>{usuario.email}</span></span>
              <button className="btn-icone" onClick={() => void sair()} aria-label="Sair da conta" title="Sair"><Icone nome="sair" /></button>
            </div>
          </div>
        </nav>
        {menu && <div className="veu" onClick={() => setMenu(false)} aria-hidden="true" />}

        <main id="conteudo" tabIndex={-1}>
          {pagina}
        </main>
        <Cronometro />
      </div>
      <PomodoroMotor />
      <TopicoDetalhe id={topico} onFechar={() => setTopico(null)} />
      <SessaoForm aberto={sessao.aberto} preset={sessao.preset} onFechar={() => setSessao({ aberto: false })} />
      {dialogo}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tipo}`} role={t.tipo === 'erro' ? 'alert' : undefined}>
            <span>{t.texto}</span>
            <button className="btn-icone pq" aria-label="Fechar aviso" onClick={() => fecharToast(t.id)}><Icone nome="x" tam={15} /></button>
          </div>
        ))}
      </div>
    </Ui.Provider>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
