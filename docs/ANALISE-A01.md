# Edital verticalizado do cargo A01 · método, evidências e limites

Cargo **A01 · Técnico de Controle Externo, especialidade Técnico Administrativo** (Edital nº 01/2026, TCE-GO, banca FCC). Não havia planilha de edital verticalizado para este cargo; esta análise foi feita do zero a partir do Anexo II e de provas anteriores da FCC. O resultado está em `src/data/seed-a01.json` (14 disciplinas, 191 conteúdos, 118 pré-requisitos sugeridos).

## O que foi feito

1. **Conteúdo programático**: o texto de cada disciplina foi extraído do Anexo II (páginas 19 e 20 do edital) e dividido em conteúdos de estudo. Cada título traz os subtópicos oficiais após os dois-pontos (por exemplo, *Direitos e garantias fundamentais: direitos e deveres individuais e coletivos*). Cada conteúdo guarda o **trecho literal** do edital que o fundamenta e a página.
2. **Provas FCC**: foram lidas **9 provas** (545 questões distintas), listadas em [scripts/a01/PROVAS.md](../scripts/a01/PROVAS.md). A mais próxima é a do **TCE-GO 2009 para o mesmo cargo** (Técnico de Controle Externo, Técnica Administrativa); as outras são do TCE-GO 2014 (analistas das áreas Administrativa, Orçamento e Finanças, Contabilidade, Gestão de Pessoas e Planejamento), TCE-CE 2015 (técnico), TCE-SP 2012 e TCE-PR 2011.
3. **Contagem**: o texto de cada questão foi comparado com expressões de palavras-chave de cada conteúdo (`scripts/a01/taxonomia.py`). O resultado por conteúdo (questões e provas em que apareceu) está em `fontes/a01/analise-fcc.json` e aparece no campo *Incidência* de cada conteúdo na plataforma.
4. **Prioridade**: regra única, aplicada igualmente a todos os conteúdos.

| Prioridade | Regra |
|---|---|
| **Urgente** | 12 ou mais questões em pelo menos 6 provas (recorrência comprovada), ou estreia de altíssima relevância |
| **Alta** | 6 ou mais questões, ou presença em 4 ou mais provas, ou estreia importante |
| **Média** | 2 a 5 questões, ou item nominal do edital sem histórico comparável |
| **Baixa** | no máximo 1 questão e sem outro motivo para subir |

Itens que **estreiam no edital 2026** ou mudaram de norma (Lei 14.133/2021, NBASP, NBC TSP, MCASP 11ª edição, Decreto 9.830/2019, Lei 14.230/2021, PNCP, LINDB etc.) não têm histórico nas provas antigas. Neles a prioridade é uma **decisão justificada** no próprio campo *Incidência* (peso no edital, cobrança literal típica da FCC), nunca apresentada como estatística.

## O que as provas mostram do estilo da FCC no TCE-GO

- **Legislação local é cobrada "seca"**: Lei Orgânica, Regimento Interno, Estatuto dos servidores e a lei estadual de processo administrativo aparecem nas provas do TCE-GO (2009 e 2014), em questões literais ou em situações hipotéticas curtas. Por isso a *Legislação Institucional* merece o mesmo cuidado de uma disciplina de conteúdo.
- **Orçamento e finanças públicas é o maior bloco do cargo**: *Despesa orçamentária* (36 questões, presente em 9 de 9 provas), *Receita orçamentária* (28), *LRF* (24), *dívida e operações de crédito* (23) e *despesa com pessoal e DOCC* (22). A prova de 2014 trouxe questões numéricas de classificação de receitas e despesas.
- **Direito Constitucional e Administrativo** concentram-se em organização dos Poderes, fiscalização e controle externo (CF arts. 70 a 75), organização administrativa, serviços públicos e atos administrativos.
- **Língua Portuguesa** é dominada por interpretação de texto e reescrita de frases (conectivos, coordenação e subordinação, morfossintaxe), com pouco peso para itens isolados de gramática. A *crase* não apareceu em nenhuma das 9 provas, mas é item nominal do Anexo II e dos critérios de correção da Redação (edital, item 10.6).
- **Raciocínio Lógico**: lógica proposicional (32 questões, em 9 de 9 provas), sequências, porcentagem e dedução a partir de relações.
- **Administração**: planejamento estratégico, liderança, motivação e gestão de pessoas (avaliação de desempenho, remuneração, treinamento) são os mais frequentes. Porter e Canvas não apareceram nas provas antigas, e a RBV só uma vez.

### Conteúdos mais recorrentes (questões na amostra · provas em que apareceu)

| Conteúdo | Disciplina | Questões | Provas |
|---|---|---|---|
| Compreensão e interpretação de textos | Língua Portuguesa | 64 | 9 |
| Despesa orçamentária | Adm. Financeira e Orçamentária | 36 | 9 |
| Lógica proposicional | Matemática e RLM | 32 | 9 |
| Fiscalização contábil, financeira e orçamentária (CF) | Direito Constitucional | 29 | 7 |
| Receita orçamentária | Adm. Financeira e Orçamentária | 28 | 7 |
| Planejamento estratégico: missão, visão e valores | Administração Estratégica | 27 | 8 |
| Lei de Responsabilidade Fiscal | Adm. Financeira e Orçamentária | 24 | 7 |
| Dívida, operações de crédito e ARO | Adm. Financeira e Orçamentária | 23 | 7 |
| Poder Executivo | Direito Constitucional | 23 | 5 |
| Despesa com pessoal e DOCC | Adm. Financeira e Orçamentária | 22 | 7 |
| Serviços públicos: concessão e permissão | Direito Administrativo | 22 | 6 |

## Limites da análise (leia antes de confiar nos números)

- **As provas são antigas (2009 a 2015).** Não foi possível obter provas mais recentes de acesso aberto: a prova do TCE-GO 2022 só abre com o código de acesso do candidato na FCC, e o PCI Concursos usa captcha (não contornado). Por isso Lei 14.133/2021, NBC TSP, NBASP e as reformas recentes não têm histórico. O campo *Incidência* diz isso em cada item.
- **A contagem é aproximada.** É uma heurística de palavras-chave sobre texto extraído de PDF (duas colunas): cerca de 5% das questões não foram lidas ou classificadas, e uma questão que toca em dois assuntos conta nos dois. Serve para **ordenar** assuntos, não para afirmar quantas questões caíram.
- **O cargo técnico teve só uma prova comparável (2009)**, e ela não incluía Administração Geral, Comportamento Organizacional, Gestão de Pessoas nem Contabilidade, que agora fazem parte do edital. Para essas disciplinas a base são as provas de analistas de 2014 (nível mais alto) e as de técnico/agente de outros tribunais; o edital 2026 avisa que, com o mesmo conteúdo, o nível de complexidade varia por cargo.
- **O edital não informa quantas questões vêm de cada disciplina** (item 7.1: 25 de Conhecimentos Gerais e 45 de Específicos). O ciclo inicial sugerido é uma distribuição de tempo razoável, editável, e não uma previsão de peso.
- Os **nomes das NBC TSP** acima da 08 (itens 09 a 13, 15, 23, 25 e 34) foram agrupados por tema a partir do conhecimento do autor e devem ser conferidos no site do CFC. O texto oficial do edital está sempre ao lado de cada conteúdo.

## Como atualizar

Se uma retificação do edital ou novas provas mudarem o quadro, refaça a análise pelos comandos de [scripts/a01/PROVAS.md](../scripts/a01/PROVAS.md) e aumente `seedVersion` em `scripts/a01/seed_a01.py`. O progresso dos usuários guarda só ids de conteúdo (`a001` a `a191`); manter a ordem dos itens em `taxonomia.py` preserva o progresso.
