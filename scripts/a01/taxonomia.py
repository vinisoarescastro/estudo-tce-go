"""Taxonomia do edital verticalizado do cargo A01 (Técnico de Controle Externo - Técnico Administrativo).

Cada disciplina vem do Anexo II do Edital 01/2026 (TCE-GO / FCC). Cada tópico é um item de estudo e traz:
  titulo  - nome do tópico (os subtópicos oficiais ficam no título, após os dois-pontos)
  kw      - expressão regular (texto sem acentos, minúsculo) usada para encontrar, nas provas FCC
            analisadas, as questões que tratam do assunto
  novo    - opcional: (prioridade, motivo) para assuntos que ESTREIAM no edital 2026 ou mudaram de
            norma, e por isso não têm histórico comparável; a prioridade nesses casos é uma
            decisão fundamentada no peso do assunto no edital e na obrigatoriedade de cobrança
"""

# (id, nome oficial, nome curto, núcleo, título da seção do Anexo II usado para achar o texto)
DISCIPLINAS = [
    ('a01lp', 'Língua Portuguesa', 'Língua Portuguesa', 'CG'),
    ('a01mat', 'Matemática e Raciocínio Lógico', 'Matemática e RLM', 'CG'),
    ('a01leginst', 'Legislação Institucional', 'Legislação Institucional', 'CG'),
    ('a01da', 'Noções de Direito Administrativo', 'Direito Administrativo', 'CE'),
    ('a01lic', 'Licitações e Contratos Administrativos', 'Licitações e Contratos', 'CE'),
    ('a01dc', 'Noções de Direito Constitucional', 'Direito Constitucional', 'CE'),
    ('a01ce', 'Noções de Controle Externo', 'Controle Externo', 'CE'),
    ('a01afo', 'Noções de Administração Financeira e Orçamentária', 'Adm. Financeira e Orçamentária', 'CE'),
    ('a01cont', 'Contabilidade aplicada ao Setor Público', 'Contabilidade Pública', 'CE'),
    ('a01ap', 'Noções de Administração Pública', 'Administração Pública', 'CE'),
    ('a01ag', 'Administração Geral', 'Administração Geral', 'CE'),
    ('a01ae', 'Administração Estratégica', 'Administração Estratégica', 'CE'),
    ('a01co', 'Comportamento Organizacional', 'Comportamento Organizacional', 'CE'),
    ('a01gp', 'Gestão de Pessoas', 'Gestão de Pessoas', 'CE'),
]

T = {}

# ---------------------------------------------------------------------------------------------
# CONHECIMENTOS GERAIS (comuns ao A01 e ao B02; a prova do A01 tem nível próprio)
T['a01lp'] = [
    ('Redação Oficial', r'redacao oficial|oficio|memorando|requerimento|manual de redacao'),
    ('Ortografia e acentuação', r'ortograf|acentu|grafia|hifen|escrita das palavras|grafad'),
    ('Emprego do sinal indicativo de crase', r'crase|acento grave'),
    ('Compreensão e interpretação de textos de gêneros variados', r'texto|autor|paragrafo|trecho|depreende|infere-se|ideia central|titulo|tese'),
    ('Relação do texto com seu contexto histórico', r'contexto historico|epoca em que'),
    ('Denotação e conotação', r'denota|conota|sentido (figurado|proprio)'),
    ('Discurso direto, indireto e indireto livre', r'discurso (direto|indireto)|indireto livre'),
    ('Intertextualidade', r'intertextual|dialogo com outro texto|parodia'),
    ('Figuras de linguagem', r'figura de linguagem|metafora|metonimia|ironia|eufemismo|hiperbole|antitese|paradoxo|prosopopeia|ironico'),
    ('Morfossintaxe', r'funcao sintatica|sujeito|predicado|complemento verbal|objeto (direto|indireto)|adjunto|aposto|vocativo|classe gramatical|oracao'),
    ('Elementos estruturais e processos de formação de palavras', r'prefixo|sufixo|radical|formacao de palavras|derivacao|composicao|elemento morfologico'),
    ('Sinonímia e antonímia', r'sinonim|antonim|sentido equivalente|substituida? por|substituicao do (termo|vocabulo)|expressao equivalente|vocabulo'),
    ('Pontuação', r'virgula|pontuacao|ponto e virgula|dois-pontos|travessao|parenteses'),
    ('Pronomes: emprego e colocação', r'pronome|proclise|enclise|mesoclise|colocacao pronominal|pronominal'),
    ('Concordância nominal e verbal', r'concordancia'),
    ('Flexão nominal e verbal', r'flexao|plural|feminino|forma verbal|conjugacao|verbo no'),
    ('Vozes do verbo', r'voz (passiva|ativa|reflexiva)|passiva analitica|passiva sintetica|vozes? do verbo'),
    ('Correlação de tempos e modos verbais', r'tempos? e modos?|correlacao verbal|futuro do (presente|preterito)|subjuntivo|preterito|modo verbal'),
    ('Regência nominal e verbal', r'regencia|exige complemento|preposicao exigida|transitivo|complemento do mesmo tipo|mesmo tipo de complemento'),
    ('Coordenação e subordinação', r'coorden|subordin|oracao (substantiva|adjetiva|adverbial|coordenada)|periodo composto'),
    ('Conectivos: valor semântico', r'conectivo|conjuncao|locucao conjuntiva|valor (semantico|de)|relacao de (causa|consequencia|concessao|oposicao|finalidade)|conjuncoes?'),
    ('Redação: frases corretas e incorretas; reorganização e equivalência de estruturas', r'redacao (alternativa|da frase|correta)|reescrit|reorganiz|equivalencia|transposicao|correcao e|frase (correta|incorreta)|mantem-se a correcao|segmento'),
]
T['a01mat'] = [
    ('Números inteiros e racionais: operações e expressões numéricas', r'expressao numerica|numeros (inteiros|racionais)|potenciacao|\bmmc\b'),
    ('Múltiplos e divisores; problemas', r'multiplo|divisor|divisiveis|divisivel|\bmdc\b|numero primo'),
    ('Frações e operações com frações', r'fracao|fracoes|\d+/\d+ d[eo]'),
    ('Razões e proporções; divisão em partes proporcionais', r'razao|proporcional|proporcao|diretamente proporcional|inversamente proporcional|partes proporcionais|dividid[oa] em partes'),
    ('Regra de três simples', r'regra de tres|grandezas'),
    ('Porcentagem, acréscimos e descontos', r'porcentagem|percentual|%|desconto|acrescimo|aumento de'),
    ('Estrutura lógica de relações arbitrárias (associação lógica)', r'cada (um|uma) d(os|as)|pessoas?.* (cidades|profissoes|cores)|sabe-se que.*(nasceu|mora)|dentre as (afirmacoes|alternativas).*ordem|ordem de chegada|fila'),
    ('Dedução de novas informações a partir de relações dadas', r'conclui-se|e verdade que|certamente|com certeza|e correto concluir|tambem e verdade|necessariamente'),
    ('Raciocínio verbal, matemático e sequencial (sequências)', r'sequencia|sucessao|proximo (termo|numero)|termo seguinte'),
    ('Orientação espacial e temporal', r'orientacao|dias da semana|calendario|apos .* dias|giro|\bdireita\b.*\besquerda\b|ponteiros'),
    ('Formação de conceitos e discriminação de elementos', r'discriminac|formacao de conceito|nao pertence|elemento que|figura que'),
    ('Lógica proposicional: hipóteses, validade e conclusões', r'proposic|se .{3,80} entao|equivalente a|logicamente equivalente|negacao|contradicao|tautologia|argumento|premissa|todo[s]? (o|os|a|as)? ?[a-z]+ (e|sao|ser)|algum[a-z]* [a-z]+ (e|sao)|nenhum[a-z]* [a-z]+ (e|sao)|se e somente se'),
]
T['a01leginst'] = [
    ('CF/88: Administração Pública (arts. 37 a 41)', r'art\. ?37|administracao publica.*constituicao|principios.*administracao publica|concurso publico|cargo em comissao|acumulacao|estabilidade'),
    ('CF/88: fiscalização contábil, financeira, orçamentária, operacional e patrimonial (arts. 70 a 75)', r'art\. ?7[0-5]|fiscalizacao contabil|tribunal de contas da uniao|julgar as contas|controle externo'),
    ('CF/88: controle interno e controle externo', r'controle interno'),
    ('Constituição do Estado de Goiás: disposições sobre o TCE-GO', r'constituicao (do )?estado (de|do) goias|constituicao estadual|conselheiros do tribunal de contas do estado de goias'),
    ('Lei 16.168/2007 (Lei Orgânica do TCE-GO): natureza, competências e jurisdição', r'lei organica do tribunal|16\.168|jurisdicao propria|competencia.*tribunal de contas do estado de goias'),
    ('Lei 16.168/2007: julgamento de contas, fiscalização e poder normativo', r'julgamento de contas|contas (regulares|irregulares)|poder normativo|prestacao de contas|tomada de contas|contas anuais'),
    ('Lei 16.168/2007: composição, Conselheiros, Auditores e MP de Contas', r'conselheiros? (do|substitutos?)|auditores? (do tribunal|substituto)|auditor substituto|ministerio publico de contas|composicao do tribunal|vitaliciedade'),
    ('Resolução 22/2008 (Regimento Interno): organização, Plenário e Câmaras', r'regimento interno|plenario|camaras?|sessoes? do plenario|quorum'),
    ('Resolução 22/2008: processos, sessões e atos processuais', r'embargos de declaracao|pedido de reexame|recurso de reconsideracao|recurso ordinario|recurso de revisao|agravo|atos processuais|sessoes? (ordinaria|extraordinaria|reservada)'),
    ('Lei 15.122/2005 (PCCR do TCE-GO): cargos, carreiras e atribuições', r'15\.122|plano de cargos|carreira|progressao'),
    ('Lei 20.756/2020: provimento, posse, exercício e estágio probatório', r'provimento|\bposse\b|estagio probatorio|nomeacao|vacancia|exercicio do cargo|investidura'),
    ('Lei 20.756/2020: direitos, vantagens e indenizações', r'ferias|licenca|vantagens?|indenizac|ajuda de custo|diarias|gratificac|adicional|afastamento|aposentadoria'),
    ('Lei 20.756/2020: deveres, proibições e regime disciplinar', r'deveres|proibic|penalidade|advertencia|suspensao|demissao|processo administrativo disciplinar|responsabilidade do (servidor|funcionario)|regime disciplinar'),
    ('Lei 20.756/2020: teletrabalho', r'teletrabalho'),
    ('Código de Ética dos Servidores do TCE-GO', r'codigo de etica|conduta etica|comissao de etica'),
    ('Políticas institucionais do TCE-GO: Governança, Gestão de Pessoas, Segurança da Informação, Riscos e Proteção de Dados',
     r'politica (de|da|institucional)|governanca institucional|gestao de riscos|protecao de dados'),
    ('Resolução Administrativa 15/2024: Sistema de Planejamento e Gestão', r'sistema de planejamento|planejamento e gestao|plano estrategico do tribunal'),
]
# Itens do núcleo comum que ESTREIAM no edital 2026 ou que não existiam nas provas anteriores:
NOVO_CG = {
    'Redação Oficial': ('Média', 'Item novo no CG 2026; as provas FCC anteriores raramente separaram "redação oficial" de gramática'),
    'Lei 20.756/2020: teletrabalho': ('Média', 'Norma recente do estado; sem questão em provas anteriores'),
    'Código de Ética dos Servidores do TCE-GO': ('Média', 'Norma institucional nova no edital; cobrança literal é típica da FCC'),
    'Políticas institucionais do TCE-GO: Governança, Gestão de Pessoas, Segurança da Informação, Riscos e Proteção de Dados': ('Média', 'Itens institucionais novos no edital 2026; sem histórico'),
    'Resolução Administrativa 15/2024: Sistema de Planejamento e Gestão': ('Média', 'Norma de 2024 incluída agora no edital; sem histórico'),
}

# ---------------------------------------------------------------------------------------------
# CONHECIMENTOS ESPECÍFICOS DO A01
T['a01da'] = [
    ('Administração Pública e regime jurídico-administrativo', r'regime juridico|supremacia do interesse|indisponibilidade do interesse|administracao publica em sentido|conceito de administracao'),
    ('Princípios constitucionais e legais da Administração Pública', r'principio (da|do) (legalidade|impessoalidade|moralidade|publicidade|eficiencia)|principios? (basicos|constitucionais|expressos)|art\. ?37|impessoalidade|moralidade administrativa'),
    ('Princípios administrativos implícitos', r'razoabilidade|proporcionalidade|autotutela|continuidade do servico|motivacao|supremacia|segurancas? juridica|confianca legitima'),
    ('LINDB (Decreto-Lei 4.657/1942) e aplicação na Administração Pública', r'lindb|introducao as normas|4\.657|12\.376'),
    ('Poderes da Administração: hierárquico, disciplinar, regulamentar e de polícia', r'poder (hierarquico|disciplinar|regulamentar|de policia|normativo)|poderes administrativos|poder-dever|poder de policia|hierarquia'),
    ('Uso e abuso do poder: excesso de poder e desvio de finalidade', r'abuso de poder|desvio de (poder|finalidade)|excesso de poder|usurpacao|vicio de finalidade'),
    ('Lei de abuso de autoridade (Lei 13.869/2019)', r'abuso de autoridade|13\.869'),
    ('Ato administrativo: conceito, características e atributos', r'atributos?|presuncao de (legitimidade|legalidade)|autoexecutoriedade|imperatividade|tipicidade|conceito de ato administrativo'),
    ('Elementos e requisitos de validade do ato administrativo', r'elementos? do ato|requisitos? de validade|competencia, finalidade|vicio de (forma|objeto|motivo|competencia)|teoria dos motivos determinantes|motivo do ato'),
    ('Classificação dos atos administrativos', r'ato (vinculado|discricionario|simples|composto|complexo|normativo|ordinatorio|negocial|enunciativo)|atos? (vinculados|discricionarios|simples|compostos|complexos)|atos? (de gestao|de imperio)'),
    ('Formação e efeitos; extinção: revogação, invalidação, convalidação, cassação e caducidade', r'revoga|anula|invalida|convalida|cassacao|caducidade|extincao do ato|efeitos? (retroativos|ex tunc|ex nunc)|perfeicao|eficacia do ato'),
    ('Organização administrativa: administração direta e indireta; descentralização e desconcentração', r'administracao (direta|indireta)|descentraliza|desconcentra|autarquia|fundacao publica|empresa publica|sociedade de economia mista|entidades? paraestatais|agencias? (reguladora|executiva)'),
    ('Processo administrativo: Lei estadual 13.800/2001', r'13\.800|processo administrativo|9\.784|recurso administrativo|prazo (para|de) (decisao|recurso)'),
    ('Controle da Administração: classificações; controle interno e externo; judicial, legislativo, Tribunal de Contas e MP', r'controle (interno|externo|judicial|legislativo|administrativo|da administracao)|mandado de seguranca|habeas data|acao popular|acao civil publica'),
    ('Responsabilidade civil do Estado', r'responsabilidade civil|responsabilidade objetiva|teoria do risco|direito de regresso|culpa anonima|nexo de causalidade|dano.*estado'),
    ('Serviços públicos: concessão, permissão e autorização', r'servicos? publicos?|concessao|permissao de servico|8\.987|parceria publico-privada|\bppp\b|9\.074'),
    ('Bens públicos', r'bens? publicos?|inalienab|impenhorab|imprescritib|afetacao|desafetacao|uso especial|dominicais|usucapiao'),
    ('Responsabilização do agente público; Decreto Federal 9.830/2019', r'9\.830|erro grosseiro|responsabilidade (do )?(agente|servidor)|infracao funcional|processo (administrativo )?disciplinar|\bpad\b|sindicancia|estatuto dos funcionarios|penalidade|demissao'),
    ('Lei de Improbidade Administrativa (Lei 8.429/1992, alterada pela Lei 14.230/2021)', r'improbidade|8\.429|14\.230|enriquecimento ilicito|dano ao erario'),
    ('Licitação e contratos administrativos no Direito Administrativo; Lei 12.232/2010 (publicidade)', r'12\.232|servicos de publicidade|agencia de propaganda'),
    ('Direito de acesso à informação: Lei 12.527/2011 e Lei estadual 18.025/2013', r'12\.527|18\.025|acesso a informacao|informacao sigilosa|transparencia passiva|transparencia ativa|informacoes? classificada'),
]
NOVO_DA = {
    'LINDB (Decreto-Lei 4.657/1942) e aplicação na Administração Pública': ('Alta', 'Estreia com a redação da Lei 13.655/2018 e destaque no edital; a FCC cobra os arts. 20 a 30 de forma literal em provas recentes de controle'),
    'Lei de abuso de autoridade (Lei 13.869/2019)': ('Média', 'Lei de 2019 sem histórico nas provas analisadas; cobrança literal típica da FCC'),
    'Responsabilização do agente público; Decreto Federal 9.830/2019': ('Alta', 'Decreto que regulamenta a LINDB e é item expresso do edital; sem histórico (norma de 2019)'),
    'Lei de Improbidade Administrativa (Lei 8.429/1992, alterada pela Lei 14.230/2021)': ('Alta', 'Reforma de 2021 muito explorada por bancas; as provas analisadas são anteriores à reforma'),
    'Licitação e contratos administrativos no Direito Administrativo; Lei 12.232/2010 (publicidade)': ('Baixa', 'Lei específica de publicidade; sem histórico e de baixo potencial; a licitação em geral está em "Licitações e Contratos"'),
    'Direito de acesso à informação: Lei 12.527/2011 e Lei estadual 18.025/2013': ('Alta', 'Lei estadual de acesso à informação tem cobrança literal típica da FCC em provas de TCE'),
    'Processo administrativo: Lei estadual 13.800/2001': ('Alta', 'Lei estadual de processo administrativo explicitada no edital; a FCC cobra a lei local (houve questões sobre ela em 2009 e 2014)'),
}

T['a01lic'] = [
    ('Princípios e governança das contratações públicas', r'principios? (da|das) (licitac|contratac)|principio da (vinculacao|isonomia|competitividade|probidade|julgamento objetivo|economicidade)|governanca das contratac|julgamento objetivo|vinculacao ao (instrumento|edital)|isonomia'),
    ('Planejamento das contratações: PAC, ETP, Termo de Referência e matriz de riscos', r'plano anual de contratac|estudo tecnico preliminar|termo de referencia|projeto basico|matriz de riscos|\betp\b|planejamento da contratacao'),
    ('Modalidades de licitação e critérios de julgamento', r'pregao|concorrencia|tomada de precos|convite|leilao|dialogo competitivo|concurso.*licitac|menor preco|melhor tecnica|tecnica e preco|maior desconto|modalidade'),
    ('Fases da licitação: preparatória, divulgação, julgamento, habilitação, recursal e homologação', r'habilitacao|homologa|adjudica|fase recursal|impugnac|edital de licitacao|publicacao do edital|prazo.*propostas|fase (interna|externa)|inversao de fases'),
    ('Contratação direta: dispensa e inexigibilidade', r'dispensa de licitacao|dispensavel|dispensada|inexigibilidade|inexigivel|contratacao direta|8\.666.*art\. ?2[4-5]|notoria especializacao|fornecedor exclusivo'),
    ('Sistema de registro de preços; credenciamento e pré-qualificação', r'registro de precos|credenciamento|pre-?qualificacao|ata de registro|procedimentos auxiliares'),
    ('Contratos administrativos: formalização, execução, fiscalização e gestão contratual', r'contratos? administrativos?|clausulas? exorbitantes?|fiscal do contrato|gestor do contrato|garantia contratual|vigencia|formalizacao do contrato|clausulas? necessarias|execucao do contrato|fiscalizacao do contrato|subcontrata'),
    ('Recebimento do objeto', r'recebimento (provisorio|definitivo)|termo de recebimento|recebimento do objeto'),
    ('Alterações contratuais e equilíbrio econômico-financeiro', r'equilibrio economico|reajuste|repactuacao|reequilibrio|termo aditivo|aditamento|alteracao (unilateral|do contrato|contratual)|teoria da imprevisao|fato do principe|fato da administracao|limite.*25%|acrescimos? ou supress'),
    ('Sanções administrativas e processo sancionador', r'sancoes? administrativas?|advertencia|multa de mora|impedimento de licitar|inidoneidade|suspensao temporaria|processo sancionador|desconsideracao da personalidade|rescisao do contrato|rescisao unilateral'),
    ('Portal Nacional de Contratações Públicas (PNCP)', r'\bpncp\b|portal nacional de contratac'),
]
NOVO_LIC = {
    # A Lei 14.133/2021 revogou 8.666/93 e 10.520/02; o histórico das provas é de leis revogadas
    'Princípios e governança das contratações públicas': ('Alta', 'Disciplina própria no edital 2026 e Lei 14.133/2021 com princípios novos (planejamento, segregação de funções, governança); histórico baseado na Lei 8.666'),
    'Planejamento das contratações: PAC, ETP, Termo de Referência e matriz de riscos': ('Urgente', 'Estreia: instrumentos novos da Lei 14.133 (PCA, ETP, matriz de riscos) listados nominalmente no edital; a FCC cobra o texto da lei'),
    'Portal Nacional de Contratações Públicas (PNCP)': ('Alta', 'Estreia; item nominal do edital, de cobrança literal e curta (arts. 174 a 176 da Lei 14.133)'),
    'Sistema de registro de preços; credenciamento e pré-qualificação': ('Alta', 'Credenciamento e pré-qualificação são novidades da Lei 14.133; SRP já caiu em prova de 2009'),
    'Recebimento do objeto': ('Média', 'Item nominal do edital, de escopo restrito (art. 140 da Lei 14.133)'),
}

T['a01dc'] = [
    ('Aplicabilidade das normas constitucionais: eficácia plena, contida e limitada; normas programáticas', r'eficacia (plena|contida|limitada)|normas? programaticas?|aplicabilidade|aplicacao imediata'),
    ('Princípios fundamentais', r'principios fundamentais|fundamentos da republica|objetivos fundamentais|art\. ?[1-4]o|republica federativa|dignidade da pessoa humana|soberania'),
    ('Direitos e garantias fundamentais: direitos e deveres individuais e coletivos', r'direitos e deveres individuais|habeas|mandado de (seguranca|injuncao)|inviolab|liberdade de|devido processo|acao popular|art\. ?5|clausulas? petreas|direitos fundamentais|garantias fundamentais|extradicao|pena de'),
    ('Direitos sociais', r'direitos sociais|art\. ?[67]o|greve|sindical|trabalhadores urbanos'),
    ('Direitos de nacionalidade', r'nacionalidade|brasileiro (nato|naturalizado)|naturaliz'),
    ('Direitos políticos e partidos políticos', r'direitos politicos|inelegib|partidos? politicos?|alistamento|sufragio|plebiscito|referendo|elegibilidade|voto (secreto|obrigatorio|facultativo)'),
    ('Organização político-administrativa: União, Estados, Municípios e competências', r'competencia (privativa|comum|concorrente|exclusiva|legislativa)|estados federados|intervencao (federal|da uniao)|distrito federal|territorios|bens da uniao|fusao e incorporacao de municipios'),
    ('Administração Pública: disposições gerais e servidores públicos', r'servidores? publicos?|concurso publico|acumulacao|estabilidade|cargo em comissao|disposicoes gerais.*administracao|art\. ?37|aposentadoria|regime proprio'),
    ('Poder Executivo: Presidente e Vice-Presidente da República; atribuições e responsabilidades', r'presidente da republica|poder executivo|crimes? de responsabilidade|ministros? de estado|vice-presidente|impeachment'),
    ('Poder Legislativo: Congresso, Câmara, Senado, parlamentares e processo legislativo', r'congresso nacional|camara dos deputados|senado federal|deputados|senadores|processo legislativo|medida provisoria|lei complementar|emenda (a|a) constituicao|emenda constitucional|cpi|imunidade|iniciativa de lei|lei ordinaria|lei delegada'),
    ('Fiscalização contábil, financeira e orçamentária: controle externo, Tribunais de Contas e MP de Contas', r'tribunal de contas|controle externo|fiscalizacao contabil|ministerio publico (junto|de contas)|art\. ?7[0-5]'),
    ('Poder Judiciário: disposições gerais, STF, CNJ e STJ', r'poder judiciario|supremo tribunal|conselho nacional de justica|\bcnj\b|superior tribunal|magistratura|juizes|controle de constitucionalidade|\badi\b|sumula vinculante|\bstf\b'),
    ('Funções essenciais à Justiça: Ministério Público, Advocacia Pública, Advocacia e Defensoria', r'ministerio publico|advocacia|defensoria|procurador|funcoes essenciais'),
]
NOVO_DC = {}

T['a01ce'] = [
    ('Sistema constitucional de controle: controle interno e controle externo', r'controle interno|controle externo|sistema de controle'),
    ('Competências e natureza jurídica dos Tribunais de Contas; jurisdição sobre os jurisdicionados', r'natureza juridica|jurisdicao|competencias? (do|dos) tribunal|tribunal de contas.*(orgao|auxiliar)|parecer previo|julgar as contas|sumula vinculante.*tribunal|jurisdicionad'),
    ('Instrumentos de fiscalização: auditoria, levantamento, monitoramento, acompanhamento e inspeção', r'levantamento|monitoramento|acompanhamento|inspecao|instrumentos? de fiscalizacao'),
    ('Tipos de auditoria: conformidade, operacional e financeira', r'auditoria (de conformidade|operacional|financeira|governamental|de regularidade)|conformidade|auditoria operacional|desempenho operacional'),
    ('Normas de auditoria governamental: INTOSAI e NBASP 100, 200, 300 e 400', r'intosai|nbasp|issai|normas? de auditoria|nbc ta|nagi|normas internacionais de auditoria'),
    ('Planejamento de auditoria: escopo, amostragem estatística e matriz de risco', r'amostragem|materialidade|risco de auditoria|planejamento (da|de) auditoria|matriz de risco|escopo|riscos? de (distorcao|controle)|risco inerente'),
    ('Programas de auditoria e papéis de trabalho', r'programa de auditoria|papeis? de trabalho|documentacao de auditoria'),
    ('Técnicas e procedimentos de auditoria', r'exame documental|circulariza|conciliac|revisao analitica|inspecao fisica|tecnicas? de auditoria|procedimentos? de auditoria|entrevista|conferencia de calculos|observacao'),
    ('Evidências, achados de auditoria, matriz de achados e matriz de responsabilização', r'achado|evidencia|matriz de (achados|responsabilizacao|planejamento)|criterio.*causa.*efeito|suficiente.*apropriada'),
    ('Comunicação dos resultados: relatórios de auditoria e monitoramento de determinações e recomendações', r'relatorio de auditoria|recomendac|determinac|opiniao do auditor|parecer de auditoria|comunicacao dos resultados|monitoramento das'),
    ('Prestações e tomadas de contas; processo de controle externo; contraditório, ampla defesa, responsabilização e sanções', r'prestac(ao|oes) de contas|tomada de contas|contas (irregulares|regulares)|debito|multa|contraditorio|ampla defesa|responsabilizacao|sancoes|tomada de contas especial'),
]
NOVO_CE = {
    'Normas de auditoria governamental: INTOSAI e NBASP 100, 200, 300 e 400': ('Alta', 'Estreia: NBASP 100/200/300/400 são nominais no edital e a FCC cobra a literalidade das normas; histórico existente é de auditoria genérica'),
    'Tipos de auditoria: conformidade, operacional e financeira': ('Urgente', 'Disciplina nova para o técnico (as provas de 2009 não tinham controle externo); auditoria de conformidade, operacional e financeira é o núcleo da disciplina'),
    'Instrumentos de fiscalização: auditoria, levantamento, monitoramento, acompanhamento e inspeção': ('Urgente', 'Núcleo da disciplina; os cinco instrumentos são cobrados de forma comparativa'),
    'Evidências, achados de auditoria, matriz de achados e matriz de responsabilização': ('Alta', 'Estreia: matriz de achados e de responsabilização são itens nominais do edital'),
    'Planejamento de auditoria: escopo, amostragem estatística e matriz de risco': ('Alta', 'Estreia como disciplina do cargo técnico; amostragem e matriz de risco são nominais'),
}

T['a01afo'] = [
    ('Orçamento público: conceito e princípios orçamentários', r'principio (da|do) (universalidade|unidade|anualidade|exclusividade|legalidade|equilibrio|especificacao|programacao|clareza|publicidade|unicidade|orcamento bruto|nao afetacao)|principios? orcamentarios?|orcamento publico'),
    ('Ciclo orçamentário', r'ciclo orcamentario|fases? do ciclo|exercicio financeiro'),
    ('Orçamento-Programa; emendas parlamentares e orçamento impositivo', r'orcamento-?programa|emendas? (parlamentares?|individuais?|impositiva)|orcamento impositivo|orcamento tradicional|orcamento de desempenho|\bppbs\b|orcamento base zero'),
    ('Orçamento na CF/88 (arts. 165 a 169): PPA, LDO e LOA; elaboração, discussão, votação e aprovação', r'\bppa\b|plano plurianual|lei de diretrizes orcamentarias|\bldo\b|lei orcamentaria anual|\bloa\b|art\. ?165|iniciativa.*orcamentari|proposta orcamentaria|emenda.*projeto de lei orcamentaria'),
    ('Receita orçamentária: conceito, etapas, estágios, fontes e classificações', r'receita (orcamentaria|corrente|de capital|publica|tributaria|realizada|derivada|originaria)|estagios? da receita|previsao.*lancamento|arrecadacao|fonte de recursos|categoria economica|receitas? (patrimonial|de servicos|imobiliaria)|receita extraorcamentaria|ingressos? extraorcamentarios?'),
    ('Despesa orçamentária: conceito, etapas, estágios e estrutura programática', r'empenho|liquidacao|estagios? da despesa|despesa (corrente|de capital|orcamentaria|publica)|modalidade de aplicacao|elemento de despesa|fixacao|estrutura programatica|programa de trabalho|ordem de pagamento'),
    ('Classificações da despesa: esfera, institucional, funcional e por natureza', r'classificacao (funcional|institucional|programatica|por natureza|economica|da despesa)|subfuncao|esfera orcamentaria|natureza da despesa|grupo de despesa|categoria economica'),
    ('Dispêndios extraorçamentários', r'extraorcamentari|dispendios?|depositos? de terceiros|restituiveis'),
    ('Restos a pagar e despesas de exercícios anteriores', r'restos a pagar|despesas? de exercicios? anteriores?|processados|nao processados'),
    ('Créditos orçamentários iniciais e adicionais', r'credito (suplementar|especial|extraordinario|adicional|inicial)|creditos? adicionais?|reabertura de credito|excesso de arrecadacao|superavit financeiro|anulacao parcial|abertura de credito'),
    ('Dívida flutuante e fundada; suprimento de fundos', r'divida (flutuante|fundada|publica|consolidada)|suprimento de fundos|adiantamento|regime de adiantamento'),
    ('Programação financeira', r'programacao financeira|cronograma de execucao mensal|contingenciamento|limitacao de empenho|quotas? trimestrais?|cotas? trimestrais?|movimentacao financeira'),
    ('Despesa obrigatória de caráter continuado e despesas com pessoal: definições e limites', r'despesa obrigatoria de carater continuado|\bdocc\b|despesa total com pessoal|limite.*(pessoal|executivo|legislativo)|60%|54%|6%|despesa.*pessoal|seguridade social|aumento de despesa'),
    ('Dívida e endividamento público; operações de crédito e ARO', r'operacoes? de credito|antecipacao de receita|\baro\b|limite.*divida|recondu|divida consolidada|endividamento|garantia.*operacao de credito|senado federal.*limite'),
    ('Lei de Responsabilidade Fiscal (LC 101/2000): planejamento, receita, transparência e relatórios', r'responsabilidade fiscal|\blrf\b|lc 101|101/2000|rgf|rreo|metas fiscais|renuncia de receita|gestao fiscal|riscos fiscais|anexo de metas|transparencia.*gestao fiscal|prestacao de contas.*lrf|lei complementar no 101'),
    ('Lei 4.320/1964 e alterações', r'4\.320|lei no 4\.320'),
    ('MCASP 11ª edição: Parte I – Procedimentos Contábeis Orçamentários', r'mcasp|manual de contabilidade aplicada'),
]
NOVO_AFO = {
    'Orçamento-Programa; emendas parlamentares e orçamento impositivo': ('Alta', 'Emendas e orçamento impositivo (EC 86/2015 e posteriores) estreiam no edital; o orçamento-programa é clássico FCC'),
    'MCASP 11ª edição: Parte I – Procedimentos Contábeis Orçamentários': ('Média', 'MCASP em edição nova (11ª); a FCC cobra conceitos já tratados na Lei 4.320 e na LRF'),
}

T['a01cont'] = [
    ('NBC TSP Estrutura Conceitual', r'estrutura conceitual|nbc tsp|nbc t 16|caracteristicas qualitativas|objetivos da informacao contabil|elementos das demonstracoes|reconhecimento e mensuracao'),
    ('NBC TSP 01 e 02: receitas de transação com e sem contraprestação', r'receita de transac|transacao (com|sem) contraprestacao|nbc tsp 0[12]|tributos.*receita'),
    ('NBC TSP 03 e 04: provisões, passivos e ativos contingentes; estoques', r'provisoes?|passivos? contingentes?|ativos? contingentes?|estoques?|custo medio|peps|valor realizavel liquido'),
    ('NBC TSP 06 a 10: propriedade para investimento, ativo imobilizado, ativo intangível e redução ao valor recuperavel', r'ativo imobilizado|intangivel|propriedade para investimento|depreciacao|amortizacao|exaustao|reavaliacao|valor recuperavel|impairment|vida util|valor residual|bens de uso comum'),
    ('NBC TSP 11 a 13: apresentação das demonstrações contábeis, fluxos de caixa e informação orçamentária', r'fluxos? de caixa|apresentacao das demonstracoes|informacao orcamentaria|demonstracao dos fluxos|dfc|comparacao orcamento'),
    ('NBC TSP 15, 23, 25 e 34: benefícios a empregados, políticas contábeis e erros, evento subsequente e custos', r'beneficios a empregados|politicas contabeis|mudanca de estimativa|retificacao de erro|evento subsequente|custos no setor publico|sistema de custos|custeio'),
    ('MCASP Parte II – Procedimentos Contábeis Patrimoniais', r'procedimentos contabeis patrimoniais|regime de competencia|reconhecimento.*ativo|variacao patrimonial|vpa|vpd|ajuste.*perdas|passivo|ativo circulante|patrimonio liquido'),
    ('Plano de Contas Aplicado ao Setor Público (PCASP) e MCASP Parte IV', r'pcasp|plano de contas|natureza de informacao|classe\s*[1-8]|contas? de controle|natureza orcamentaria|natureza patrimonial|plano de contas aplicado'),
    ('MCASP Parte V – Demonstrações Contábeis Aplicadas ao Setor Público', r'balanco (patrimonial|orcamentario|financeiro)|demonstracao das variacoes patrimoniais|\bdvp\b|\bdmpl\b|demonstracoes? contabeis|superavit financeiro|resultado patrimonial|mutacoes'),
    ('MCASP Parte I e Lei 4.320/1964 na contabilidade: procedimentos orçamentários e balanços', r'4\.320|mcasp|parte i|procedimentos contabeis orcamentarios|empenho.*contabil|restos a pagar.*contabil'),
    ('Prestação de contas ao Tribunal de Contas', r'prestacao de contas.*tribunal|tribunal de contas.*prestacao|contas anuais.*governador|balanco geral'),
]
NOVO_CONT = {
    'NBC TSP Estrutura Conceitual': ('Alta', 'Base conceitual das NBC TSP; edital 2026 passou a citar as NBC TSP nominalmente (as provas anteriores usavam as NBC T 16)'),
    'NBC TSP 01 e 02: receitas de transação com e sem contraprestação': ('Alta', 'Normas novas (2016 em diante), antes inexistentes; o edital as lista nominalmente'),
    'NBC TSP 03 e 04: provisões, passivos e ativos contingentes; estoques': ('Alta', 'Normas novas; estoque e provisão são temas clássicos de questão de contabilidade'),
    'NBC TSP 06 a 10: propriedade para investimento, ativo imobilizado, ativo intangível e redução ao valor recuperavel': ('Urgente', 'Imobilizado, depreciação e intangível são os temas patrimoniais mais cobrados pela FCC; edital lista as normas'),
    'NBC TSP 11 a 13: apresentação das demonstrações contábeis, fluxos de caixa e informação orçamentária': ('Alta', 'Normas novas; demonstrações contábeis são recorrentes em provas de TCE'),
    'NBC TSP 15, 23, 25 e 34: benefícios a empregados, políticas contábeis e erros, evento subsequente e custos': ('Média', 'Normas de menor volume; cobrança literal e esparsa'),
    'MCASP Parte II – Procedimentos Contábeis Patrimoniais': ('Alta', 'Parte nominal do edital (11ª edição); cobrança conceitual de reconhecimento e mensuração'),
    'Plano de Contas Aplicado ao Setor Público (PCASP) e MCASP Parte IV': ('Alta', 'PCASP é nominal do edital e a estrutura de classes é cobrada de forma literal'),
    'MCASP Parte V – Demonstrações Contábeis Aplicadas ao Setor Público': ('Urgente', 'Demonstrações (BP, BO, BF, DVP, DFC, DMPL) são o assunto central da contabilidade pública cobrado pela FCC'),
    'MCASP Parte I e Lei 4.320/1964 na contabilidade: procedimentos orçamentários e balanços': ('Alta', 'Interface entre orçamento e contabilidade; base para as questões de AFO e de balanços'),
    'Prestação de contas ao Tribunal de Contas': ('Média', 'Item nominal do edital, de escopo restrito; sobreposição com Controle Externo'),
}

T['a01ap'] = [
    ('Organizações formais modernas: tipos de estrutura organizacional e critérios de departamentalização', r'departamentaliza|estrutura organizacional|organograma|organizacoes formais|amplitude de controle|centraliza|estrutura (funcional|matricial|divisional|em rede)'),
    ('Processo organizacional: planejamento, organização, direção, coordenação, comunicação, controle e avaliação', r'funcoes administrativas|planejamento, organizacao|processo organizacional|funcao (de )?(planejamento|organizacao|direcao|controle)|\bpdca\b|ciclo pdca'),
    ('Princípios básicos da Administração Pública e administração gerencial', r'administracao publica (gerencial|burocratica|patrimonialista)|nova gestao publica|reforma gerencial|plano diretor da reforma|patrimonialismo|modelo burocratico|principio da eficiencia'),
    ('Gestão da qualidade: excelência nos serviços públicos, simplificação e Decreto 9.094/2017', r'carta de servicos|9\.094|gespublica|gestao da qualidade|qualidade (total|no servico|dos servicos|no setor publico)|simplificacao|excelencia (no|nos) servicos?|racionalizacao|\bsix sigma\b|\btqm\b'),
    ('Gestão estratégica do Poder Judiciário brasileiro', r'estrategia nacional do poder judiciario|planejamento estrategico.*judiciario|macrodesafios'),
    ('Ferramentas de análise e planejamento estratégico, tático e operacional; Balanced Scorecard', r'swot|balanced|\bbsc\b|planejamento (tatico|operacional|estrategico)|5w2h|matriz gut|diagrama de|ishikawa|pareto|brainstorming|benchmarking|analise de cenarios|mapa estrategico'),
    ('Gestão de projetos', r'gerenciamento de projetos|gestao de projetos|gerente de projetos|pmbok|escopo do projeto|\beap\b|partes interessadas|ciclo de vida do projeto|cronograma do projeto'),
    ('Gestão de processos', r'mapeamento de processos|\bbpm\b|bpmn|fluxograma|gestao por processos|processos de negocio|melhoria de processos|gestao de processos|cadeia de valor'),
    ('Metodologias de avaliação de desempenho e indicadores de gestão', r'indicador|avaliacao de desempenho|eficiencia, eficacia|efetividade|metas e resultados|resultado.*servico publico'),
    ('Governança e governabilidade; transparência e acesso à informação', r'governanca|governabilidade|accountability|transparencia|controle social|participacao social|compliance|integridade'),
    ('Gestão por competências', r'gestao por competencias|competencias (essenciais|individuais|organizacionais|gerenciais)|\bcha\b|conhecimentos, habilidades e atitudes'),
    ('Processo decisório e gestão de conflitos', r'processo decisorio|tomada de decisao|conflito|negociacao|mediacao|arbitragem|racionalidade'),
    ('Gestão pública eficiente, eficaz e efetiva; convergências e diferenças entre gestão pública e privada', r'gestao publica.*privada|eficiente, eficaz|eficaz e efetiv|setor publico e privado|administracao publica e privada|gerencialismo'),
]
NOVO_AP = {
    'Gestão estratégica do Poder Judiciário brasileiro': ('Baixa', 'Item atípico para um Tribunal de Contas (trata do Poder Judiciário); sem histórico nas provas de TCE analisadas'),
    'Gestão da qualidade: excelência nos serviços públicos, simplificação e Decreto 9.094/2017': ('Média', 'Decreto 9.094/2017 estreia nominalmente; qualidade em serviços públicos já foi tema esparso'),
}

T['a01ag'] = [
    ('Teorias da Administração e evolução das escolas administrativas', r'taylor|fayol|escola (classica|cientifica|das relacoes humanas|comportamental|estruturalista|neoclassica|sistemica|contingencial|burocratica)|burocracia|weber|mayo|teoria (x|y|z)|sociotecnic|toyotismo|fordismo|teoria (classica|neoclassica|comportamental|contingencial)|abordagem (classica|humanistica|neoclassica)|relacoes humanas'),
    ('Metáforas organizacionais', r'metafora organizacional|metaforas|morgan|organizacao como (maquina|organismo|cerebro|cultura)'),
    ('Funções do administrador: papéis gerenciais e habilidades', r'mintzberg|katz|papeis gerenciais|habilidades (tecnica|humana|conceitual)|funcoes do administrador|nivel (estrategico|tatico|operacional)'),
    ('Tipos de organização e estrutura organizacional', r'estrutura (funcional|matricial|divisional|por projetos|em rede|linear|hibrida)|tipos de (organizacao|estrutura)|organizacao (linear|funcional)|organogramas?'),
    ('Processo decisório e tipos de decisão', r'decisao (programada|nao programada)|decisoes? (programadas|estrategicas)|simon|racionalidade limitada|processo decisorio|modelo (racional|incremental|lixeira)'),
    ('Organização racional do trabalho; eficiência e eficácia; divisão do trabalho e especialização', r'organizacao racional do trabalho|\bort\b|racionalizacao do trabalho|divisao do trabalho|especializacao|eficiencia e eficacia|administracao cientifica'),
    ('Ambientes organizacionais', r'ambiente (geral|de tarefa|organizacional|externo|interno)|stakeholders|analise ambiental|macroambiente'),
    ('Organizações formais e informais; centralização e descentralização; departamentalização', r'organizacao informal|organizacoes formais|centralizacao|descentralizacao|departamentalizacao|delegacao'),
    ('Visão sistêmica', r'teoria (geral )?de sistemas|sistema aberto|visao sistemica|entropia|homeostase|sinergia|abordagem sistemica|equifinalidade'),
    ('Noções básicas de gerenciamento de projetos', r'gerenciamento de projetos|gestao de projetos|gerente de projetos|pmbok|escopo|cronograma|\beap\b'),
]
NOVO_AG = {}

T['a01ae'] = [
    ('Planejamento estratégico: missão, visão e valores', r'missao|visao de futuro|\bvisao\b|valores organizacionais|planejamento estrategico'),
    ('Diagnóstico estratégico dos ambientes externo e interno', r'diagnostico|ambiente externo|ambiente interno|analise ambiental|oportunidades e ameacas|forcas e fraquezas'),
    ('Formulação, implementação e controle da estratégia', r'formulacao da estrategia|implementacao da estrategia|controle estrategico|estrategia (competitiva|corporativa|funcional|emergente|deliberada)|tipos de estrategia|estrategias genericas|lideranca em custos|estrategia de diferenciacao'),
    ('Análise SWOT', r'swot|\bfofa\b|forcas, fraquezas'),
    ('Cinco forças competitivas de Porter', r'cinco forcas|porter|ameaca de novos entrantes|poder de barganha|produtos substitutos|rivalidade'),
    ('Visão Baseada em Recursos (RBV)', r'visao baseada em recursos|\brbv\b|\bvrio\b|recursos e capacidades|vantagem competitiva|competencias essenciais|core competence'),
    ('Business Model Canvas', r'canvas|modelo de negocios?'),
    ('Escolas do Planejamento Estratégico', r'escolas? (do|de) (design|planejamento|posicionamento|empreendedora|cognitiva|aprendizado|poder|cultural|ambiental|configuracao)|safari de estrategia|mintzberg'),
    ('Balanced Scorecard (BSC)', r'balanced scorecard|\bbsc\b|mapa estrategico|perspectiva (financeira|do cliente|dos processos|de aprendizado)|perspectivas'),
    ('Cadeia de Valor', r'cadeia de valor|atividades primarias|atividades de apoio'),
]
NOVO_AE = {}

T['a01co'] = [
    ('Fundamentos do Comportamento Organizacional e individual', r'comportamento organizacional|comportamento individual|percepcao|atribuicao de causa|vies'),
    ('Valores, atitudes e satisfação no trabalho', r'valores (pessoais|organizacionais|terminais|instrumentais)|atitudes?|satisfacao no trabalho|dissonancia cognitiva|comprometimento organizacional|envolvimento no trabalho'),
    ('Personalidade', r'personalidade|big five|\bmbti\b|extroversao|neuroticismo|locus de controle|autoeficacia'),
    ('Emoções e motivação', r'motivacao|maslow|herzberg|mcclelland|vroom|adams|teoria da expectativa|equidade|inteligencia emocional|emocoes|higienicos|motivacionais|necessidades|reforco|locke'),
    ('Equipes de trabalho', r'equipes?|grupos? de trabalho|trabalho em equipe|pensamento de grupo|tuckman|coesao'),
    ('Liderança', r'lideranca|lider|situacional|transformacional|transacional|path-?goal|fiedler|blake|grid gerencial|hersey'),
    ('Conflito e negociação', r'conflito|negociacao|barganha|mediacao'),
    ('Desenvolvimento Organizacional', r'desenvolvimento organizacional|mudanca organizacional|lewin|pesquisa-acao|resistencia a mudanca|gestao da mudanca|kotter|agente de mudanca'),
    ('Comunicação organizacional', r'comunicacao (organizacional|formal|informal|interpessoal|nao verbal)|barreiras? (a|na) comunicacao|ruido|rede de comunicacao|boato'),
    ('Clima e cultura organizacional', r'clima organizacional|cultura organizacional|schein|hofstede|pesquisa de clima|valores compartilhados|artefatos'),
]
NOVO_CO = {}

T['a01gp'] = [
    ('Departamento pessoal e rotinas administrativas', r'departamento pessoal|folha de pagamento|admissao|rescisao|jornada de trabalho|ferias|13o salario|esocial|folha de ponto'),
    ('Recrutamento, seleção e integração', r'recrutamento|selecao|integracao|entrevista de selecao|socializacao|onboarding|testes de selecao'),
    ('Treinamento, capacitação e desenvolvimento', r'treinamento|capacitacao|desenvolvimento de pessoas|levantamento de necessidades|avaliacao de treinamento|kirkpatrick|educacao corporativa|\bt&d\b|\btd&e\b'),
    ('Gestão e avaliação de desempenho', r'avaliacao de desempenho|avaliacao 360|gestao de desempenho|desempenho|feedback|metas individuais|escala grafica|incidentes criticos|avaliacao por objetivos'),
    ('Remuneração e benefícios', r'remuneracao|salario|beneficios|cargos e salarios|plano de cargos|avaliacao de cargos|remuneracao (variavel|por competencia)|participacao nos resultados|bonus'),
    ('Gestão Estratégica de RH: planejamento, retenção de talentos e plano de carreira', r'gestao estrategica de (pessoas|recursos humanos|rh)|planejamento de (pessoal|recursos humanos)|retencao|talentos?|plano de carreira|turnover|absenteismo|dimensionamento|\bbalanced\b.*pessoas|capital humano|empregabilidade|sucessao'),
    ('Gestão do conhecimento, aprendizagem organizacional e gestão da informação', r'gestao do conhecimento|conhecimento (tacito|explicito)|nonaka|takeuchi|aprendizagem organizacional|organizacao que aprende|senge|gestao da informacao|capital intelectual|comunidades de pratica'),
    ('Gestão por competências', r'competencias (essenciais|individuais|organizacionais|gerenciais)|\bcha\b|mapeamento de competencias|gestao por competencias'),
    ('Clima e cultura organizacional', r'clima organizacional|cultura organizacional|pesquisa de clima'),
    ('Qualidade de vida no trabalho', r'qualidade de vida no trabalho|\bqvt\b|ergonomia|saude ocupacional|estresse|burnout|assedio|saude e seguranca'),
    ('Diversidade, inclusão e acessibilidade', r'diversidade|inclusao|acessibilidade|pessoas? com deficiencia|igualdade'),
    ('Teletrabalho e trabalho híbrido; trabalho em equipe', r'teletrabalho|trabalho hibrido|home office|trabalho remoto|trabalho em equipe'),
    ('Legislação aplicável ao servidor público estadual: Lei estadual 20.756/2020', r'20\.756|regime juridico dos servidores|estatuto dos (servidores|funcionarios)|funcionarios publicos do estado'),
]
NOVO_GP = {
    'Diversidade, inclusão e acessibilidade': ('Média', 'Tema atual, cobrado de forma crescente em provas recentes de gestão de pessoas; sem questão nas provas analisadas'),
    'Teletrabalho e trabalho híbrido; trabalho em equipe': ('Média', 'Estreia no edital; tema de alta atualidade, mas de escopo conceitual restrito'),
    'Legislação aplicável ao servidor público estadual: Lei estadual 20.756/2020': ('Alta', 'Cobrança da lei local é frequente na FCC (houve questão sobre o estatuto estadual nas provas de 2014); coincide com Legislação Institucional'),
}

NOVO = {}
for d in (NOVO_CG, NOVO_DA, NOVO_LIC, NOVO_DC, NOVO_CE, NOVO_AFO, NOVO_CONT, NOVO_AP, NOVO_AG, NOVO_AE, NOVO_CO, NOVO_GP):
    NOVO.update(d)

# Itens "interpretação": o edital não cita o item literalmente (tópico desdobrado para estudo)
DESDOBRAMENTO = {
    'Compreensão e interpretação de textos de gêneros variados': False,
}

# Ajustes de prioridade para itens nominais do edital cuja ausência (ou raridade) na amostra de provas
# antigas (2009 a 2015) não significa baixa chance de cobrança hoje. Cada um explica o motivo.
NOVO.update({
    'Emprego do sinal indicativo de crase': ('Média', 'Sem questão objetiva na amostra, mas é item nominal do Anexo II e consta dos critérios de correção da Redação (item 10.6, morfossintaxe)'),
    'Regra de três simples': ('Média', 'Costuma aparecer dentro de problemas de proporção e porcentagem, que somam 27 questões na amostra'),
    'Elementos e requisitos de validade do ato administrativo': ('Alta', 'Base da teoria do ato e das questões de extinção; aparece também de forma indireta nas questões de classificação'),
    'Formulação, implementação e controle da estratégia': ('Média', 'Núcleo conceitual da disciplina; as provas antigas tratavam o tema junto ao planejamento estratégico (27 questões)'),
    'Análise SWOT': ('Média', 'Item nominal do edital; a FCC cobra o conceito literal e a amostra antiga é anterior à ênfase atual em ferramentas'),
    'Cinco forças competitivas de Porter': ('Média', 'Item nominal do edital, sem questão na amostra antiga; conceito curto e de cobrança literal'),
    'Visão Baseada em Recursos (RBV)': ('Média', 'Item nominal do edital, sem questão direta na amostra antiga'),
    'Business Model Canvas': ('Média', 'Estreia: item nominal do edital 2026, sem histórico'),
    'Cadeia de Valor': ('Média', 'Item nominal do edital, sem questão na amostra; conceito curto'),
    'Gestão por competências': ('Média', 'Citada em duas disciplinas do edital (Administração Pública e Gestão de Pessoas); 1 questão isolada na amostra'),
    'Qualidade de vida no trabalho': ('Média', 'Item nominal do edital, sem questão na amostra; tema recorrente em Gestão de Pessoas de outras bancas'),
    'Funções do administrador: papéis gerenciais e habilidades': ('Média', 'Item nominal (funções do administrador); base para a teoria geral; sem questão na amostra'),
    'Balanced Scorecard (BSC)': ('Alta', 'O BSC aparece em duas disciplinas do edital (Administração Estratégica e Administração Pública)'),
})
