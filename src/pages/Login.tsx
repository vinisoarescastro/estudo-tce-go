import { useState } from 'react';
import { api, type UsuarioPublico } from '../api';
import { Icone } from '../ui/primitives';
import type { Toast } from '../store/AppStore';

export function Login({ onEntrar, toasts, fecharToast }: { onEntrar: (u: UsuarioPublico) => void; toasts: Toast[]; fecharToast: (id: number) => void }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [ver, setVer] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const r = await api<{ usuario: UsuarioPublico }>('/api/auth/entrar', { metodo: 'POST', corpo: { email, senha }, silenciar401: true });
      setSenha('');
      onEntrar(r.usuario);
    } catch (e) {
      setErro((e as Error).message);
      setEnviando(false);
    }
  };

  return (
    <div className="login">
      <div className="login-card">
      <aside className="login-info" aria-labelledby="login-sobre">
        <img className="login-logo" src="marca/logo-tce-go.webp" alt="Tribunal de Contas do Estado de Goiás" width={160} height={133} />
        <div className="login-txt">
          <p className="login-sobre-rot">TCE-GO · Edital nº 01/2026</p>
          <h2 id="login-sobre">Sua preparação para Tecnologia da Informação</h2>
          <p>Cargo B02. Organize seu ciclo de estudos, acompanhe o edital e registre suas horas, tudo em um só lugar.</p>
        </div>
      </aside>

      <main className="login-lado">
        <div className="login-caixa" aria-labelledby="login-titulo">
          <div className="login-titulo">
            <h1 id="login-titulo">Bem-vindo de volta</h1>
            <p>Entre com a conta da plataforma para continuar seus estudos.</p>
          </div>
          <form className="form" onSubmit={entrar} noValidate>
            <div className="campo">
              <label htmlFor="lg-email">E-mail</label>
              <input id="lg-email" type="email" autoComplete="username" required autoFocus placeholder="voce@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!erro} />
            </div>
            <div className="campo">
              <label htmlFor="lg-senha">Senha</label>
              <div className="campo-senha">
                <input id="lg-senha" type={ver ? 'text' : 'password'} autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} aria-invalid={!!erro} aria-describedby={erro ? 'lg-erro' : undefined} />
                <button type="button" className="btn-icone" onClick={() => setVer((v) => !v)} aria-label={ver ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={ver}>
                  <Icone nome={ver ? 'olhoFechado' : 'olho'} tam={16} />
                </button>
              </div>
            </div>
            {erro && (
              <p className="erro-form" id="lg-erro" role="alert">
                <Icone nome="alerta" tam={16} /> {erro}
              </p>
            )}
            <button type="submit" className="btn primario grande" disabled={enviando || !email || !senha}>
              {enviando && <span className="girador" aria-hidden="true" />}
              {enviando ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        </div>
      </main>
      </div>

      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tipo}`}>
            <span>{t.texto}</span>
            <button className="btn-icone pq" aria-label="Fechar aviso" onClick={() => fecharToast(t.id)}><Icone nome="x" tam={15} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
