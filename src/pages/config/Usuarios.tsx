import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../../store/AppStore';
import { api } from '../../api';
import { Barra, Cabecalho, Icone, Modal, Painel } from '../../ui/primitives';
import { fmtMin, fmtPct } from '../../domain/util';
import { ChipSituacao, textoUltimo, type Resumo } from './Acompanhamento';
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

type Filtro = 'todas' | 'paradas' | 'atrasadas' | 'nunca' | 'inativas';
type Ordem = 'nome' | 'progresso' | 'recente' | 'parados';

const DIAS_PARADO = 4;
const nomeDe = (c: Conta) => c.nome || c.email.split('@')[0];

// Administração de contas: só aparece para administradores (o servidor também confere).
// O administrador cria e gerencia contas e acompanha o progresso (só números: nada de notas nem de texto das sessões).
export function ConfigUsuarios() {
  const { usuario, avisar } = useApp();
  const { confirmar } = useUi();
  const [contas, setContas] = useState<Conta[] | null>(null);
  const [cargos, setCargos] = useState<CargoOpcao[]>([]);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [resumos, setResumos] = useState<Record<number, Resumo | null>>({});
  const [criando, setCriando] = useState(false);
  const [form, setForm] = useState({ nome: '', email: '', cargoId: '', senha: '' });
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [gerenciando, setGerenciando] = useState<number | null>(null);
  const [nova, setNova] = useState('');
  const [busca, setBusca] = useState('');
  const [cargoFiltro, setCargoFiltro] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [ordem, setOrdem] = useState<Ordem>('nome');

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

  const nomeCargo = (id: string) => cargos.find((c) => c.id === id)?.codigo ?? id;

  const parada = (c: Conta) => { const r = resumos[c.id]; return !!r && r.diasSemEstudar !== null && r.diasSemEstudar >= DIAS_PARADO; };
  const nuncaEstudou = (c: Conta) => { const r = resumos[c.id]; return !r || r.ultimoEstudo === null; };
  const atrasada = (c: Conta) => resumos[c.id]?.situacao === 'atras';

  const contagens = useMemo(() => {
    const l = contas ?? [];
    return {
      todas: l.length,
      paradas: l.filter((c) => c.ativo && parada(c)).length,
      atrasadas: l.filter((c) => c.ativo && atrasada(c)).length,
      nunca: l.filter((c) => c.ativo && nuncaEstudou(c)).length,
      inativas: l.filter((c) => !c.ativo).length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contas, resumos]);

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const lista = (contas ?? []).filter((c) => {
      if (q && !`${c.nome} ${c.email}`.toLowerCase().includes(q)) return false;
      if (cargoFiltro && c.cargoId !== cargoFiltro) return false;
      if (filtro === 'paradas') return c.ativo && parada(c);
      if (filtro === 'atrasadas') return c.ativo && atrasada(c);
      if (filtro === 'nunca') return c.ativo && nuncaEstudou(c);
      if (filtro === 'inativas') return !c.ativo;
      return true;
    });
    const dias = (c: Conta) => resumos[c.id]?.diasSemEstudar ?? Number.MAX_SAFE_INTEGER;
    const porNome = (a: Conta, b: Conta) => nomeDe(a).localeCompare(nomeDe(b), 'pt-BR');
    return lista.sort((a, b) => {
      if (ordem === 'progresso') return (resumos[b.id]?.pct ?? -1) - (resumos[a.id]?.pct ?? -1) || porNome(a, b);
      if (ordem === 'recente') return dias(a) - dias(b) || porNome(a, b);
      if (ordem === 'parados') return dias(b) - dias(a) || porNome(a, b);
      return porNome(a, b);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contas, resumos, busca, cargoFiltro, filtro, ordem]);

  const criar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (!form.cargoId) return setErro('Escolha o cargo. Ele não poderá ser trocado depois.');
    if (form.senha.length < 10) return setErro('A senha provisória precisa ter pelo menos 10 caracteres.');
    setEnviando(true);
    try {
      await api('/api/admin/usuarios', { metodo: 'POST', corpo: form });
      setForm({ nome: '', email: '', cargoId: '', senha: '' });
      setCriando(false);
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
        ? `${nomeDe(c)} será desconectado(a) e não conseguirá entrar. Os dados de estudo são mantidos e voltam se você reativar a conta.`
        : `${nomeDe(c)} poderá entrar de novo e encontrará os estudos como estavam.`,
      desativar ? 'Desativar' : 'Reativar',
    );
    if (!ok) return;
    try {
      await api('/api/admin/usuarios/ativo', { metodo: 'POST', corpo: { id: c.id, ativo: !c.ativo } });
      avisar('ok', desativar ? 'Conta desativada.' : 'Conta reativada.');
      setGerenciando(null);
      carregar();
    } catch (err) {
      avisar('erro', (err as Error).message);
    }
  };

  const redefinir = async (e: React.FormEvent) => {
    e.preventDefault();
    if (gerenciando === null) return;
    try {
      await api('/api/admin/usuarios/senha', { metodo: 'POST', corpo: { id: gerenciando, nova } });
      avisar('ok', 'Senha redefinida. As sessões abertas dessa conta foram encerradas.');
      setGerenciando(null);
      carregar();
    } catch (err) {
      avisar('erro', (err as Error).message);
    }
  };

  const abrirGerenciar = (id: number) => { setNova(''); setGerenciando(id); };
  const alvo = contas?.find((c) => c.id === gerenciando) ?? null;

  const FILTROS: { id: Filtro; rotulo: string }[] = [
    { id: 'todas', rotulo: 'Todas' },
    { id: 'paradas', rotulo: `Paradas há ${DIAS_PARADO}+ dias` },
    { id: 'atrasadas', rotulo: 'Atrasadas' },
    { id: 'nunca', rotulo: 'Nunca estudaram' },
    { id: 'inativas', rotulo: 'Desativadas' },
  ];
  const limpar = () => { setBusca(''); setCargoFiltro(''); setFiltro('todas'); };
  const filtrando = !!busca || !!cargoFiltro || filtro !== 'todas';

  return (
    <div className="pagina">
      <Cabecalho
        sobre="Configurações"
        titulo="Usuários"
        subtitulo="Cada conta tem os seus próprios estudos, progresso, ciclo e configurações. Acompanhe quem está no ritmo e quem precisa de um empurrão."
        acoes={<button className="btn primario" onClick={() => { setErro(null); setCriando(true); }}><Icone nome="mais" tam={16} /> Nova conta</button>}
      />

      <Painel semPadding>
        <div style={{ padding: 16, display: 'grid', gap: 12, borderBottom: '1px solid var(--linha)' }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="campo-icone" style={{ flex: '1 1 240px', maxWidth: 360 }}>
              <Icone nome="busca" tam={16} />
              <label className="sr-only" htmlFor="u-busca">Buscar por nome ou e-mail</label>
              <input id="u-busca" type="search" placeholder="Buscar por nome ou e-mail" value={busca} onChange={(e) => setBusca(e.target.value)} autoComplete="off" />
            </div>
            <label className="sr-only" htmlFor="u-cargo-f">Filtrar por cargo</label>
            <select id="u-cargo-f" value={cargoFiltro} onChange={(e) => setCargoFiltro(e.target.value)}>
              <option value="">Todos os cargos</option>
              {cargos.map((c) => <option key={c.id} value={c.id}>{c.codigo} · {c.nomeCurto}</option>)}
            </select>
            <label className="sr-only" htmlFor="u-ordem">Ordenar por</label>
            <select id="u-ordem" value={ordem} onChange={(e) => setOrdem(e.target.value as Ordem)}>
              <option value="nome">Ordem: nome</option>
              <option value="progresso">Ordem: maior progresso</option>
              <option value="recente">Ordem: estudou há menos tempo</option>
              <option value="parados">Ordem: parados há mais tempo</option>
            </select>
          </div>
          <div role="group" aria-label="Filtrar por situação" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {FILTROS.map((f) => (
              <button key={f.id} className={`btn pq ${filtro === f.id ? 'primario' : ''}`} aria-pressed={filtro === f.id} onClick={() => setFiltro(f.id)}>
                {f.rotulo} <span style={{ opacity: 0.75 }}>{contagens[f.id]}</span>
              </button>
            ))}
          </div>
        </div>

        {erroLista ? (
          <p className="erro-form" role="alert" style={{ margin: 16 }}><Icone nome="alerta" tam={16} /> {erroLista} <button className="btn pq" onClick={carregar}>Tentar de novo</button></p>
        ) : contas === null ? (
          <p className="nota" style={{ margin: 16 }}>Carregando…</p>
        ) : visiveis.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center' }}>
            <p className="nota" style={{ margin: '0 0 10px' }}>{filtrando ? 'Nenhuma conta com esses filtros.' : 'Nenhuma conta ainda.'}</p>
            {filtrando && <button className="btn pq" onClick={limpar}>Limpar filtros</button>}
          </div>
        ) : (
          <>
            <div className="tabela-wrap">
              <table className="tabela">
                <caption className="sr-only">Contas e progresso</caption>
                <thead>
                  <tr>
                    <th scope="col">Pessoa</th>
                    <th scope="col">Cargo</th>
                    <th scope="col">Progresso do edital</th>
                    <th scope="col">Últimos 7 dias</th>
                    <th scope="col">Último estudo</th>
                    <th scope="col">Conta</th>
                    <th scope="col"><span className="sr-only">Ações</span></th>
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map((c) => {
                    const r = resumos[c.id];
                    return (
                      <tr key={c.id} style={c.ativo ? undefined : { opacity: 0.65 }}>
                        <td>
                          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            <span className="avatar" aria-hidden="true">{nomeDe(c).slice(0, 1).toUpperCase()}</span>
                            <div style={{ minWidth: 0 }}>
                              <a href={`#/config/usuarios/acompanhar?id=${c.id}`} style={{ fontWeight: 550, color: 'inherit' }}>{nomeDe(c)}</a>
                              {c.id === usuario.id && <> <span className="chip">você</span></>}
                              <div className="nota">{c.email}</div>
                            </div>
                          </div>
                        </td>
                        <td><span className="chip chip-pri" title={cargos.find((x) => x.id === c.cargoId)?.nome}>{nomeCargo(c.cargoId)}</span></td>
                        <td style={{ minWidth: 190 }}>
                          {r ? (
                            <>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}>
                                <Barra valor={r.pct} rotulo={`Progresso de ${nomeDe(c)}`} />
                                <b style={{ fontWeight: 550 }}>{fmtPct(r.pct)}</b>
                              </div>
                              <div className="nota">{r.concluidos} de {r.totalConteudos} · <ChipSituacao r={r} /></div>
                            </>
                          ) : <span className="nota">ainda não entrou</span>}
                        </td>
                        <td className="nota nowrap">{r ? <>{fmtMin(r.minutos7)}<br />de {fmtMin(r.metaSemanalMin)}</> : '—'}</td>
                        <td className="nota">
                          {r ? <>{textoUltimo(r)}{parada(c) && <> <span className="chip chip-aviso">parado</span></>}</> : '—'}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            <span className={`chip ${c.ativo ? 'chip-ok' : 'chip-erro'}`}>{c.ativo ? 'Ativa' : 'Desativada'}</span>
                            {c.papel === 'admin' && <span className="chip">Administrador</span>}
                            {c.senhaProvisoria && <span className="chip chip-aviso">Senha provisória</span>}
                          </div>
                        </td>
                        <td className="acoes-celula">
                          <a className="btn pq" href={`#/config/usuarios/acompanhar?id=${c.id}`} aria-label={`Acompanhar ${nomeDe(c)}`}>Acompanhar</a>{' '}
                          {c.id !== usuario.id && <button className="btn pq" onClick={() => abrirGerenciar(c.id)} aria-label={`Gerenciar a conta de ${nomeDe(c)}`}>Gerenciar</button>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="nota" style={{ margin: 0, padding: '10px 24px', borderTop: '1px solid var(--linha)' }} aria-live="polite">
              {visiveis.length === contas.length ? `${contas.length} ${contas.length === 1 ? 'conta' : 'contas'}` : `${visiveis.length} de ${contas.length} contas`}
            </p>
          </>
        )}
      </Painel>

      <Modal
        aberto={criando}
        onFechar={() => setCriando(false)}
        titulo="Nova conta"
        subtitulo="O cargo define o edital verticalizado da conta e não pode ser trocado depois."
        largura={520}
      >
        <form className="form" onSubmit={criar} style={{ display: 'grid', gap: 14 }}>
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
            <span className="campo-ajuda" id="u-senha-dica">Pelo menos 10 caracteres. Repasse à pessoa por um canal seguro; ela será convidada a trocá-la no primeiro acesso.</span>
          </div>
          {erro && <p className="erro-form" role="alert"><Icone nome="alerta" tam={16} /> {erro}</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn" type="button" onClick={() => setCriando(false)}>Cancelar</button>
            <button className="btn primario" type="submit" disabled={enviando}>{enviando ? 'Criando…' : 'Criar conta'}</button>
          </div>
        </form>
      </Modal>

      <Modal
        aberto={!!alvo}
        onFechar={() => setGerenciando(null)}
        titulo={alvo ? `Gerenciar ${nomeDe(alvo)}` : 'Gerenciar conta'}
        subtitulo={alvo?.email}
        largura={520}
      >
        {alvo && (
          <div style={{ display: 'grid', gap: 22 }}>
            <form className="form" onSubmit={redefinir} style={{ display: 'grid', gap: 10 }}>
              <div className="campo">
                <label htmlFor="u-nova">Nova senha provisória</label>
                <input id="u-nova" type="text" required minLength={10} value={nova} onChange={(e) => setNova(e.target.value)} autoComplete="off" aria-describedby="u-nova-dica" />
                <span className="campo-ajuda" id="u-nova-dica">Pelo menos 10 caracteres. As sessões abertas da conta serão encerradas e a pessoa terá de trocar a senha ao entrar.</span>
              </div>
              <div><button className="btn primario" type="submit" disabled={nova.length < 10}>Redefinir senha</button></div>
            </form>
            <div style={{ borderTop: '1px solid var(--linha)', paddingTop: 16, display: 'grid', gap: 8 }}>
              <b style={{ fontWeight: 550 }}>{alvo.ativo ? 'Desativar conta' : 'Reativar conta'}</b>
              <p className="nota" style={{ margin: 0 }}>
                {alvo.ativo
                  ? 'A pessoa é desconectada e não consegue entrar. Os dados de estudo são mantidos e voltam se a conta for reativada.'
                  : 'A pessoa poderá entrar de novo e encontrará os estudos como estavam.'}
              </p>
              <div><button className="btn" onClick={() => void alternarAtivo(alvo)}>{alvo.ativo ? 'Desativar conta' : 'Reativar conta'}</button></div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
