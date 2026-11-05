import { useState } from 'react';
import { api, type UsuarioPublico } from '../api';
import { Icone, Modal } from '../ui/primitives';

// Primeiro acesso com senha provisória (definida por um administrador): a pessoa precisa criar a
// própria senha antes de usar a plataforma. O servidor também bloqueia o restante da API até lá.
export function SenhaObrigatoria({ usuario, aoTrocar, aoSair }: { usuario: UsuarioPublico; aoTrocar: (u: UsuarioPublico) => void; aoSair: () => Promise<void> }) {
  const [form, setForm] = useState({ atual: '', nova: '', repetir: '' });
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (form.nova.length < 10) return setErro('A nova senha precisa ter pelo menos 10 caracteres.');
    if (form.nova !== form.repetir) return setErro('A confirmação não confere com a nova senha.');
    if (form.nova === form.atual) return setErro('A nova senha precisa ser diferente da provisória.');
    setEnviando(true);
    try {
      await api('/api/auth/senha', { metodo: 'POST', corpo: { atual: form.atual, nova: form.nova } });
      const r = await api<{ usuario: UsuarioPublico }>('/api/auth/eu');
      aoTrocar(r.usuario);
    } catch (err) {
      setErro((err as Error).message);
      setEnviando(false);
    }
  };

  return (
    <div className="carregando">
      <Modal titulo="Crie a sua senha" obrigatorio aberto onFechar={() => undefined} largura={440} subtitulo={`Olá, ${usuario.nome || usuario.email}! Sua conta foi criada com uma senha provisória. Escolha uma senha só sua para continuar.`}>
        <form className="form" onSubmit={enviar}>
          <div className="campo">
            <label htmlFor="so-atual">Senha provisória</label>
            <input id="so-atual" type="password" autoComplete="current-password" required value={form.atual} onChange={(e) => setForm({ ...form, atual: e.target.value })} />
          </div>
          <div className="campo">
            <label htmlFor="so-nova">Nova senha</label>
            <input id="so-nova" type="password" autoComplete="new-password" required minLength={10} value={form.nova} onChange={(e) => setForm({ ...form, nova: e.target.value })} aria-describedby="so-dica" />
            <span className="campo-ajuda" id="so-dica">Pelo menos 10 caracteres. Uma frase longa é mais segura e fácil de lembrar.</span>
          </div>
          <div className="campo">
            <label htmlFor="so-rep">Repita a nova senha</label>
            <input id="so-rep" type="password" autoComplete="new-password" required value={form.repetir} onChange={(e) => setForm({ ...form, repetir: e.target.value })} />
          </div>
          {erro && <p className="erro-form" role="alert"><Icone nome="alerta" tam={16} /> {erro}</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
            <button className="btn" type="button" onClick={() => void aoSair()}>Sair</button>
            <button className="btn primario" type="submit" disabled={enviando || !form.atual || !form.nova}>{enviando ? 'Salvando…' : 'Salvar nova senha'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
