import type { Seed } from './types';

// Dados de cada concurso que a plataforma atende: marca, PDF do edital e os textos que mudam de um
// edital para outro. Cada cargo (seed) aponta para o seu concurso por `cargo.concursoId`.

export interface Concurso {
  id: string;
  sigla: string; // aparece na marca: "Estudo <sigla>"
  orgao: string;
  banca: string;
  edital: string; // "Edital nº 01/2026"
  pdf: string; // caminho servido pela aplicação (só para quem entrou)
  arquivoPdf: string; // nome sugerido ao baixar
  anexoConteudo: string; // anexo com o conteúdo programático
  paginasConteudo: string; // "pp. 19 a 22"
  refProva: string; // itens com questões, pesos, mínimos e data
  dataProvaRef: string; // onde o edital informa a data da prova
  emblema?: string; // imagem da marca no menu; sem ela, um ícone neutro
  favicon?: string;
  // O edital numera os itens do conteúdo? (o do TCE-GO não numera)
  itensNumerados: boolean;
  limitacoes: string[]; // limitações próprias deste edital (aba Referências)
}

export const CONCURSO_PADRAO = 'tce-go-2026';

export const CONCURSOS: Record<string, Concurso> = {
  'tce-go-2026': {
    id: 'tce-go-2026',
    sigla: 'TCE-GO',
    orgao: 'Tribunal de Contas do Estado de Goiás',
    banca: 'FCC',
    edital: 'Edital nº 01/2026',
    pdf: 'editais/tce-go-2026.pdf',
    arquivoPdf: 'edital-tce-go-01-2026.pdf',
    anexoConteudo: 'Anexo II',
    paginasConteudo: 'pp. 19 a 22',
    refProva: 'Itens 7.1, 9.5, 11.4 a 11.9, 12.2 e Anexo III',
    dataProvaRef: 'Anexo III, item 12',
    emblema: 'marca/emblema-tce-go.webp',
    favicon: 'marca/favicon.png',
    itensNumerados: false,
    limitacoes: ['O edital não informa quantas questões cada disciplina terá, só o total por bloco (25 Gerais e 45 Específicos).'],
  },
  'ifg-2026': {
    id: 'ifg-2026',
    sigla: 'IFG',
    orgao: 'Instituto Federal de Educação, Ciência e Tecnologia de Goiás',
    banca: 'Instituto AOCP',
    edital: 'Edital nº 001/2026',
    pdf: 'editais/ifg-2026.pdf',
    arquivoPdf: 'edital-ifg-001-2026.pdf',
    anexoConteudo: 'Anexo III',
    paginasConteudo: 'pp. 31 e 33',
    refProva: 'Tabela 11.1, itens 11.3, 11.4, 12.20 e 14.3 e Anexo I',
    dataProvaRef: 'Anexo I, cronograma previsto',
    itensNumerados: true,
    limitacoes: [
      'Em Legislação, a planilha numera as normas na própria ordem: o edital agrupa a Constituição no item 1 e deixa as últimas leis sem número.',
      'As prioridades vêm de duas provas da banca (IFPB 2025 e IFCE 2026). Raciocínio Lógico e Matemática não apareceu em nenhuma delas: ali a prioridade é julgamento, não dado.',
    ],
  },
};

export function concursoDe(seed: Pick<Seed, 'cargo'> | null | undefined): Concurso {
  return CONCURSOS[seed?.cargo?.concursoId ?? CONCURSO_PADRAO] ?? CONCURSOS[CONCURSO_PADRAO];
}

// PDFs servidos só para quem entrou. "edital.pdf" é o endereço antigo do edital do TCE-GO.
export const PDF_LEGADO = 'edital.pdf';
export const PDFS_EDITAIS = Object.values(CONCURSOS).map((c) => c.pdf);
