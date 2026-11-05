"""Gera src/data/seed-a01.json: edital verticalizado do cargo A01 (Técnico Administrativo).

Uso: python scripts/a01/seed_a01.py public/edital.pdf fontes/a01/analise-fcc.json src/data/seed-a01.json

Entradas
  - edital.pdf: Edital 01/2026 (texto oficial do Anexo II, páginas 19 e 20)
  - analise-fcc.json: contagem de questões por tópico (scripts/a01/analise_fcc.py)
Saídas
  - o seed no mesmo formato do seed.json do B02, com o bloco "cargo" (padrões do cargo)
"""
import json, math, os, re, subprocess, sys, unicodedata

sys.path.insert(0, os.path.dirname(__file__))
from taxonomia import DISCIPLINAS, T, NOVO

PDFTOTEXT = os.environ.get('PDFTOTEXT', 'pdftotext')
pdf, analise_json, saida = sys.argv[1], sys.argv[2], sys.argv[3]
analise = json.load(open(analise_json, encoding='utf8'))
N_PROVAS = len(analise['provas'])

# ----------------------------------------------------------------------------------------------
# 1. Texto oficial do Anexo II por disciplina
CABECALHOS = {
    'a01lp': 'Língua Portuguesa', 'a01mat': 'Matemática e Raciocínio Lógico', 'a01leginst': 'Legislação Institucional',
    'a01da': 'Noções de Direito Administrativo', 'a01lic': 'Licitações e Contratos Administrativos',
    'a01dc': 'Noções de Direito Constitucional', 'a01ce': 'Noções de Controle Externo',
    'a01afo': 'Noções de Administração Financeira e Orçamentária', 'a01cont': 'Contabilidade aplicada ao Setor Público',
    'a01ap': 'Noções de Administração Pública', 'a01ag': 'Administração Geral', 'a01ae': 'Administração Estratégica',
    'a01co': 'Comportamento Organizacional', 'a01gp': 'Gestão de Pessoas',
}
linhas = []
for p in (19, 20):
    t = subprocess.run([PDFTOTEXT, '-f', str(p), '-l', str(p), '-enc', 'UTF-8', pdf, '-'], capture_output=True, text=True, encoding='utf8').stdout
    for ln in t.split('\n'):
        linhas.append((p, unicodedata.normalize('NFC', ln.strip())))
ini_ce = next(i for i, (_, l) in enumerate(linhas) if 'CONHECIMENTOS ESPECÍFICOS PARA O CARGO A01' in l)
fim_ce = next(i for i, (_, l) in enumerate(linhas) if 'CONHECIMENTOS ESPECÍFICOS PARA O CARGO B02' in l)
ini_cg = next(i for i, (_, l) in enumerate(linhas) if 'CONHECIMENTOS GERAIS PARA OS CARGOS A01' in l)

def secao(nome, a, b):
    # O título da disciplina pode vir sozinho na linha ou seguido do início do texto.
    idx = next(i for i in range(a, b) if linhas[i][1] == nome or linhas[i][1].startswith(nome + ' '))
    titulos = list(CABECALHOS.values())
    def eh_titulo(l): return any(l == t or l.startswith(t + ' ') for t in titulos)
    resto = [i for i in range(idx + 1, b) if eh_titulo(linhas[i][1])]
    fim = resto[0] if resto else b
    seg = [(linhas[idx][0], linhas[idx][1][len(nome):].strip())] + [linhas[j] for j in range(idx + 1, fim)]
    txt = ' '.join(l for p, l in seg if l and not re.fullmatch(r'\d{1,2}', l) and not l.startswith('CONHECIMENTOS') and 'ADMINISTRATIVO E B02' not in l and l != 'ADMINISTRATIVO' and not l.startswith('TECNOLOGIA DA INFORMA'))
    paginas = sorted({p for p, l in seg if l})
    return re.sub(r'\s+', ' ', txt).strip(), paginas

textos = {}
for d, nome in CABECALHOS.items():
    a, b = (ini_cg, ini_ce) if d in ('a01lp', 'a01mat', 'a01leginst') else (ini_ce, fim_ce)
    textos[d] = secao(nome, a, b)
    assert len(textos[d][0]) > 150, d

# ----------------------------------------------------------------------------------------------
# 2. Correspondência entre cada tópico e o trecho literal do edital (mesmo método do B02)
def norm(s):
    s = unicodedata.normalize('NFD', s.lower())
    return ''.join(c for c in s if unicodedata.category(c) != 'Mn')
def palavras(s): return re.findall(r'[a-z0-9]+', norm(s))
STOP = set('de da do das dos e a o as os em no na nos nas para por com sem ao aos que se um uma sua seu suas seus conceitos fundamentos basica basicos principais'.split())
def stem(w): return w[:6]
def toks(s): return {stem(w) for w in palavras(s) if w not in STOP and len(w) > 1}
def segmentos(txt): return [p.strip() for p in re.split(r'(?<=[.;])\s+', txt) if len(p.strip()) > 3]

def trecho(titulo, texto):
    segs = segmentos(texto); segt = [toks(s) for s in segs]
    vocab = set().union(*segt)
    idf = {w: math.log(1 + len(segs) / sum(1 for st in segt if w in st)) for w in vocab}
    tt = toks(titulo) & vocab
    tot = sum(idf[w] for w in tt) or 1
    best, bs = None, 0.0
    head = [stem(w) for w in palavras(titulo) if w not in STOP and len(w) > 2][:1]
    for s, st in zip(segs, segt):
        sc = sum(idf[w] for w in tt & st) / tot
        if head and head[0] in st: sc += 0.25
        if sc > bs: best, bs = s, sc
    if not tt: bs = 0.0
    return best, ('alta' if bs >= 0.6 else 'media' if bs >= 0.34 else 'baixa')

# ----------------------------------------------------------------------------------------------
# 3. Prioridade e incidência (evidência das provas + decisões fundamentadas para itens novos)
ORDEM = ['Baixa', 'Média', 'Alta', 'Urgente']
def por_evidencia(h, e):
    if h >= 12 and e >= 6: return 'Urgente'
    if h >= 6 or e >= 4: return 'Alta'
    if h >= 2: return 'Média'
    return 'Baixa'

FAMILIAS = ['TCE-GO 2009', 'TCE-GO 2014', 'TCE-CE 2015', 'TCE-SP 2012', 'TCE-PR 2011']
def resumo_por(por):
    fam = {}
    for rot, n in por.items():
        f = next(f for f in FAMILIAS if rot.startswith(f))
        fam[f] = fam.get(f, 0) + n
    return '; '.join(f'{f}: {n}' for f, n in sorted(fam.items(), key=lambda x: -x[1]))

def classificar(titulo, disc):
    ev = analise['topicos'][disc][titulo]
    h, e = ev['h'], len(ev['por'])
    base = por_evidencia(h, e)
    novo = NOVO.get(titulo)
    if h:
        txt = f'{h} questão(ões) em {e} das {N_PROVAS} provas FCC analisadas ({resumo_por(ev["por"])})'
    else:
        txt = f'Sem questão identificada nas {N_PROVAS} provas FCC analisadas'
    if novo:
        prio, motivo = novo
        final = prio if ORDEM.index(prio) >= ORDEM.index(base) or not h else base
        txt += f'. {motivo}'
        if final != prio: txt += ' (a prioridade foi mantida no nível indicado pelo histórico)'
    else:
        final = base
        if not h: txt += '; item nominal do edital 2026, mantido por constar do programa oficial'
    return final, txt

# ----------------------------------------------------------------------------------------------
# 4. Montagem das disciplinas e dos tópicos
DOC = 'Edital nº 01/2026 – Abertura de Inscrições'
ANEXO = 'Anexo II – Conteúdo Programático'
disciplinas, topicos, ids = [], [], {}
n = 0
for i, (did, nome, curto, nuc) in enumerate(DISCIPLINAS):
    txt, pags = textos[did]
    disciplinas.append({'id': did, 'nome': nome, 'nomeCurto': curto, 'nucleo': nuc, 'ordemEdital': i + 1, 'paginas': pags, 'textoOficial': txt})
    for titulo, _kw in T[did]:
        n += 1
        tid = 'a%03d' % n
        ids[(did, titulo)] = tid
        prio, inc = classificar(titulo, did)
        tr, conf = trecho(titulo, txt)
        topicos.append({
            'id': tid, 'numero': n, 'disciplinaId': did, 'titulo': titulo, 'desdobramentoPlanilha': False,
            'ref': {'documento': DOC, 'anexo': ANEXO,
                    'secao': 'Conhecimentos Gerais para os cargos A01 e B02' if nuc == 'CG' else 'Conhecimentos Específicos para o cargo A01',
                    'disciplina': nome, 'paginas': pags, 'trecho': tr if conf != 'baixa' else None, 'confianca': conf},
            'prioridadePlanilha': prio, 'incidencia': inc, 'statusPlanilha': 'Não estudado'})

def tid(did, k): return ids[(did, T[did][k - 1][0])]

# ----------------------------------------------------------------------------------------------
# 5. Pré-requisitos sugeridos: (disciplina, nº do tópico na disciplina) <- ... ; 'O' obrigatório, 'R' recomendado
DEPS = [
    # (para_disc, para_k, de_disc, de_k, tipo)
    # Português e Matemática
    ('a01lp', 3, 'a01lp', 19, 'R'), ('a01lp', 21, 'a01lp', 20, 'R'), ('a01lp', 22, 'a01lp', 20, 'R'), ('a01lp', 15, 'a01lp', 10, 'R'),
    ('a01mat', 5, 'a01mat', 4, 'R'), ('a01mat', 6, 'a01mat', 3, 'R'), ('a01mat', 3, 'a01mat', 1, 'R'), ('a01mat', 8, 'a01mat', 7, 'R'), ('a01mat', 12, 'a01mat', 11, 'R'),
    # Legislação institucional
    ('a01leginst', 3, 'a01leginst', 2, 'R'), ('a01leginst', 5, 'a01leginst', 4, 'O'), ('a01leginst', 6, 'a01leginst', 5, 'O'), ('a01leginst', 7, 'a01leginst', 5, 'R'),
    ('a01leginst', 9, 'a01leginst', 8, 'O'), ('a01leginst', 12, 'a01leginst', 11, 'R'), ('a01leginst', 13, 'a01leginst', 11, 'R'),
    # Direito Administrativo
    ('a01da', 3, 'a01da', 2, 'R'), ('a01da', 5, 'a01da', 2, 'R'), ('a01da', 6, 'a01da', 5, 'O'), ('a01da', 7, 'a01da', 6, 'R'),
    ('a01da', 9, 'a01da', 8, 'O'), ('a01da', 10, 'a01da', 8, 'R'), ('a01da', 11, 'a01da', 9, 'O'), ('a01da', 14, 'a01da', 12, 'R'),
    ('a01da', 18, 'a01da', 15, 'R'), ('a01da', 19, 'a01da', 2, 'R'), ('a01da', 13, 'a01da', 2, 'R'),
    # Licitações
    ('a01lic', 2, 'a01lic', 1, 'O'), ('a01lic', 3, 'a01lic', 1, 'R'), ('a01lic', 4, 'a01lic', 3, 'O'), ('a01lic', 5, 'a01lic', 1, 'R'),
    ('a01lic', 6, 'a01lic', 3, 'R'), ('a01lic', 7, 'a01lic', 4, 'O'), ('a01lic', 8, 'a01lic', 7, 'R'), ('a01lic', 9, 'a01lic', 7, 'O'),
    ('a01lic', 10, 'a01lic', 7, 'R'), ('a01lic', 11, 'a01lic', 1, 'R'), ('a01lic', 1, 'a01da', 2, 'R'),
    # Direito Constitucional
    ('a01dc', 2, 'a01dc', 1, 'R'), ('a01dc', 4, 'a01dc', 3, 'R'), ('a01dc', 5, 'a01dc', 3, 'R'), ('a01dc', 6, 'a01dc', 5, 'R'),
    ('a01dc', 7, 'a01dc', 2, 'O'), ('a01dc', 8, 'a01dc', 7, 'R'), ('a01dc', 9, 'a01dc', 7, 'R'), ('a01dc', 10, 'a01dc', 7, 'R'),
    ('a01dc', 11, 'a01dc', 10, 'O'), ('a01dc', 12, 'a01dc', 7, 'R'), ('a01dc', 13, 'a01dc', 12, 'R'),
    # Controle Externo
    ('a01ce', 2, 'a01ce', 1, 'O'), ('a01ce', 2, 'a01dc', 11, 'R'), ('a01ce', 3, 'a01ce', 1, 'O'), ('a01ce', 4, 'a01ce', 3, 'O'),
    ('a01ce', 5, 'a01ce', 4, 'R'), ('a01ce', 6, 'a01ce', 4, 'O'), ('a01ce', 7, 'a01ce', 6, 'O'), ('a01ce', 8, 'a01ce', 7, 'R'),
    ('a01ce', 9, 'a01ce', 8, 'O'), ('a01ce', 10, 'a01ce', 9, 'O'), ('a01ce', 11, 'a01ce', 2, 'R'),
    # Administração Financeira e Orçamentária
    ('a01afo', 2, 'a01afo', 1, 'R'), ('a01afo', 3, 'a01afo', 1, 'R'), ('a01afo', 4, 'a01afo', 2, 'O'), ('a01afo', 5, 'a01afo', 4, 'R'),
    ('a01afo', 6, 'a01afo', 4, 'R'), ('a01afo', 7, 'a01afo', 6, 'O'), ('a01afo', 8, 'a01afo', 5, 'R'), ('a01afo', 9, 'a01afo', 6, 'O'),
    ('a01afo', 10, 'a01afo', 4, 'O'), ('a01afo', 11, 'a01afo', 9, 'R'), ('a01afo', 12, 'a01afo', 6, 'R'), ('a01afo', 13, 'a01afo', 6, 'R'),
    ('a01afo', 14, 'a01afo', 13, 'R'), ('a01afo', 15, 'a01afo', 6, 'O'), ('a01afo', 16, 'a01afo', 4, 'R'), ('a01afo', 17, 'a01afo', 5, 'R'),
    # Contabilidade
    ('a01cont', 2, 'a01cont', 1, 'O'), ('a01cont', 3, 'a01cont', 1, 'R'), ('a01cont', 4, 'a01cont', 1, 'O'), ('a01cont', 5, 'a01cont', 1, 'O'),
    ('a01cont', 6, 'a01cont', 5, 'R'), ('a01cont', 7, 'a01cont', 4, 'R'), ('a01cont', 8, 'a01cont', 7, 'O'), ('a01cont', 9, 'a01cont', 8, 'O'),
    ('a01cont', 10, 'a01afo', 16, 'R'), ('a01cont', 11, 'a01cont', 9, 'R'), ('a01cont', 8, 'a01afo', 5, 'R'),
    # Administração Pública, Geral, Estratégica, Comportamento e Gestão de Pessoas
    ('a01ap', 1, 'a01ag', 4, 'R'), ('a01ap', 6, 'a01ae', 4, 'R'), ('a01ap', 7, 'a01ag', 10, 'R'), ('a01ap', 8, 'a01ap', 2, 'R'), ('a01ap', 9, 'a01ap', 8, 'R'),
    ('a01ag', 2, 'a01ag', 1, 'R'), ('a01ag', 3, 'a01ag', 1, 'R'), ('a01ag', 5, 'a01ag', 3, 'R'), ('a01ag', 6, 'a01ag', 1, 'R'), ('a01ag', 9, 'a01ag', 1, 'R'),
    ('a01ae', 2, 'a01ae', 1, 'O'), ('a01ae', 3, 'a01ae', 2, 'O'), ('a01ae', 4, 'a01ae', 2, 'O'), ('a01ae', 5, 'a01ae', 2, 'R'), ('a01ae', 6, 'a01ae', 2, 'R'),
    ('a01ae', 9, 'a01ae', 4, 'R'), ('a01ae', 10, 'a01ae', 5, 'R'), ('a01ae', 8, 'a01ae', 3, 'R'),
    ('a01co', 3, 'a01co', 1, 'R'), ('a01co', 4, 'a01co', 3, 'R'), ('a01co', 5, 'a01co', 4, 'R'), ('a01co', 6, 'a01co', 4, 'R'), ('a01co', 7, 'a01co', 5, 'R'), ('a01co', 10, 'a01co', 2, 'R'),
    ('a01gp', 3, 'a01gp', 2, 'R'), ('a01gp', 4, 'a01gp', 3, 'R'), ('a01gp', 5, 'a01gp', 4, 'R'), ('a01gp', 6, 'a01gp', 1, 'R'), ('a01gp', 8, 'a01gp', 4, 'R'),
    ('a01gp', 9, 'a01co', 10, 'R'), ('a01gp', 13, 'a01leginst', 11, 'R'),
]
deps = []
for pd_, pk, dd, dk, tp in DEPS:
    para, de = tid(pd_, pk), tid(dd, dk)
    deps.append({'id': f'da-{de[1:]}-{para[1:]}', 'de': de, 'para': para, 'tipo': 'obrigatorio' if tp == 'O' else 'recomendado', 'origem': 'sugestao'})
assert len({d['id'] for d in deps}) == len(deps), 'dependência repetida'

# ----------------------------------------------------------------------------------------------
# 6. Fatos oficiais do cargo (cada um com o item e a página do edital)
fatos = [
    {'id': 'a01-data', 'rotulo': 'Data prevista das provas objetivas e discursiva', 'valor': '17/01/2027', 'ref': 'Anexo III – Cronograma, item 12', 'pagina': 23},
    {'id': 'a01-vagas', 'rotulo': 'Vagas para A01', 'valor': '6 (nenhuma reservada a pessoas com deficiência; 1 reservada a candidatos negros)', 'ref': 'Capítulo 2, item 2.1 (quadro de vagas)', 'pagina': 1},
    {'id': 'a01-provas', 'rotulo': 'Provas objetivas do A01', 'valor': 'Conhecimentos Gerais: 25 questões, peso 1. Conhecimentos Específicos: 45 questões, peso 2. Duração total: 4h30.', 'ref': 'Capítulo 7, item 7.1', 'pagina': 8},
    {'id': 'a01-redacao', 'rotulo': 'Prova Discursiva – Redação', 'valor': 'Texto dissertativo-argumentativo de 20 a 30 linhas, de 0 a 100 pontos: Tema (até 70: recorte temático 20, interpretação crítica dos textos de apoio 20, progressão textual 30) e Coesão e norma-padrão (até 30: vocabulário 8, coesão 16, morfossintaxe 6).', 'ref': 'Capítulo 10, itens 10.3 a 10.6', 'pagina': 12},
    {'id': 'a01-redacao-corte', 'rotulo': 'Quem tem a redação corrigida', 'valor': 'Os habilitados nas objetivas até a 29ª posição (ampla concorrência) e a 7ª (candidatos negros); todos os habilitados com deficiência.', 'ref': 'Capítulo 10, item 10.2', 'pagina': 12},
    {'id': 'a01-corte', 'rotulo': 'Habilitação nas objetivas', 'valor': 'Soma das notas padronizadas das provas objetivas igual ou superior a 150.', 'ref': 'Capítulo 9, item 9.5', 'pagina': 12},
    {'id': 'a01-final', 'rotulo': 'Nota final do A01', 'valor': 'Soma das notas ponderadas das objetivas mais a nota da Redação.', 'ref': 'Capítulo 12, item 12.1', 'pagina': 14},
    {'id': 'a01-ndisc', 'rotulo': 'Questões por disciplina', 'valor': 'Não informado no edital. O edital define apenas o total de questões por bloco.', 'ref': 'Capítulo 7, item 7.1', 'pagina': 8},
]

# ----------------------------------------------------------------------------------------------
# 7. Padrões do cargo (ciclo inicial, metas, data da prova). Tudo editável pelo usuário.
CICLO = [
    ('a01da', 90), ('a01lp', 90), ('a01afo', 90), ('a01lic', 90), ('a01leginst', 90), ('a01ce', 90), ('a01cont', 90), ('a01mat', 90),
    ('a01dc', 60), ('a01ap', 60), ('a01gp', 60), ('a01ag', 60), ('a01co', 60), ('a01ae', 60),
    ('a01da', 90), ('a01afo', 90), ('a01lp', 90), ('a01lic', 60), ('a01ce', 60), ('a01cont', 60), ('a01leginst', 60), ('a01mat', 60), ('a01dc', 60),
]
cargo = {
    'id': 'A01', 'codigo': 'A01',
    'nome': 'Técnico de Controle Externo – Especialidade: Técnico Administrativo',
    'nomeCurto': 'Cargo A01 · Técnico Administrativo',
    'escolaridade': 'Ensino médio ou curso profissionalizante',
    'dataProva': '2027-01-17',
    'metaDiariaMin': 390, 'metaSemanalMin': 2370, 'duracaoPadraoMin': 90,
    'cicloInicial': [[d, m] for d, m in CICLO],
}
nucleos = [
    {'id': 'CG', 'nome': 'Conhecimentos Gerais', 'apelido': 'Núcleo comum',
     'descricao': 'Conhecimentos Gerais para os cargos A01 e B02 (Anexo II). Prova objetiva com 25 questões, peso 1 (item 7.1).', 'pagina': 19},
    {'id': 'CE', 'nome': 'Conhecimentos Específicos', 'apelido': 'Núcleo específico',
     'descricao': 'Conhecimentos Específicos para o cargo A01 (Anexo II). Prova objetiva com 45 questões, peso 2 (item 7.1).', 'pagina': 19},
]
seed = {
    'seedVersion': 1,
    'cargo': cargo,
    'fonte': {'edital': 'Edital nº 01/2026 – Abertura de Inscrições (TCE-GO, FCC)',
              'planilha': f'Edital verticalizado do A01 elaborado a partir do Anexo II e de {N_PROVAS} provas FCC (sem planilha prévia)'},
    'nucleos': nucleos, 'disciplinas': disciplinas, 'topicos': topicos, 'dependenciasSugeridas': deps, 'fatos': fatos,
}
json.dump(seed, open(saida, 'w', encoding='utf8'), ensure_ascii=False, indent=1)

from collections import Counter
print(len(disciplinas), 'disciplinas', len(topicos), 'tópicos', len(deps), 'dependências', 'ciclo (min/volta):', sum(m for _, m in CICLO))
print(Counter(t['prioridadePlanilha'] for t in topicos))
print(Counter(t['ref']['confianca'] for t in topicos))
for d in disciplinas:
    c = Counter(t['prioridadePlanilha'] for t in topicos if t['disciplinaId'] == d['id'])
    print(f"  {d['nomeCurto']:34s} {sum(c.values()):3d}  U{c['Urgente']} A{c['Alta']} M{c['Média']} B{c['Baixa']}  págs {d['paginas']}")
