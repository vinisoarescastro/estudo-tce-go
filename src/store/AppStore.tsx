import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppData, Seed } from '../domain/types';
import { reduzir, ErroAcao, type Acao } from '../domain/actions';
import { definirFuso, uid } from '../domain/util';
import { api, definirAoExpirar, ErroApi, type Preferencias, type UsuarioPublico } from '../api';
import { POMODORO_PADRAO } from '../domain/pomodoro';
import { definirSeed, seed } from './seed';
import { Login } from '../pages/Login';

export { seed };

export type Toast = { id: number; tipo: 'ok' | 'erro' | 'info'; texto: string };
export type EstadoSalvo = 'carregando' | 'salvo' | 'salvando' | 'erro';

interface Ctx {
  dados: AppData;
  despachar: (a: Acao, msgOk?: string) => boolean;
  toasts: Toast[];
  avisar: (tipo: Toast['tipo'], texto: string) => void;
  fecharToast: (id: number) => void;
  salvo: EstadoSalvo;
  usuario: UsuarioPublico;
  sair: () => Promise<void>;
  prefs: Preferencias;
  definirPrefs: (p: Partial<Preferencias>) => void;
}

const AppCtx = createContext<Ctx | null>(null);

// Uma ação aplicada na tela e ainda não confirmada pelo servidor. Guarda o horário e os ids
// usados, para o servidor reproduzir exatamente o mesmo resultado.
interface Pendente {
  acao: Acao;
  agora: number;
  ids: string[];
  resultado: AppData;
  msgErro?: string;
}

function aplicar(base: AppData, acao: Acao, agora: number, ids?: string[]): { dados: AppData; ids: string[] } {
  const usados: string[] = [];
  const fila = ids ? [...ids] : null;
  const gerarId = (p: string) => {
    const id = fila?.shift() ?? uid(p);
    usados.push(id);
    return id;
  };
  definirFuso(base.user.config.fusoHorario);
  const dados = reduzir(base, acao, { seed, agora, gerarId });
  definirFuso(dados.user.config.fusoHorario);
  return { dados, ids: usados };
}

const PREFS_PADRAO: Preferencias = { tema: 'sistema', menuRecolhido: false, pomodoro: POMODORO_PADRAO };

export function AppProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioPublico | null | undefined>(undefined);
  const [dados, setDados] = useState<AppData | null>(null);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [salvo, setSalvo] = useState<EstadoSalvo>('carregando');
  const [prefs, setPrefs] = useState<Preferencias>(PREFS_PADRAO);

  const confirmado = useRef<{ dados: AppData; versao: number } | null>(null);
  const pendentes = useRef<Pendente[]>([]);
  const enviando = useRef(false);
  const tentativa = useRef(0);
  const atual = useRef<AppData | null>(null);
  const usuarioId = useRef<number | null>(null);

  const avisar = useCallback((tipo: Toast['tipo'], texto: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, tipo, texto }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tipo === 'erro' ? 7000 : 3500);
  }, []);
  const fecharToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const mostrar = useCallback((d: AppData) => {
    atual.current = d;
    definirFuso(d.user.config.fusoHorario);
    setDados(d);
  }, []);

  // Reaplica as ações ainda pendentes sobre um novo estado confirmado pelo servidor.
  const rebasear = useCallback(() => {
    let d = confirmado.current!.dados;
    const mantidas: Pendente[] = [];
    for (const p of pendentes.current) {
      try {
        const r = aplicar(d, p.acao, p.agora, p.ids);
        d = r.dados;
        mantidas.push({ ...p, resultado: d });
      } catch (e) {
        avisar('erro', e instanceof ErroAcao ? `Uma alteração não pôde ser aplicada: ${e.message}` : 'Uma alteração não pôde ser aplicada.');
      }
    }
    pendentes.current = mantidas;
    mostrar(d);
  }, [avisar, mostrar]);

  const enviar = useCallback(async () => {
    if (enviando.current || !confirmado.current) return;
    enviando.current = true;
    while (pendentes.current.length) {
      const p = pendentes.current[0];
      setSalvo('salvando');
      try {
        const r: { versao: number; dados?: AppData } = await api<{ versao: number; dados?: AppData }>('/api/acoes', { metodo: 'POST', corpo: { acao: p.acao, versaoBase: confirmado.current.versao, agora: p.agora, ids: p.ids } });
        tentativa.current = 0;
        pendentes.current.shift();
        if (r.dados) {
          confirmado.current = { dados: r.dados, versao: r.versao };
          rebasear();
        } else {
          confirmado.current = { dados: p.resultado, versao: r.versao };
        }
      } catch (e) {
        const err = e as ErroApi;
        if (err.status === 401) break; // volta ao login; a fila continua depois de entrar de novo
        if (err.status >= 400 && err.status < 500) {
          // O servidor recusou a alteração: descarta e volta ao estado dele.
          pendentes.current.shift();
          avisar('erro', err.message);
          try {
            const d = await api<{ versao: number; dados: AppData }>('/api/dados');
            confirmado.current = { dados: d.dados, versao: d.versao };
          } catch {
            /* mantém o último estado confirmado */
          }
          rebasear();
          continue;
        }
        // Rede ou servidor indisponível: tenta de novo com espera crescente.
        setSalvo('erro');
        if (tentativa.current === 0) avisar('erro', `${err.message} As alterações ficam guardadas nesta aba e serão enviadas automaticamente.`);
        const espera = Math.min(30_000, 2000 * 2 ** tentativa.current++);
        enviando.current = false;
        window.setTimeout(() => void enviar(), espera);
        return;
      }
    }
    enviando.current = false;
    if (!pendentes.current.length) setSalvo('salvo');
  }, [avisar, rebasear]);

  const carregar = useCallback(async (u: UsuarioPublico) => {
    setErroCarga(null);
    try {
      const [s, d, p] = await Promise.all([
        api<Seed>('/api/edital'),
        api<{ versao: number; dados: AppData }>('/api/dados'),
        api<Preferencias>('/api/preferencias'),
      ]);
      definirSeed(s);
      if (usuarioId.current !== u.id) pendentes.current = [];
      usuarioId.current = u.id;
      confirmado.current = { dados: d.dados, versao: d.versao };
      setPrefs({ ...PREFS_PADRAO, ...p });
      rebasear();
      setSalvo(pendentes.current.length ? 'salvando' : 'salvo');
      void enviar();
    } catch (e) {
      if ((e as ErroApi).status !== 401) setErroCarga((e as Error).message);
    }
  }, [enviar, rebasear]);

  const entrou = useCallback((u: UsuarioPublico) => {
    setUsuario(u);
    void carregar(u);
  }, [carregar]);

  // Verifica a sessão ao abrir.
  useEffect(() => {
    definirAoExpirar(() => {
      setUsuario(null);
      avisar('info', 'Sua sessão expirou. Entre novamente para continuar.');
    });
    api<{ usuario: UsuarioPublico }>('/api/auth/eu', { silenciar401: true })
      .then((r) => entrou(r.usuario))
      .catch((e: ErroApi) => {
        if (e.status === 401) setUsuario(null);
        else setErroCarga(e.message);
      });
    return () => definirAoExpirar(null);
  }, [avisar, entrou]);

  // Ao voltar para a aba, busca mudanças feitas em outro dispositivo.
  useEffect(() => {
    const h = async () => {
      if (document.visibilityState !== 'visible' || !confirmado.current || pendentes.current.length || enviando.current) return;
      try {
        const r = await api<{ versao: number; dados?: AppData; inalterado?: boolean }>(`/api/dados?versao=${confirmado.current.versao}`);
        if (r.dados && !pendentes.current.length) {
          confirmado.current = { dados: r.dados, versao: r.versao };
          rebasear();
        }
      } catch {
        /* tenta na próxima vez */
      }
    };
    document.addEventListener('visibilitychange', h);
    return () => document.removeEventListener('visibilitychange', h);
  }, [rebasear]);

  // Avisa antes de fechar a aba com alterações ainda não gravadas no servidor.
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (pendentes.current.length) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, []);

  // Tema escolhido nas preferências.
  useEffect(() => {
    const el = document.documentElement;
    if (prefs.tema === 'sistema') delete el.dataset.theme;
    else el.dataset.theme = prefs.tema === 'escuro' ? 'dark' : 'light';
  }, [prefs.tema]);

  const despachar = useCallback(
    (a: Acao, msgOk?: string) => {
      if (!atual.current) return false;
      try {
        const agora = Date.now();
        const r = aplicar(atual.current, a, agora);
        if (r.dados === atual.current) {
          if (msgOk) avisar('ok', msgOk);
          return true;
        }
        pendentes.current.push({ acao: a, agora, ids: r.ids, resultado: r.dados });
        mostrar(r.dados);
        if (msgOk) avisar('ok', msgOk);
        void enviar();
        return true;
      } catch (e) {
        avisar('erro', e instanceof ErroAcao ? e.message : 'Algo deu errado ao aplicar a alteração.');
        if (!(e instanceof ErroAcao)) console.error(e);
        return false;
      }
    },
    [avisar, enviar, mostrar],
  );

  const definirPrefs = useCallback((p: Partial<Preferencias>) => {
    setPrefs((atualP) => {
      const novo = { ...atualP, ...p };
      api<Preferencias>('/api/preferencias', { metodo: 'PUT', corpo: novo }).catch((e: Error) => avisar('erro', `Preferência não salva: ${e.message}`));
      return novo;
    });
  }, [avisar]);

  const sair = useCallback(async () => {
    if (pendentes.current.length) {
      avisar('erro', 'Ainda há alterações sendo salvas. Aguarde um instante e tente sair de novo.');
      return;
    }
    try {
      await api('/api/auth/sair', { metodo: 'POST' });
    } catch {
      /* a sessão é encerrada no servidor mesmo que a resposta se perca */
    }
    confirmado.current = null;
    atual.current = null;
    usuarioId.current = null;
    setDados(null);
    setUsuario(null);
  }, [avisar]);

  const value = useMemo(
    () => (dados && usuario ? { dados, despachar, toasts, avisar, fecharToast, salvo, usuario, sair, prefs, definirPrefs } : null),
    [dados, despachar, toasts, avisar, fecharToast, salvo, usuario, sair, prefs, definirPrefs],
  );

  if (erroCarga)
    return (
      <div className="carregando">
        <div className="carregando-caixa">
          <b>Não foi possível carregar seus dados.</b>
          <p className="nota">{erroCarga}</p>
          <button className="btn primario" onClick={() => (usuario ? carregar(usuario) : window.location.reload())}>Tentar de novo</button>
        </div>
      </div>
    );
  if (usuario === null) return <Login onEntrar={entrou} toasts={toasts} fecharToast={fecharToast} />;
  if (!value) return <div className="carregando" role="status"><span className="girador" aria-hidden="true" />Carregando seus dados…</div>;
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error('useApp fora do AppProvider');
  return c;
}
