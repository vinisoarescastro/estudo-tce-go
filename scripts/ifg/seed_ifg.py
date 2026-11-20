"""Gera src/data/seed-ifg308.json: edital verticalizado do IFG 2026, cargo 308 (Técnico de Laboratório/Área Química).

Uso: python scripts/ifg/seed_ifg.py public/editais/ifg-2026.pdf fontes/ifg-2026/edital_verticalizado_308_quimica.xlsx src/data/seed-ifg308.json

Entradas
  - ifg-2026.pdf: Edital de Abertura nº 001/2026 (texto oficial do Anexo III, páginas 31 e 33)
  - edital_verticalizado_308_quimica.xlsx: aba "Edital", com a divisão dos conteúdos, a prioridade e a
    evidência nas provas IFPB 2025 e IFCE 2026 (Instituto AOCP); veja docs/ifg-2026/ANALISE-BANCA-AOCP.md
Saída
  - o seed no mesmo formato dos seeds do TCE-GO, com os blocos "cargo" e "concurso"

Os ids (disciplinas ifg*, conteúdos i001…) ficam presos à ordem das linhas da planilha: o progresso dos
usuários guarda só esses ids. Para mudar o conteúdo depois, acrescente linhas no fim de cada disciplina,
não reordene, e aumente SEED_VERSION.
"""
import json, os, re, subprocess, sys, unicodedata
from collections import Counter, OrderedDict

import openpyxl

SEED_VERSION = 1
PDFTOTEXT = os.environ.get('PDFTOTEXT', 'pdftotext')
pdf, planilha, saida = sys.argv[1], sys.argv[2], sys.argv[3]


def nfc(s): return unicodedata.normalize('NFC', s)


def pagina(p):
    t = subprocess.run([PDFTOTEXT, '-f', str(p), '-l', str(p), '-enc', 'UTF-8', pdf, '-'], capture_output=True, text=True, encoding='utf8').stdout
    return re.sub(r'\s+', ' ', nfc(t).replace('​', '')).strip()


# ----------------------------------------------------------------------------------------------
# 1. Texto oficial do Anexo III: conhecimentos comuns (p. 31) e específicos do cargo (p. 33)
P_GERAIS, P_QUIMICA = 31, 33
p31, p33 = pagina(P_GERAIS), pagina(P_QUIMICA)


def entre(txt, ini, fim):
    a = txt.index(ini) + len(ini)
    b = txt.index(fim, a) if fim else len(txt)
    return txt[a:b].strip()


TEXTO = {
    'ifglp': entre(p31, 'Língua portuguesa:', 'Legislação:'),
    'ifgleg': entre(p31, 'Legislação:', 'Raciocínio Lógico e Matemática:'),
    'ifgrlm': entre(p31, 'Raciocínio Lógico e Matemática:', 'Informática:'),
    'ifginf': entre(p31, 'Informática:', 'NÍVEL MÉDIO'),
    'ifgqui': entre(entre(p33, 'CARGO: TÉCNICO DE LABORATÓRIO/ÁREA QUÍMICA', 'CARGO:'), 'Conhecimentos específicos:', None),
}
for d, t in TEXTO.items():
    assert len(t) > 200, d


def itens(txt):
    """Divide o texto da disciplina nos itens numerados do edital: {número: 'N. texto'}."""
    partes = re.split(r'(?:(?<=^)|(?<=[.;] ))(\d{1,2})\. (?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])', txt)
    out = OrderedDict()
    for i in range(1, len(partes) - 1, 2):
        n = int(partes[i])
        out[n] = f'{n}. {partes[i + 1].strip()}'
    return out


ITENS = {d: itens(t) for d, t in TEXTO.items()}
assert list(ITENS['ifglp']) == list(range(1, 22)), ITENS['ifglp'].keys()
assert list(ITENS['ifgrlm']) == list(range(1, 6))
assert list(ITENS['ifginf']) == list(range(1, 9))
assert list(ITENS['ifgqui']) == list(range(1, 24))
assert list(ITENS['ifgleg']) == list(range(1, 8))

# Legislação: a planilha numera as normas na própria ordem (1 a 13), diferente do edital, que agrupa a
# Constituição no item 1 e deixa as últimas leis sem número. Cada linha da planilha aponta para o trecho
# do edital pela norma citada.
LEG = ITENS['ifgleg']
item7_resto = LEG[7]  # "7. Lei Federal nº 12.527/2011. Lei Federal 13.709/2018. Lei Federal nº 14.133/2021. …"
def lei(chave):
    for s in re.split(r'(?<=\.) (?=Lei )', item7_resto):
        if chave in s:
            return s.strip()
    raise KeyError(chave)
LEG_TRECHO = {
    1: LEG[2], 2: LEG[6], 3: LEG[5],
    4: 'Constituição da República Federativa do Brasil 1988: Título III - Da Organização do Estado: Capítulo VII ‒ Da Administração Pública',
    5: 'Título VIII – Da Ordem Social: Capítulo III ‒ Da Educação, da Cultura e do Desporto',
    6: LEG[3], 7: LEG[4], 8: lei('9.784'), 9: lei('12.527'), 10: lei('13.709'), 11: lei('8.429'), 12: lei('14.133'),
    13: 'Capítulo IV ‒ Da Ciência e Tecnologia',
}
for k, v in LEG_TRECHO.items():
    assert v.split(': ')[-1].rstrip('.') in TEXTO['ifgleg'] or v in TEXTO['ifgleg'], (k, v)

# ----------------------------------------------------------------------------------------------
# 2. Planilha: uma linha por conteúdo
MATERIAS = OrderedDict([
    ('Língua Portuguesa', ('ifglp', 'Língua Portuguesa', 'Língua Portuguesa', 'CG')),
    ('Legislação', ('ifgleg', 'Legislação', 'Legislação', 'CG')),
    ('Raciocínio Lógico e Matemática', ('ifgrlm', 'Raciocínio Lógico e Matemática', 'Raciocínio Lógico e Matemática', 'CG')),
    ('Informática', ('ifginf', 'Informática', 'Informática', 'CG')),
    ('Conhecimentos Específicos – Química', ('ifgqui', 'Conhecimentos Específicos – Técnico de Laboratório/Área Química', 'Química', 'CE')),
])
PRIORIDADES = {'Urgente', 'Alta', 'Média', 'Baixa'}

ws = openpyxl.load_workbook(planilha, read_only=True)['Edital']
linhas = []
for r in ws.iter_rows(min_row=5, values_only=True):
    if not r[0]:
        continue
    materia, item, conteudo, prio, evid = (nfc(str(x)).strip() if isinstance(x, str) else x for x in r[:5])
    assert materia in MATERIAS, materia
    assert prio in PRIORIDADES, (conteudo, prio)
    linhas.append((MATERIAS[materia][0], int(item), conteudo, prio, evid))

# Itens do edital que a planilha dividiu em vários conteúdos (menos em Legislação, cuja numeração é da planilha)
partes = Counter((d, n) for d, n, *_ in linhas if d != 'ifgleg')

DOC = 'Edital de Abertura nº 001/2026 – Concurso Público IFG'
ANEXO = 'Anexo III – Conteúdo Programático'
SECAO = {'CG': 'Conhecimentos comuns a todos os cargos de nível médio e nível superior', 'CE': 'Conhecimentos específicos – Técnico de Laboratório/Área Química'}

disciplinas, topicos = [], []
for i, (_, (did, nome, curto, nuc)) in enumerate(MATERIAS.items()):
    pag = P_QUIMICA if nuc == 'CE' else P_GERAIS
    disciplinas.append({'id': did, 'nome': nome, 'nomeCurto': curto, 'nucleo': nuc, 'ordemEdital': i + 1, 'paginas': [pag], 'textoOficial': f'{nome}: {TEXTO[did]}' if nuc == 'CG' else TEXTO[did]})

por_titulo = {}
for n, (did, item, conteudo, prio, evid) in enumerate(linhas, start=1):
    nuc = next(v[3] for v in MATERIAS.values() if v[0] == did)
    trecho = LEG_TRECHO[item] if did == 'ifgleg' else ITENS[did][item]
    tid = 'i%03d' % n
    por_titulo[(did, conteudo)] = tid
    topicos.append({
        'id': tid, 'numero': n, 'disciplinaId': did, 'titulo': conteudo,
        'desdobramentoPlanilha': did != 'ifgleg' and partes[(did, item)] > 1,
        'ref': {'documento': DOC, 'anexo': ANEXO, 'secao': SECAO[nuc], 'disciplina': next(d['nome'] for d in disciplinas if d['id'] == did),
                'paginas': [P_QUIMICA if nuc == 'CE' else P_GERAIS], 'trecho': trecho, 'confianca': 'alta'},
        'prioridadePlanilha': prio, 'incidencia': evid, 'statusPlanilha': 'Não estudado'})

# ----------------------------------------------------------------------------------------------
# 3. Pré-requisitos sugeridos (de → para), pelo início do título do conteúdo
def t(did, inicio):
    ach = [v for (d, tit), v in por_titulo.items() if d == did and tit.startswith(inicio)]
    assert len(ach) == 1, (did, inicio, ach)
    return ach[0]

Q = 'ifgqui'
DEPS = [
    # (disciplina, pré-requisito, disciplina, conteúdo que depende dele, tipo)
    (Q, 'Modelos atômicos', Q, 'Estrutura eletrônica', 'O'),
    (Q, 'Estrutura eletrônica', Q, 'Tabela periódica', 'O'),
    (Q, 'Tabela periódica', Q, 'Ligações químicas', 'R'),
    (Q, 'Ligações químicas', Q, 'Geometria molecular', 'O'),
    (Q, 'Geometria molecular', Q, 'Interações intermoleculares', 'O'),
    (Q, 'Ligações químicas', Q, 'Compostos de coordenação', 'R'),
    (Q, 'Funções inorgânicas', Q, 'Nomenclatura e fórmulas', 'R'),
    (Q, 'Funções inorgânicas', Q, 'Reações inorgânicas', 'O'),
    (Q, 'Mol, massa molar', Q, 'Fórmulas químicas', 'O'),
    (Q, 'Balanceamento de equações', Q, 'Cálculo estequiométrico', 'O'),
    (Q, 'Mol, massa molar', Q, 'Cálculo estequiométrico', 'O'),
    (Q, 'Mol, massa molar', Q, 'Unidades de concentração', 'O'),
    (Q, 'Unidades de concentração', Q, 'Diluição e mistura', 'O'),
    (Q, 'Unidades de concentração', Q, 'Preparo, padronização', 'O'),
    (Q, 'Unidades de concentração', Q, 'Propriedades coligativas', 'R'),
    (Q, 'Equilíbrio químico molecular', Q, 'Ácidos e bases', 'R'),
    (Q, 'Ácidos e bases', Q, 'pH e pOH', 'O'),
    (Q, 'pH e pOH', Q, 'Soluções-tampão', 'O'),
    (Q, 'pH e pOH', Q, 'Hidrólise de sais', 'R'),
    (Q, 'pH e pOH', Q, 'Indicadores ácido-base', 'R'),
    (Q, 'Indicadores ácido-base', Q, 'Curvas de titulação', 'R'),
    (Q, 'Equilíbrio químico molecular', Q, 'Equilíbrio de solubilidade', 'R'),
    (Q, 'Equilíbrio químico molecular', Q, 'Fatores que afetam', 'O'),
    (Q, 'Oxirredução', Q, 'Células galvânicas', 'O'),
    (Q, 'Células galvânicas', Q, 'Eletrólise', 'R'),
    (Q, 'Células galvânicas', Q, 'Corrosão', 'R'),
    (Q, 'Funções orgânicas', Q, 'Nomenclatura IUPAC', 'O'),
    (Q, 'Hibridização', Q, 'Propriedades dos compostos orgânicos', 'R'),
    (Q, 'Funções orgânicas', Q, 'Propriedades dos compostos orgânicos', 'O'),
    (Q, 'Cálculo estequiométrico', Q, 'Titulometria ácido-base', 'O'),
    (Q, 'Preparo, padronização', Q, 'Titulometria ácido-base', 'O'),
    (Q, 'Titulometria ácido-base', Q, 'Titulometria de precipitação', 'R'),
    (Q, 'Oxirredução', Q, 'Titulometria de precipitação', 'R'),
    (Q, 'Cálculo estequiométrico', Q, 'Gravimetria', 'R'),
    (Q, 'Curvas de calibração', Q, 'Espectroscopia de absorção molecular', 'R'),
    (Q, 'pH e pOH', Q, 'Potenciometria', 'R'),
    (Q, 'Filtração e decantação', Q, 'Destilação', 'R'),
    (Q, 'Algarismos significativos', Q, 'Média, desvio-padrão', 'R'),
    (Q, 'Boas práticas', Q, 'Incompatibilidade entre substâncias', 'R'),
    (Q, 'Manuseio, armazenamento', Q, 'Plano de gerenciamento', 'O'),
    ('ifglp', 'Morfologia', 'ifglp', 'Funções do', 'R'),
    ('ifglp', 'Sintaxe', 'ifglp', 'Concordância', 'R'),
    ('ifglp', 'Sintaxe', 'ifglp', 'Regência', 'R'),
    ('ifglp', 'Regência', 'ifglp', 'Uso da crase', 'R'),
    ('ifglp', 'Sintaxe', 'ifglp', 'Emprego dos sinais de pontuação', 'R'),
]
deps = []
for dd, de_ini, pd_, para_ini, tp in DEPS:
    de, para = t(dd, de_ini), t(pd_, para_ini)
    assert de != para
    deps.append({'id': f'di-{de[1:]}-{para[1:]}', 'de': de, 'para': para, 'tipo': 'obrigatorio' if tp == 'O' else 'recomendado', 'origem': 'sugestao'})
assert len({d['id'] for d in deps}) == len(deps), 'dependência repetida'

# ----------------------------------------------------------------------------------------------
# 4. Fatos oficiais do cargo (cada um com o item e a página do edital)
fatos = [
    {'id': 'ifg-data', 'rotulo': 'Data prevista da prova objetiva', 'valor': '14/02/2027. Duração de 4 horas, incluído o preenchimento da folha de respostas.', 'ref': 'Anexo I – Cronograma Previsto; item 12.20', 'pagina': 22},
    {'id': 'ifg-vagas', 'rotulo': 'Vaga do cargo 308', 'valor': '1 vaga de ampla concorrência em Anápolis/GO, 40 horas semanais. Remuneração de R$ 3.181,39.', 'ref': 'Item 2 (quadro de vagas do nível médio/técnico)', 'pagina': 3},
    {'id': 'ifg-requisito', 'rotulo': 'Escolaridade exigida', 'valor': 'Médio profissionalizante ou médio completo mais curso técnico na área.', 'ref': 'Item 2 (quadro de vagas do nível médio/técnico)', 'pagina': 3},
    {'id': 'ifg-prova', 'rotulo': 'Prova objetiva', 'valor': '50 questões de 5 alternativas. Língua Portuguesa: 10 questões, peso 2. Legislação: 10, peso 1. Raciocínio Lógico e Matemática: 5, peso 1. Informática: 5, peso 1. Conhecimentos Específicos: 20, peso 3. Total de 100 pontos.', 'ref': 'Tabela 11.1 e item 11.3', 'pagina': 14},
    {'id': 'ifg-minimos', 'rotulo': 'Pontuação mínima por disciplina', 'valor': 'Língua Portuguesa 12; Legislação 5; Raciocínio Lógico e Matemática 2; Informática 2; Conhecimentos Específicos 39 (13 acertos).', 'ref': 'Tabela 11.1', 'pagina': 14},
    {'id': 'ifg-corte', 'rotulo': 'Para não ser eliminado', 'valor': '60 pontos ou mais na prova objetiva e a pontuação mínima em cada disciplina.', 'ref': 'Item 11.4', 'pagina': 15},
    {'id': 'ifg-desempate', 'rotulo': 'Desempate', 'valor': 'Depois da idade (60 anos ou mais), vence quem tiver mais pontos em Conhecimentos Específicos e, em seguida, em Língua Portuguesa.', 'ref': 'Item 14.3', 'pagina': 16},
    {'id': 'ifg-aprovados', 'rotulo': 'Máximo de aprovados', 'valor': 'Com 1 vaga no cargo/câmpus, no máximo 5 aprovados por lista.', 'ref': 'Item 14.6.2', 'pagina': 17},
]

# ----------------------------------------------------------------------------------------------
# 5. Padrões do cargo (ciclo inicial, metas, data da prova). Tudo editável pelo usuário.
# Química vale 60 dos 100 pontos: fica com mais da metade do tempo de cada volta (16 h).
CICLO = [
    ('ifgqui', 90), ('ifglp', 90), ('ifgqui', 90), ('ifgleg', 60), ('ifgqui', 90), ('ifgrlm', 60),
    ('ifgqui', 90), ('ifglp', 90), ('ifgqui', 90), ('ifginf', 60), ('ifgqui', 90), ('ifgleg', 60),
]
cargo = {
    'id': 'IFG308', 'codigo': '308', 'concursoId': 'ifg-2026',
    'nome': 'Técnico de Laboratório/Área Química',
    'nomeCurto': 'Cargo 308 · Técnico de Laboratório/Química',
    'escolaridade': 'Médio profissionalizante ou médio completo mais curso técnico na área',
    'dataProva': '2027-02-14',
    'metaDiariaMin': 240, 'metaSemanalMin': 1440, 'duracaoPadraoMin': 90,
    'cicloInicial': [[d, m] for d, m in CICLO],
}
nucleos = [
    {'id': 'CG', 'nome': 'Conhecimentos Gerais', 'apelido': 'Núcleo comum',
     'descricao': 'Conhecimentos comuns a todos os cargos de nível médio e superior (Anexo III): Língua Portuguesa (10 questões, peso 2), Legislação (10, peso 1), Raciocínio Lógico e Matemática (5, peso 1) e Informática (5, peso 1). Tabela 11.1.', 'pagina': P_GERAIS},
    {'id': 'CE', 'nome': 'Conhecimentos Específicos', 'apelido': 'Núcleo específico',
     'descricao': 'Conhecimentos específicos do cargo Técnico de Laboratório/Área Química (Anexo III): 20 questões, peso 3, mínimo de 39 pontos. Tabela 11.1.', 'pagina': P_QUIMICA},
]
seed = {
    'seedVersion': SEED_VERSION,
    'cargo': cargo,
    'fonte': {'edital': 'Edital de Abertura nº 001/2026 – Concurso Público IFG (Instituto AOCP)',
              'planilha': 'Edital verticalizado IFG 2026 – Técnico de Laboratório/Química (código 308), com prioridades das provas IFPB 2025 e IFCE 2026'},
    'nucleos': nucleos, 'disciplinas': disciplinas, 'topicos': topicos, 'dependenciasSugeridas': deps, 'fatos': fatos,
}
with open(saida, 'w', encoding='utf8') as f:
    json.dump(seed, f, ensure_ascii=False, indent=1)
    f.write('\n')

print(len(disciplinas), 'disciplinas', len(topicos), 'conteúdos', len(deps), 'dependências', 'ciclo (min/volta):', sum(m for _, m in CICLO))
print(Counter(x['prioridadePlanilha'] for x in topicos))
for d in disciplinas:
    c = Counter(x['prioridadePlanilha'] for x in topicos if x['disciplinaId'] == d['id'])
    print(f"  {d['nomeCurto']:32s} {sum(c.values()):3d}  U{c['Urgente']} A{c['Alta']} M{c['Média']} B{c['Baixa']}")
