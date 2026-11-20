"""Sugere pares de conteúdos equivalentes entre editais diferentes, para revisão.

Uso: python scripts/equivalencias/sugerir.py fontes/equivalencias/pares-sugeridos.xlsx

Compara os conteúdos de cada par de editais (B02, A01 e IFG308) dentro das mesmas áreas (Português,
Matemática e Raciocínio Lógico, Legislação e Direito, Informática e Segurança). A semelhança é a de
cosseno entre os radicais das palavras do título, ponderados pela raridade, com um reforço quando os
dois citam o mesmo número de lei. Para cada conteúdo, entram os candidatos mais parecidos acima do corte.

A planilha gerada tem a coluna Decisão: "aceito" já vem marcado nos pares de força alta; o resto fica
em branco. Só os pares marcados "aceito" valem (scripts/equivalencias/aplicar.py).
Se a planilha já existir, as decisões já tomadas (Decisão e Observação) são mantidas.
"""
import json, math, os, re, sys, unicodedata
from itertools import combinations

import openpyxl
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.worksheet.datavalidation import DataValidation

saida = sys.argv[1]
RAIZ = os.path.join(os.path.dirname(__file__), '..', '..')
EDITAIS = [('B02', 'src/data/seed.json'), ('A01', 'src/data/seed-a01.json'), ('IFG308', 'src/data/seed-ifg308.json')]
SIGLA = {'tce-go-2026': 'TCE-GO', 'ifg-2026': 'IFG'}
AREAS = {
    'Língua Portuguesa': {'lp', 'a01lp', 'ifglp'},
    'Matemática e Raciocínio Lógico': {'mat', 'a01mat', 'ifgrlm'},
    'Legislação e Direito': {'leginst', 'legti', 'a01leginst', 'a01da', 'a01lic', 'a01dc', 'ifgleg'},
    'Informática e Segurança': {'seg', 'ifginf'},
}
CORTE, ALTA, MAX_CANDIDATOS = 0.30, 0.60, 3

seeds = {}
for cargo, arq in EDITAIS:
    seeds[cargo] = json.load(open(os.path.join(RAIZ, arq), encoding='utf8'))


def area_de(disc):
    return next((a for a, ds in AREAS.items() if disc in ds), None)


def norm(s):
    s = unicodedata.normalize('NFD', s.lower())
    return ''.join(c for c in s if unicodedata.category(c) != 'Mn')


STOP = set('de da do das dos e a o as os em no na nos nas para por com sem ao aos que se um uma sua seu suas seus inclui '
           'com foco enfase lei leis federal estadual n no nº conceitos fundamentos basica basicos principais uso emprego '
           'nocoes noções aplicacao aplicada problemas tipos caracteristicas caracteristica'.split())


def radicais(s):
    return [w[:6] for w in re.findall(r'[a-z0-9]+', norm(s)) if w not in STOP and len(w) > 1 and not w.isdigit()]


def leis(s):
    # Números de leis no formato 8.112, 12.527, 14.133 (com o ponto: assim um ano como 2008 não conta)
    r = set(re.findall(r'(?<![\d/])\d{1,2}\.\d{3}(?!\d)', s))
    # Leis citadas pelo nome em vez do número
    if 'lgpd' in norm(s):
        r.add('13.709')
    return r


conteudos = []  # (cargo, topico, disciplina, area)
for cargo, s in seeds.items():
    disc = {d['id']: d for d in s['disciplinas']}
    for t in s['topicos']:
        a = area_de(t['disciplinaId'])
        if a:
            conteudos.append((cargo, t, disc[t['disciplinaId']], a))

docs = [radicais(t['titulo']) for _, t, _, _ in conteudos]
df = {}
for d in docs:
    for w in set(d):
        df[w] = df.get(w, 0) + 1
N = len(docs)
idf = {w: math.log(1 + N / n) for w, n in df.items()}


def vetor(toks):
    v = {}
    for w in toks:
        v[w] = v.get(w, 0) + idf[w]
    n = math.sqrt(sum(x * x for x in v.values())) or 1
    return {w: x / n for w, x in v.items()}


vetores = [vetor(d) for d in docs]

# Quantos conteúdos de cada edital citam cada lei: quando os dois editais dividem a mesma lei em várias
# partes, o número da lei sozinho não diz qual parte corresponde a qual.
citacoes = {}
for cargo, t, _, _ in conteudos:
    for lei in leis(t['titulo']):
        citacoes[(cargo, lei)] = citacoes.get((cargo, lei), 0) + 1


def semelhanca(i, j):
    a, b = vetores[i], vetores[j]
    sc = sum(x * b.get(w, 0) for w, x in a.items())
    # Título curto contido no outro ("Uso da crase" e "Emprego do sinal indicativo de crase").
    pa, pb = set(docs[i]), set(docs[j])
    menor, maior = (pa, pb) if len(pa) <= len(pb) else (pb, pa)
    if menor:
        contido = sum(idf[w] for w in menor if w in maior) / sum(idf[w] for w in menor)
        sc = max(sc, 0.85 * contido)
    ci, cj = conteudos[i][0], conteudos[j][0]
    for lei in leis(conteudos[i][1]['titulo']) & leis(conteudos[j][1]['titulo']):
        if citacoes[(ci, lei)] == 1 or citacoes[(cj, lei)] == 1:
            sc = max(sc, 0.75)
    return sc


pares = {}
for ca, cb in combinations([c for c, _ in EDITAIS], 2):
    ia = [i for i, c in enumerate(conteudos) if c[0] == ca]
    ib = [j for j, c in enumerate(conteudos) if c[0] == cb]
    for lado, outro in ((ia, ib), (ib, ia)):
        for i in lado:
            cand = sorted(((semelhanca(i, j), j) for j in outro if conteudos[j][3] == conteudos[i][3]), reverse=True)
            # Com um par de texto praticamente igual (mesmo edital de origem), os outros candidatos são ruído.
            if cand and cand[0][0] >= 0.95:
                cand = cand[:1]
            for sc, j in cand[:MAX_CANDIDATOS]:
                if sc < CORTE:
                    continue
                a, b = sorted((i, j), key=lambda k: [c for c, _ in EDITAIS].index(conteudos[k][0]))
                chave = (conteudos[a][1]['id'], conteudos[b][1]['id'])
                pares[chave] = max(pares.get(chave, (0, a, b))[0], sc), a, b

# Decisões já tomadas numa planilha anterior
decisoes = {}
leia_antigo = []
if os.path.exists(saida):
    wb0 = openpyxl.load_workbook(saida)
    ws0 = wb0['Pares']
    if 'Leia-me' in wb0.sheetnames:
        leia_antigo = [r[0] for r in wb0['Leia-me'].iter_rows(values_only=True)]
    cab = [c.value for c in ws0[1]]
    for r in ws0.iter_rows(min_row=2, values_only=True):
        d = dict(zip(cab, r))
        if d.get('ID A') and d.get('ID B'):
            decisoes[(d['ID A'], d['ID B'])] = (d.get('Decisão'), d.get('Observação'))


def rotulo(cargo):
    s = seeds[cargo]
    return f"{SIGLA[s['cargo']['concursoId']]} {s['cargo']['codigo']}"


linhas = []
for (ida, idb), (sc, a, b) in pares.items():
    ca, ta, da, area = conteudos[a]
    cb, tb, db, _ = conteudos[b]
    forca = 'alta' if sc >= ALTA else 'média' if sc >= 0.45 else 'baixa'
    dec, obs = decisoes.get((ida, idb), ('aceito' if forca == 'alta' else None, None))
    linhas.append([area, rotulo(ca), da['nomeCurto'], ta['numero'], ta['titulo'], rotulo(cb), db['nomeCurto'], tb['numero'], tb['titulo'],
                   round(sc * 100), forca, dec, obs, ida, idb])
ordem_ed = {rotulo(c): i for i, (c, _) in enumerate(EDITAIS)}
linhas.sort(key=lambda l: (ordem_ed[l[1]], ordem_ed[l[5]], list(AREAS).index(l[0]), l[3], -l[9]))

wb = openpyxl.Workbook()
ws = wb.active
ws.title = 'Pares'
CAB = ['Área', 'Edital A', 'Disciplina A', 'Nº A', 'Conteúdo A', 'Edital B', 'Disciplina B', 'Nº B', 'Conteúdo B',
       'Semelhança', 'Força', 'Decisão', 'Observação', 'ID A', 'ID B']
ws.append(CAB)
for l in linhas:
    ws.append(l)
negrito = Font(bold=True)
for c in ws[1]:
    c.font = negrito
    c.fill = PatternFill('solid', fgColor='DCE6F7')
larguras = [22, 10, 22, 6, 48, 10, 22, 6, 48, 11, 8, 11, 30, 9, 9]
for i, w in enumerate(larguras):
    ws.column_dimensions[openpyxl.utils.get_column_letter(i + 1)].width = w
for row in ws.iter_rows(min_row=2):
    for c in (row[4], row[8], row[12]):
        c.alignment = Alignment(wrap_text=True, vertical='top')
amarelo = PatternFill('solid', fgColor='FFF4CC')
for row in ws.iter_rows(min_row=2, min_col=12, max_col=12):
    row[0].fill = amarelo
dv = DataValidation(type='list', formula1='"aceito,recusado"', allow_blank=True)
ws.add_data_validation(dv)
dv.add(f'L2:L{len(linhas) + 1}')
ws.freeze_panes = 'A2'
ws.auto_filter.ref = f'A1:O{len(linhas) + 1}'

leia = wb.create_sheet('Leia-me')
LEIA = [
    'Pares de conteúdos equivalentes entre editais',
    '',
    'Cada linha é um par de conteúdos de editais diferentes que parecem tratar do mesmo assunto.',
    'Quando uma conta estuda os dois editais, o progresso de um conteúdo (situação, dominado, datas, revisões e anotações)',
    'passa para o equivalente no outro edital. A prioridade continua sendo de cada edital.',
    '',
    'Como revisar: na coluna Decisão (amarela), marque "aceito" nos pares que são o mesmo assunto e "recusado" nos que não são.',
    'Os pares de força alta já vêm marcados como "aceito"; confira e troque se discordar. Linha em branco vale como não aceita.',
    'O progresso é copiado nos dois sentidos: aceite só quando estudar um conteúdo cobre o outro por inteiro. Se um lado for bem mais amplo, recuse.',
    'Não altere as colunas ID A e ID B: são elas que ligam o par aos conteúdos da plataforma.',
    '',
    'Semelhança: 0 a 100, pelas palavras do título (e pelo número da lei, quando os dois citam a mesma).',
    'Força: alta (60 ou mais), média (45 a 59), baixa (30 a 44). Pares abaixo de 30 não aparecem.',
    'Só são comparadas as áreas em que os editais se encontram: Português, Matemática e Raciocínio Lógico,',
    'Legislação e Direito, Informática e Segurança. Química e os conhecimentos de TI e de administração do TCE-GO ficam de fora.',
    '',
    'Depois de revisar, rode: python scripts/equivalencias/aplicar.py fontes/equivalencias/pares-sugeridos.xlsx src/data/equivalencias.json',
]
# Linhas acrescentadas depois do texto padrão (notas de revisão) são mantidas.
for t in LEIA + leia_antigo[len(LEIA):]:
    leia.append([t])
leia['A1'].font = Font(bold=True, size=13)
leia.column_dimensions['A'].width = 120

os.makedirs(os.path.dirname(saida) or '.', exist_ok=True)
wb.save(saida)

from collections import Counter
print(len(linhas), 'pares;', dict(Counter(l[11] or 'em branco' for l in linhas)))
for k, v in sorted(Counter((l[1], l[5], l[0], l[10]) for l in linhas).items()):
    print(' ', k, v)
