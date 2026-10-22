import type { AppData, Seed } from '../src/domain/types';
import { reduzir, ErroAcao, type Acao } from '../src/domain/actions';
import { criarDados } from '../src/domain/defaults';
import { validarAppData } from '../src/domain/validate';
import { definirFuso, isoDia, uid } from '../src/domain/util';
import type { BD } from './sqlite';
import { prep, transacao } from './db';
import { carregarDados, gravarDados } from './repositorio';

// Camada de negócio do servidor: aplica as mesmas ações do domínio (src/domain/actions.ts)
// que a interface usa e grava o resultado no banco, numa transação.

const ACOES = new Set<Acao['t']>([
  'status', 'dominado', 'prioridade', 'prioridadeDisciplina', 'notas', 'revisao',
  'cicloMover', 'cicloMinutos', 'cicloAtivo', 'cicloAdicionar', 'cicloRemover', 'cicloDistribuicao', 'cicloProximo', 'cicloPular',
  'timerIniciar', 'timerPausar', 'timerRetomar', 'timerDescartar', 'timerFinalizar',
  'sessaoSalvar', 'sessaoExcluir', 'depAdicionar', 'depRemover', 'depTipo', 'depRestaurar', 'config', 'importar', 'reiniciar',
]);

// Ações que substituem todos os dados: gravadas por inteiro, com cópia de segurança antes.
export const ACOES_SUBSTITUTIVAS = new Set<Acao['t']>(['importar', 'reiniciar']);

// O cliente pode informar o horário e os ids que usou ao aplicar a ação localmente.
// O servidor aceita se forem plausíveis, para que os dois estados fiquem idênticos.
const TOLERANCIA_RELOGIO_MS = 5 * 60_000;
const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;

interface Cache { versao: number; dados: AppData }

export class ServicoDados {
  private cache = new Map<number, Cache>();
  constructor(private db: BD, private seed: Seed) {}

  versao(usuarioId: number): number {
    return (prep(this.db, 'SELECT versao_dados FROM usuarios WHERE id = ?').get(usuarioId) as { versao_dados: number } | undefined)?.versao_dados ?? 0;
  }

  // Lê os dados do usuário; na primeira vez, cria o plano inicial.
  obter(usuarioId: number): Cache {
    const v = this.versao(usuarioId);
    const c = this.cache.get(usuarioId);
    if (c && c.versao === v) return c;
    let dados = carregarDados(this.db, usuarioId);
    if (!dados) {
      definirFuso(null);
      dados = criarDados(this.seed);
      const d = dados;
      transacao(this.db, () => {
        gravarDados(this.db, usuarioId, null, d);
        prep(this.db, 'UPDATE usuarios SET versao_dados = versao_dados + 1 WHERE id = ?').run(usuarioId);
      });
      return this.obter(usuarioId);
    }
    const novo = { versao: v, dados };
    this.cache.set(usuarioId, novo);
    return novo;
  }

  // Aplica uma ação. Devolve a nova versão e, quando o resultado pode diferir do que o
  // cliente calculou (versão desatualizada, ids ou relógio recusados), os dados completos.
  aplicar(
    usuarioId: number,
    entrada: { acao: unknown; versaoBase?: unknown; agora?: unknown; ids?: unknown },
    antesDeSubstituir?: () => void,
  ): { versao: number; dados?: AppData; alterou: boolean } {
    const acao = entrada.acao as Acao;
    if (!acao || typeof acao !== 'object' || !ACOES.has(acao.t)) throw new ErroAcao('Ação desconhecida.');
    if (acao.t === 'importar') {
      const erros = validarAppData(acao.dados, this.seed);
      if (erros.length) throw new ErroAcao(`Arquivo recusado: ${erros.slice(0, 3).join(' ')}${erros.length > 3 ? ` (+${erros.length - 3} problemas)` : ''}`);
    }
    const atual = this.obter(usuarioId);
    let divergiu = entrada.versaoBase !== atual.versao;

    const agoraServidor = Date.now();
    let agora = agoraServidor;
    if (typeof entrada.agora === 'number' && Math.abs(entrada.agora - agoraServidor) <= TOLERANCIA_RELOGIO_MS) agora = entrada.agora;
    else if (entrada.agora !== undefined) divergiu = true;

    const usados = idsExistentes(atual.dados);
    const fila = Array.isArray(entrada.ids) ? entrada.ids.slice(0, 50) : [];
    const gerarId = (prefixo: string) => {
      const proposto = fila.shift();
      if (typeof proposto === 'string' && ID_VALIDO.test(proposto) && proposto.startsWith(prefixo) && !usados.has(proposto)) {
        usados.add(proposto);
        return proposto;
      }
      divergiu = true;
      const id = uid(prefixo);
      usados.add(id);
      return id;
    };

    definirFuso(atual.dados.user.config.fusoHorario);
    const novo = reduzir(atual.dados, acao, { seed: this.seed, agora, gerarId });
    if (novo === atual.dados) return { versao: atual.versao, alterou: false, dados: divergiu ? atual.dados : undefined };

    const substitui = ACOES_SUBSTITUTIVAS.has(acao.t);
    if (substitui) antesDeSubstituir?.();
    const versao = transacao(this.db, () => {
      gravarDados(this.db, usuarioId, substitui ? null : atual.dados, novo);
      prep(this.db, 'UPDATE usuarios SET versao_dados = versao_dados + 1, atualizado_em = ? WHERE id = ?').run(new Date().toISOString(), usuarioId);
      return this.versao(usuarioId);
    });
    this.cache.set(usuarioId, { versao, dados: novo });
    return { versao, alterou: true, dados: divergiu || substitui ? novo : undefined };
  }

  hoje(usuarioId: number): string {
    definirFuso(this.obter(usuarioId).dados.user.config.fusoHorario);
    return isoDia();
  }
}

function idsExistentes(d: AppData): Set<string> {
  const u = d.user;
  const s = new Set<string>();
  for (const x of u.sessoes) s.add(x.id);
  for (const x of u.historico) s.add(x.id);
  for (const x of u.dependencias) s.add(x.id);
  for (const x of u.ciclo.itens) s.add(x.id);
  if (u.timer) s.add(u.timer.id);
  return s;
}
