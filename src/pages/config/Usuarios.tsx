import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../store/AppStore';
import { api } from '../../api';
import { Cabecalho, Icone, Painel } from '../../ui/primitives';
import { useUi } from '../../ui/UiContext';

interface Conta {
  id: number;
  email: string;
  nome: string;
  papel: 'admin' | 'usuario';
  ativo: boolean;
  cargoId: string;
  senhaProvisoria: boolean;
  criadoEm: string;
  ultimoAcesso: string | null;
}
interface CargoOpcao { id: string; codigo: string; nome: string; nomeCurto: string }

const quando = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'nunca entrou';

// Administração de contas: só aparece para administradores (o servidor também confere).
// O administrador cria e gerencia contas, mas não vê os dados de estudo de ninguém.
export function ConfigUsuarios() {
  const { usuario, avisar } = useApp();
  const { confirmar } = useUi();
  const [contas, setContas] = useState<Conta[] | null>(null);
  const [cargos, setCargos] = useState<CargoOpcao[]>([]);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: '', email: '', cargoId: '', senha: '' });
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [redefinindo, setRedefinindo] = useState<{ id: number; nova: string } | null>(null);

  const carregar = useCallback(() => {
    api<{ usuarios: Conta[]; cargos: CargoOpcao[] }>('/api/admin/usuarios')
      .then((r) => {
        setContas(r.usuarios);
        setCargos(r.cargos);
        setErroLista(null);
      })
      .catch((e: Error) => setErroLista(e.message));
  }, []);
  useEffect(carregar, [carregar]);

  const criar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (!form.cargoId) return setErro('Escolha o cargo. Ele não poderá ser trocado depois.');
    if (form.senha.length < 10) return setErro('A senha provisória precisa ter pelo menos 10 caracteres.');
    setEnviando(true);
    try {
      await api('/api/admin/usuarios', { metodo: 'POST', corpo: form });
      setForm({ nome: '', email: '', cargoId: '', senha: '' });
      avisar('ok', 'Conta criada. Passe a senha provisória à pessoa; ela será convidada a trocá-la no primeiro acesso.');
      carregar();
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  const alternarAtivo = async (c: Conta) => {
    const desativar = c.ativo;
    const ok = await confirmar(
      desativar ? 'Desativar esta conta?' : 'Reativar esta conta?',
      desativar
        ? `${c.nome || c.email} será desconectado(a) e não conseguirá entrar. Os dados de estudo são mantidos e voltam se você reativar a conta.`
        : `${c.nome || c.email} poderá entrar de novo e encontrará os estudos como estavam.`,
      desativar ? 'Desativar' : 'Reativar',
    );
    if (!ok) return;
    try {
      await api('/api/admin/usuarios/ativo', { metodo: 'POST', corpo: { id: c.id, ativo: !c.ativo } });
      avisar('ok', desativar ? 'Conta desativada.' : 'Conta reativada.');
      carregar();
    } catch (err) {
      avisar('erro', (err as Error).message);
    }
  };

  const redefinir = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!redefinindo) return;
    try {
      await api('/api/admin/usuarios/senha', { metodo: 'POST', corpo: redefinindo });
      avisar('ok', 'Senha redefinida. As sessões abertas dessa conta foram encerradas.');
      setRedefinindo(null);
      carregar();
    } catch (err) {
      avisar('erro', (err as Error).message);
    }
  };

  const nomeCargo = (id: string) => cargos.find((c) => c.id === id)?.codigo ?? id;

  return (
    <div className="pagina">
      <Cabecalho
        sobre="Configurações"
        titulo="Usuários"
        subtitulo="Crie contas para outras pessoas estudarem. Cada conta tem os seus próprios estudos, progresso, ciclo e configurações."
      />

      <Painel titulo="Nova conta" info="O cargo define o edital verticalizado da conta e não pode ser trocado depois. A senha provisória deve ser repassada à pessoa por um canal seguro; ela será convidada a trocá-la no primeiro acesso.">
        <form className="form form-grade" onSubmit={criar}>
          <div className="campo">
            <label htmlFor="u-nome">Nome</label>
            <input id="u-nome" required maxLength={80} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} autoComplete="off" />
          </div>
          <div className="campo">
            <label htmlFor="u-email">E-mail</label>
            <input id="u-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="off" />
          </div>
          <div className="campo">
            <label htmlFor="u-cargo">Cargo</label>
            <select id="u-cargo" required value={form.cargoId} onChange={(e) => setForm({ ...form, cargoId: e.target.value })}>
              <option value="">Escolha…</option>
              {cargos.map((c) => <option key={c.id} value={c.id}>{c.codigo} · {c.nome}</option>)}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="u-senha">Senha provisória</label>
            <input id="u-senha" type="text" required minLength={10} value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} autoComplete="off" aria-describedby="u-senha-dica" />
            <span className="campo-ajuda" id="u-senha-dica">Pelo menos 10 caracteres.</span>
          </div>
          {erro && <p className="erro-form" role="alert"><Icone nome="alerta" tam={16} /> {erro}</p>}
          <div><button className="btn primario" type="submit" disabled={enviando}>{enviando ? 'Criando…' : 'Criar conta'}</button></div>
        </form>
      </Painel>

      <Painel titulo="Contas" semPadding>
        {erroLista ? (
          <p className="erro-form" role="alert" style={{ margin: 16 }}><Icone nome="alerta" tam={16} /> {erroLista}</p>
        ) : contas === null ? (
          <p className="nota" style={{ margin: 16 }}>Carregando…</p>
        ) : (
          <div className="tabela-wrap">
            <table className="tabela">
              <thead><tr><th>Pessoa</th><th>Cargo</th><th>Situação</th><th>Último acesso</th><th><span className="sr-only">Ações</span></th></tr></thead>
              <tbody>
                {contas.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <b style={{ fontWeight: 550 }}>{c.nome || c.email.split('@')[0]}</b>
                      <div className="nota">{c.email}</div>
                    </td>
                    <td><span className="chip chip-pri">{nomeCargo(c.cargoId)}</span></td>
                    <td>
                      <span className={`chip ${c.ativo ? 'chip-ok' : 'chip-erro'}`}>{c.ativo ? 'Ativa' : 'Desativada'}</span>{' '}
                      {c.papel === 'admin' && <span className="chip">Administrador</span>}{' '}
                      {c.senhaProvisoria && <span className="chip chip-aviso">Senha provisória</span>}
                    </td>
                    <td className="nota">{quando(c.ultimoAcesso)}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {c.id !== usuario.id && (
                        <>
                          <button className="btn pq" onClick={() => setRedefinindo({ id: c.id, nova: '' })}>Redefinir senha</button>{' '}
                          <button className="btn pq" onClick={() => void alternarAtivo(c)}>{c.ativo ? 'Desativar' : 'Reativar'}</button>
                        </>
                      )}
                      {c.id === usuario.id && <span className="nota">você</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Painel>

      {redefinindo && (
        <Painel titulo="Redefinir senha">
          <form className="form form-grade" onSubmit={redefinir}>
            <div className="campo">
              <label htmlFor="u-nova">Nova senha provisória para {contas?.find((c) => c.id === redefinindo.id)?.email}</label>
              <input id="u-nova" type="text" required minLength={10} autoFocus value={redefinindo.nova} onChange={(e) => setRedefinindo({ ...redefinindo, nova: e.target.value })} autoComplete="off" />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn primario" type="submit" disabled={redefinindo.nova.length < 10}>Redefinir</button>
              <button className="btn" type="button" onClick={() => setRedefinindo(null)}>Cancelar</button>
            </div>
          </form>
        </Painel>
      )}
    </div>
  );
}
