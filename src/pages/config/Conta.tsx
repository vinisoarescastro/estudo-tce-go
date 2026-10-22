import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../store/AppStore';
import { api } from '../../api';
import { Cabecalho, Icone, Painel, Vazio } from '../../ui/primitives';
import { useUi } from '../../ui/UiContext';

interface SessaoLogin { atual: boolean; criadaEm: string; ultimoUso: string; expiraEm: string; ip: string; agente: string }

const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// Descreve o navegador de forma curta a partir do user-agent.
function navegador(ua: string): string {
  const nav = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Navegador';
  const so = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return so ? `${nav} · ${so}` : nav;
}

export function ConfigConta() {
  const { usuario, avisar, sair } = useApp();
  const { confirmar } = useUi();
  const [sessoes, setSessoes] = useState<SessaoLogin[] | null>(null);
  const [form, setForm] = useState({ atual: '', nova: '', repetir: '' });
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(() => {
    api<{ sessoes: SessaoLogin[] }>('/api/auth/sessoes').then((r) => setSessoes(r.sessoes)).catch(() => setSessoes([]));
  }, []);
  useEffect(carregar, [carregar]);

  const trocar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (form.nova !== form.repetir) return setErro('A confirmação não confere com a nova senha.');
    if (form.nova.length < 10) return setErro('A nova senha precisa ter pelo menos 10 caracteres.');
    setEnviando(true);
    try {
      await api('/api/auth/senha', { metodo: 'POST', corpo: { atual: form.atual, nova: form.nova } });
      setForm({ atual: '', nova: '', repetir: '' });
      avisar('ok', 'Senha alterada. As sessões em outros dispositivos foram encerradas.');
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  const encerrarOutras = async () => {
    if (!(await confirmar('Encerrar outras sessões?', 'Todos os outros dispositivos e navegadores precisarão entrar de novo. Esta sessão continua ativa.', 'Encerrar'))) return;
    try {
      const r = await api<{ encerradas: number }>('/api/auth/encerrar-outras', { metodo: 'POST' });
      avisar('ok', r.encerradas ? `${r.encerradas} sessão(ões) encerrada(s).` : 'Não havia outras sessões abertas.');
      carregar();
    } catch (e) {
      avisar('erro', (e as Error).message);
    }
  };

  const outras = sessoes?.filter((s) => !s.atual).length ?? 0;

  return (
    <div className="pagina pagina-estreita">
      <Cabecalho
        sobre="Configurações"
        titulo="Conta e segurança"
        subtitulo="Dados de acesso, senha e dispositivos conectados."
        acoes={<button className="btn" onClick={() => void sair()}><Icone nome="sair" tam={15} /> Sair</button>}
      />
      <Painel>
        <div className="config">
          <div className="config-secao">
            <div className="config-desc">
              <h2>Conta</h2>
              <p>A conta é criada e gerenciada pelo terminal do servidor.</p>
            </div>
            <dl className="dados-linhas">
              <div><dt>E-mail</dt><dd>{usuario.email}</dd></div>
              {usuario.nome && <div><dt>Nome</dt><dd>{usuario.nome}</dd></div>}
              <div><dt>Perfil</dt><dd>{usuario.papel === 'admin' ? 'Administrador' : 'Usuário'}</dd></div>
              <div><dt>Criada em</dt><dd>{quando(usuario.criadoEm)}</dd></div>
              <div><dt>Senha alterada em</dt><dd>{quando(usuario.senhaAlteradaEm)}</dd></div>
            </dl>
          </div>
          <div className="config-secao">
            <div className="config-desc">
              <h2>Alterar senha</h2>
              <p>Pelo menos 10 caracteres. As sessões em outros dispositivos são encerradas.</p>
            </div>
            <form className="form" onSubmit={trocar} style={{ maxWidth: 380 }}>
              <div className="campo">
                <label htmlFor="sn-atual">Senha atual</label>
                <input id="sn-atual" type="password" autoComplete="current-password" required value={form.atual} onChange={(e) => setForm({ ...form, atual: e.target.value })} />
              </div>
              <div className="campo">
                <label htmlFor="sn-nova">Nova senha</label>
                <input id="sn-nova" type="password" autoComplete="new-password" required minLength={10} value={form.nova} onChange={(e) => setForm({ ...form, nova: e.target.value })} aria-describedby="sn-dica" />
                <span className="campo-ajuda" id="sn-dica">Uma frase longa é mais segura e fácil de lembrar.</span>
              </div>
              <div className="campo">
                <label htmlFor="sn-rep">Repita a nova senha</label>
                <input id="sn-rep" type="password" autoComplete="new-password" required value={form.repetir} onChange={(e) => setForm({ ...form, repetir: e.target.value })} />
              </div>
              {erro && <p className="erro-form" role="alert"><Icone nome="alerta" tam={16} /> {erro}</p>}
              <div><button className="btn primario" type="submit" disabled={enviando || !form.atual || !form.nova}>{enviando ? 'Salvando…' : 'Alterar senha'}</button></div>
              <p className="campo-ajuda">Esqueceu a senha? Redefina no servidor com <code>npm run usuario:senha -- --email {usuario.email}</code>.</p>
            </form>
          </div>
          <div className="config-secao">
            <div className="config-desc">
              <h2>Sessões ativas</h2>
              <p>Expiram após 7 dias sem uso ou 30 dias no total. Após 5 senhas erradas, o login fica bloqueado por 15 minutos.</p>
            </div>
            <div className="config-campos">
              {sessoes === null ? (
                <p className="nota">Carregando…</p>
              ) : sessoes.length === 0 ? (
                <Vazio icone="escudo">Nenhuma sessão encontrada.</Vazio>
              ) : (
                <ul className="lista dispositivos">
                  {sessoes.map((s, i) => (
                    <li key={i}>
                      <Icone nome={s.atual ? 'check' : 'usuario'} tam={17} />
                      <div>
                        <span><b style={{ fontWeight: 550 }}>{navegador(s.agente)}</b> {s.atual && <span className="chip chip-ok">esta sessão</span>}</span>
                        <span className="nota">Último uso {quando(s.ultimoUso)}{s.ip ? ` · IP ${s.ip}` : ''}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div><button className="btn" onClick={encerrarOutras} disabled={!outras}>Encerrar as outras sessões</button></div>
            </div>
          </div>
        </div>
      </Painel>
    </div>
  );
}
