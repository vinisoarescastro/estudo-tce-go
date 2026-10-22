import { fusoValido } from './util';

export type Periodo = 'madrugada' | 'manha' | 'tarde' | 'noite';

export function periodoDoDia(hora: number): Periodo {
  if (hora < 5) return 'madrugada';
  if (hora < 12) return 'manha';
  if (hora < 18) return 'tarde';
  return 'noite';
}

const SAUDACOES: Record<Periodo, string> = {
  madrugada: 'Boa madrugada',
  manha: 'Bom dia',
  tarde: 'Boa tarde',
  noite: 'Boa noite',
};

export const saudacaoDoDia = (hora: number) => SAUDACOES[periodoDoDia(hora)];

// Hora cheia (0 a 23) no fuso do usuário, que pode diferir do fuso do navegador.
export function horaNoFuso(agora: Date, fuso?: string): number {
  const timeZone = fuso && fusoValido(fuso) ? fuso : undefined;
  const h = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone }).format(agora));
  return Number.isFinite(h) ? h % 24 : agora.getHours();
}

// Primeiro nome com a inicial maiúscula. Sem nome cadastrado, usa o começo do e-mail.
export function primeiroNome(nome: string, email: string): string {
  const base = (nome.trim().split(/\s+/)[0] || email.split('@')[0]).replace(/[._-]+.*/, '');
  return base.charAt(0).toUpperCase() + base.slice(1);
}

export const FRASES: string[] = [
  'Constância vence talento. Um bloco de estudo por vez.',
  'Hoje você aprende algo que a prova de janeiro vai agradecer.',
  'Quem estuda um pouco todo dia chega mais longe do que quem estuda muito de vez em quando.',
  'Não precisa ser perfeito, precisa ser feito.',
  'Cada tópico concluído é um item a menos entre você e a aprovação.',
  'O cansaço passa. A aprovação fica.',
  'Foque no próximo bloco, não na montanha inteira.',
  'Disciplina é fazer o que precisa ser feito, mesmo sem vontade.',
  'Pequenos avanços diários viram grandes resultados.',
  'Sua rotina de hoje constrói a sua posse de amanhã.',
  'Descansar também faz parte de estudar. Respeite as pausas.',
  'Você já chegou até aqui. Continue.',
  'Um bom estudo hoje vale mais que um plano perfeito para amanhã.',
  'A dúvida de hoje é o acerto de amanhã.',
  'Errar na questão agora é acertar na prova.',
  'Quem persiste não depende de motivação, depende de hábito.',
  'Comece pelo mais difícil enquanto a mente está fresca.',
  'Revisar é o que transforma estudo em memória.',
  'Seu futuro eu vai agradecer pelo esforço de agora.',
  'Foco total por 25 minutos. O resto espera.',
  'Não compare seu capítulo 1 com o capítulo 20 de ninguém.',
  'O progresso é silencioso, mas é real.',
  'Aprovação é consequência de dias comuns bem aproveitados.',
  'Hoje é um ótimo dia para riscar mais um item do edital.',
  'Você não precisa de mais tempo, precisa de mais foco no tempo que tem.',
  'Cada pomodoro concluído é uma promessa cumprida com você mesmo.',
  'Estude como quem já foi aprovado e só está cumprindo o caminho.',
  'A prova é um dia. A preparação é todos os outros. Aproveite-os.',
  'Menos desculpas, mais questões resolvidas.',
  'Quem sabe onde quer chegar suporta o caminho.',
  'Não pare quando estiver cansado. Pare quando terminar o bloco.',
  'A cada página lida, você ultrapassa quem ficou parado.',
  'Seja paciente com o processo e exigente com a rotina.',
  'O que você estuda hoje, você sabe amanhã. O que você adia, você deve.',
  'Grandes conquistas começam em manhãs comuns.',
  'Organize, estude, revise, repita. Simples assim.',
  'Mantenha o ritmo: constância é o seu maior concorrente.',
  'Nenhum esforço de estudo é perdido. Tudo se soma.',
  'Respire fundo, abra o material e comece. O resto vem.',
  'A vaga é de quem se prepara, não de quem apenas deseja.',
  'Seu único adversário hoje é a versão de ontem.',
  'Foco no processo e o resultado cuida de si.',
  'Dias difíceis também contam como dias de estudo.',
  'Sonhe grande, estude em blocos pequenos.',
  'Quando bater o desânimo, lembre por que você começou.',
  'Bom estudo não é o mais longo, é o mais atento.',
  'Mais um conteúdo dominado, mais perto da posse.',
  'Cuide da mente, do sono e da água: estudar bem começa aí.',
  'Você está construindo algo que ninguém pode tirar: conhecimento.',
  'Sem pressa e sem pausa: um tópico de cada vez.',
  'O edital é grande, mas você é maior. Um item por vez.',
  'Estude hoje com a seriedade de quem vai conferir o resultado em breve.',
  'O melhor momento para começar foi ontem. O segundo melhor é agora.',
  'Foco, calma e constância: a receita de qualquer aprovação.',
  'Termine o dia sabendo mais do que sabia ao acordar.',
  'Sua dedicação de hoje é o orgulho de amanhã.',
  'Ritmo bom é aquele que você consegue manter até o fim.',
  'Cada sessão registrada é uma prova de que você está no caminho.',
  'Acredite no método e confie na sua preparação.',
  'Persistir é a estratégia que nunca falha.',
];

export interface BaralhoFrases {
  ordem: number[];
  pos: number;
  ultima: number;
}

function embaralhar(n: number, sorteio: () => number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(sorteio() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Sorteio sem repetição: percorre um baralho embaralhado e só embaralha de novo quando acaba.
// Assim a frase nunca se repete antes de todas as outras terem aparecido, nem na virada do baralho.
export function proximaFrase(baralho: BaralhoFrases | null, total: number, sorteio: () => number = Math.random): { indice: number; baralho: BaralhoFrases } {
  let b = baralho && baralho.ordem.length === total && baralho.pos < total ? baralho : null;
  if (!b) {
    let ordem = embaralhar(total, sorteio);
    const ultima = baralho?.ultima ?? -1;
    if (total > 1 && ordem[0] === ultima) [ordem[0], ordem[1]] = [ordem[1], ordem[0]];
    b = { ordem, pos: 0, ultima };
  }
  const indice = b.ordem[b.pos];
  return { indice, baralho: { ordem: b.ordem, pos: b.pos + 1, ultima: indice } };
}
