import { useCallback, useEffect, useRef, useState } from 'react';
import { Avatar } from '../../ui/Avatar';
import { useApp, seed } from '../../store/AppStore';
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

// Lê a imagem escolhida, recorta o centro em quadrado e reduz para 400 × 400 (WebP, ou JPEG se o
// navegador não gerar WebP). Assim qualquer foto de celular cabe no limite de 2 MB.
function prepararFoto(arquivo: File): Promise<string> {
  return new Promise((ok, falha) => {
    if (!/^image\/(png|jpeg|webp)$/.test(arquivo.type)) return falha(new Error('Use uma imagem .webp, .png ou .jpg.'));
    const leitor = new FileReader();
    leitor.onerror = () => falha(new Error('Não foi possível ler o arquivo.'));
    leitor.onload = () => {
      const img = new Image();
      img.onerror = () => falha(new Error('Não foi possível abrir a imagem.'));
      img.onload = () => {
        const lado = Math.min(img.naturalWidth, img.naturalHeight);
        const tam = Math.min(400, lado);
        const tela = document.createElement('canvas');
        tela.width = tam;
        tela.height = tam;
        const ctx = tela.getContext('2d');
        if (!ctx) return falha(new Error('Seu navegador não conseguiu preparar a imagem.'));
        ctx.drawImage(img, (img.naturalWidth - lado) / 2, (img.naturalHeight - lado) / 2, lado, lado, 0, 0, tam, tam);
        let url = tela.toDataURL('image/webp', 0.85);
        if (!url.startsWith('data:image/webp')) url = tela.toDataURL('image/jpeg', 0.88);
        ok(url);
      };
      img.src = String(leitor.result);
    };
    leitor.readAsDataURL(arquivo);
  });
}

export function ConfigConta() {
  const { usuario, avisar, sair, recarregarUsuario } = useApp();
  const entradaFoto = useRef<HTMLInputElement>(null);
  const [enviandoFoto, setEnviandoFoto] = useState(false);

  const escolherFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    setEnviandoFoto(true);
    try {
      const imagem = await prepararFoto(arquivo);
      await api('/api/perfil/foto', { metodo: 'POST', corpo: { imagem } });
      await recarregarUsuario();
      avisar('ok', 'Foto atualizada.');
    } catch (err) {
      avisar('erro', (err as Error).message);
    } finally {
      setEnviandoFoto(false);
    }
  };
  const removerFoto = async () => {
    setEnviandoFoto(true);
    try {
      await api('/api/perfil/foto/remover', { metodo: 'POST' });
      await recarregarUsuario();
      avisar('ok', 'Foto removida.');
    } catch (err) {
      avisar('erro', (err as Error).message);
    } finally {
      setEnviandoFoto(false);
    }
  };
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
              <h2>Foto de perfil</h2>
              <p>Aparece no menu lateral. Aceita .png, .jpg ou .webp; a imagem é recortada em quadrado e reduzida automaticamente.</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <Avatar usuario={usuario} tam={72} />
              <input ref={entradaFoto} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={escolherFoto} />
              <button className="btn" onClick={() => entradaFoto.current?.click()} disabled={enviandoFoto}>{enviandoFoto ? 'Enviando…' : usuario.foto ? 'Trocar foto' : 'Escolher foto'}</button>
              {usuario.foto && <button className="btn" onClick={() => void removerFoto()} disabled={enviandoFoto}>Remover foto</button>}
            </div>
          </div>
          <div className="config-secao">
            <div className="config-desc">
              <h2>Conta</h2>
              <p>A conta e o cargo são definidos na criação e não mudam depois.</p>
            </div>
            <dl className="dados-linhas">
              <div><dt>E-mail</dt><dd>{usuario.email}</dd></div>
              {usuario.nome && <div><dt>Nome</dt><dd>{usuario.nome}</dd></div>}
              <div><dt>Perfil</dt><dd>{usuario.papel === 'admin' ? 'Administrador' : 'Usuário'}</dd></div>
              {seed.cargo && <div><dt>Cargo</dt><dd>{seed.cargo.codigo} · {seed.cargo.nome}</dd></div>}
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
              <p className="campo-ajuda">Esqueceu a senha? Peça ao administrador para redefini-la.</p>
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
