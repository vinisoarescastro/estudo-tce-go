import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../store/AppStore';
import { api } from '../../api';
import { Barra, Cabecalho, Icone, Painel } from '../../ui/primitives';
import { fmtMin, fmtPct } from '../../domain/util';
import { ChipSituacao, DetalhePessoa, textoUltimo, type Resumo } from './Acompanhamento';
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

// Administração de contas: só aparece para administradores (o servidor também confere).
// O administrador cria e gerencia contas e acompanha o progresso (só números: nada de notas nem de texto das sessões).
export function ConfigUsuarios() {
  const { usuario, avisar } = useApp();
  const { confirmar } = useUi();
  const [contas, setContas] = useState<Conta[] | null>(null);
  const [cargos, setCargos] = useState<CargoOpcao[]>([]);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: '', email: '', cargoId: '', senha: '' });
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resumos, setResumos] = useState<Record<number, Resumo | null>>({});
  const [vendo, setVendo] = useState<number | null>(null);
  const [redefinindo, setRedefinindo] = useState<{ id: number; nova: string } | null>(null);

  const carregar = useCallback(() => {
    api<{ usuarios: Conta[]; cargos: CargoOpcao[] }>('/api/admin/usuarios')
      .then((r) => {
        setContas(r.usuarios);
        setCargos(r.cargos);
        setErroLista(null);
      })
      .catch((e: Error) => setErroLista(e.message));
    api<{ resumos: Record<number, Resumo | null> }>('/api/admin/acompanhamento').then((r) => setResumos(r.resumos)).catch(() => undefined);
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
              <thead><tr><th>Pessoa</th><th>Cargo</th><th>Progresso do edital</th><th>Últimos 7 dias</th><th>Último estudo</th><th>Conta</th><th><span className="sr-only">Ações</span></th></tr></thead>
              <tbody>
                {contas.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <b style={{ fontWeight: 550 }}>{c.nome || c.email.split('@')[0]}</b>
                      <div className="nota">{c.email}</div>
                    </td>
                    <td><span className="chip chip-pri">{nomeCargo(c.cargoId)}</span></td>
                    <td style={{ minWidth: 170 }}>
                      {resumos[c.id] ? (
                        <>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}>
                            <Barra valor={resumos[c.id]!.pct} rotulo={`Progresso de ${c.nome}`} />
                            <b style={{ fontWeight: 550 }}>{fmtPct(resumos[c.id]!.pct)}</b>
                          </div>
                          <div className="nota">{resumos[c.id]!.concluidos} de {resumos[c.id]!.totalConteudos} · <ChipSituacao r={resumos[c.id]!} /></div>
                        </>
                      ) : <span className="nota">ainda não entrou</span>}
                    </td>
                    <td className="nota">{resumos[c.id] ? <>{fmtMin(resumos[c.id]!.minutos7)}<br />de {fmtMin(resumos[c.id]!.metaSemanalMin)}</> : '—'}</td>
                    <td className="nota">{resumos[c.id] ? <>{textoUltimo(resumos[c.id]!)}{resumos[c.id]!.diasSemEstudar !== null && resumos[c.id]!.diasSemEstudar! >= 4 && <> <span className="chip chip-aviso">parado</span></>}</> : '—'}</td>
                    <td>
                      <span className={`chip ${c.ativo ? 'chip-ok' : 'chip-erro'}`}>{c.ativo ? 'Ativa' : 'Desativada'}</span>{' '}
                      {c.papel === 'admin' && <span className="chip">Administrador</span>}{' '}
                      {c.senhaProvisoria && <span className="chip chip-aviso">Senha provisória</span>}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="btn pq" onClick={() => setVendo(vendo === c.id ? null : c.id)} aria-expanded={vendo === c.id}>Acompanhar</button>{' '}
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

      {vendo !== null && <DetalhePessoa id={vendo} nome={contas?.find((c) => c.id === vendo)?.nome || 'conta'} aoFechar={() => setVendo(null)} />}

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
