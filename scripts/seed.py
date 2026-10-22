"""Gera src/data/seed.json a partir do edital (Anexo II extraído) e da planilha Edital Verticalizado v2.0."""
import json, re, sys, unicodedata, openpyxl
anexo = json.load(open(sys.argv[1]))
wb = openpyxl.load_workbook(sys.argv[2], data_only=True)
out = sys.argv[3]

DISC = [  # (id, nome oficial, nome na planilha, núcleo)
 ('lp','Língua Portuguesa','Lingua Portuguesa','CG'),
 ('mat','Matemática e Raciocínio Lógico','Matematica e Raciocinio Logico','CG'),
 ('leginst','Legislação Institucional','Legislacao Institucional','CG'),
 ('es','Engenharia de Software','Engenharia de Software','CE'),
 ('ds','Desenvolvimento de Sistemas','Desenvolvimento de Sistemas','CE'),
 ('esia','Engenharia de Software Assistida por Inteligência Artificial e Sistemas Agentivos','Eng. de Software Assistida por IA e Sistemas Agentivos','CE'),
 ('devops','DevOps, Plataforma de Desenvolvimento e Engenharia de Entrega','DevOps, Plataforma e Engenharia de Entrega','CE'),
 ('bd','Banco de Dados','Banco de Dados','CE'),
 ('ia','Inteligência Artificial, Ciência de Dados e Automação','IA, Ciencia de Dados e Automacao','CE'),
 ('seg','Segurança da Informação','Seguranca da Informacao','CE'),
 ('redes','Sistemas Operacionais, Redes e Computação em Nuvem','Sistemas Operacionais, Redes e Computacao em Nuvem','CE'),
 ('gov','Governança de Tecnologia da Informação','Governanca de Tecnologia da Informacao','CE'),
 ('legti','Legislação Aplicada à Tecnologia da Informação','Legislacao Aplicada a Tecnologia da Informacao','CE'),
 ('ing','Língua Inglesa (Leitura Técnica)','Lingua Inglesa (Leitura Tecnica)','CE'),
]
SHORT = {'esia':'Eng. de Software assistida por IA','devops':'DevOps','ia':'IA, Ciência de Dados e Automação','redes':'SO, Redes e Nuvem','gov':'Governança de TI','legti':'Legislação Aplicada à TI','ing':'Inglês Técnico','mat':'Matemática e RLM','leginst':'Legislação Institucional'}

def norm(s):
    s = unicodedata.normalize('NFD', s.lower())
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.findall(r'[a-z0-9]+', s)
STOP = set('de da do das dos e a o as os em no na nos nas para por com sem ao aos que se um uma sua seu suas seus interpretacao conceitos fundamentos basica basicos'.split())
def stem(w): return w[:6]
def toks(s): return {stem(w) for w in norm(s) if w not in STOP and len(w) > 1}

def segments(txt):
    parts = re.split(r'(?<=[.;])\s+', txt)
    return [p.strip() for p in parts if len(p.strip()) > 3]

MANUAL = {239: 'Lei Geral de Proteção de Dados'}  # sigla LGPD não aparece no texto oficial
disciplinas, topicos = [], []
pmap = {}
for i,(id_, nome, plan, nuc) in enumerate(DISC):
    a = anexo[nome]
    assert a['bloco'] == nuc, nome
    disciplinas.append({'id':id_,'nome':nome,'nomeCurto':SHORT.get(id_,nome),'nucleo':nuc,'ordemEdital':i+1,
        'paginas':a['paginas'],'textoOficial':a['texto']})
    pmap[plan] = (id_, a)

rows = [r for r in wb['Edital Verticalizado'].iter_rows(min_row=2, values_only=True) if r[0]]
low = 0
for r in rows:
    did, a = pmap[r[3]]
    titulo = r[4]
    interp = '[Interpretacao]' in titulo
    titulo_limpo = re.sub(r'\s*\[Interpretacao\]', '', titulo).strip()
    segs = segments(a['texto'])
    segt = [toks(s) for s in segs]
    vocab = set().union(*segt)
    import math
    idf = {w: math.log(1 + len(segs) / sum(1 for st in segt if w in st)) for w in vocab}
    tt = toks(titulo_limpo) & vocab   # termos do título que existem no texto oficial da disciplina
    best, bs = None, 0.0
    tot = sum(idf[w] for w in tt) or 1
    for s, st in zip(segs, segt):
        sc = sum(idf[w] for w in tt & st) / tot
        head = [stem(w) for w in norm(titulo_limpo) if w not in STOP and len(w) > 2][:1]
        if head and head[0] in st: sc += 0.25   # o termo principal do item pesa mais
        if sc > bs: best, bs = s, sc
    if not tt: bs = 0.0
    if int(r[0]) in MANUAL:
        best = next(x for x in segs if MANUAL[int(r[0])] in x); bs = 1.0
    conf = 'alta' if bs >= 0.6 else 'media' if bs >= 0.34 else 'baixa'
    if conf == 'baixa': low += 1
    topicos.append({'id':'t%03d' % int(r[0]), 'numero':int(r[0]), 'disciplinaId':did, 'titulo':titulo_limpo,
        'desdobramentoPlanilha':interp,
        'ref':{'documento':'Edital nº 01/2026 – Abertura de Inscrições','anexo':'Anexo II – Conteúdo Programático',
               'secao':('Conhecimentos Gerais para os cargos A01 e B02' if a['bloco']=='CG' else 'Conhecimentos Específicos para o cargo B02'),
               'disciplina':next(d['nome'] for d in disciplinas if d['id']==did),'paginas':a['paginas'],
               'trecho':best if conf!='baixa' else None,'confianca':conf},
        'prioridadePlanilha':r[6], 'incidencia':r[5], 'statusPlanilha':r[7] or 'Não estudado'})

DEPS = """53<52R 54<53R 55<54R 56<54R 57<54R 58<54R 60<59O 61<59R 62<59R 63<59R 72<71R 72<63R 65<64R 66<64O 67<64R 68<86O 70<86R 69<70R 74<86O 74<68R 75<74R 76<74R 79<78R 80<78R 81<78R 83<82R
85<84O 86<84O 87<84R 88<86R 89<88O 91<90O 92<90O 92<102R 104<90O 94<93O 95<98R 96<95R 97<95R 100<99O 101<99R 106<95O 103<102R
109<108R 111<109O 112<111R 113<109R 114<113R 115<114O 116<115O 117<116O 120<112R 121<109O 122<109R 123<122R 124<118R 119<78R
127<126O 140<127O 133<132R 134<132O 135<133R 137<136O 138<136O 129<128R 131<130R
142<141O 144<143O 145<143R 147<144R 148<143O 149<146R 150<146R 152<151R 153<151R 154<121R 155<146R
158<157O 159<157O 160<157R 161<158R 162<161R 163<161R 164<163R 165<163R 166<163O 171<170R 172<170R 169<239R
175<174R 176<175R 179<178O 181<180O 182<181O 184<183R 185<183R 186<136R 191<190R 192<176R 193<178R 195<194O 196<194R
201<198O 202<197R 204<203R 207<206O 208<206O 209<206R 210<206R 211<206R 212<206R 213<206R 214<206R 217<216O 218<216R 219<216R
223<222R 224<222R 227<226O 229<228R 230<228O 233<232R 242<234R 237<239R 238<239R 243<182R 241<240R
3<19R 21<20R 22<20R 27<26O 28<26R 30<29R 25<23R 37<36R 40<39O 41<39R 43<42O 46<45R 47<45R"""
deps = []
for tok in DEPS.split():
    m = re.fullmatch(r'(\d+)<(\d+)([OR])', tok)
    to, fr, k = m.groups()
    deps.append({'id':'d-%s-%s' % (fr,to), 'de':'t%03d' % int(fr), 'para':'t%03d' % int(to),
                 'tipo':'obrigatorio' if k=='O' else 'recomendado', 'origem':'sugestao'})

fatos = [
 {'id':'data','rotulo':'Data prevista das provas objetivas e discursiva','valor':'17/01/2027','ref':'Anexo III – Cronograma, item 12','pagina':23},
 {'id':'vagas','rotulo':'Vagas para B02','valor':'10 (1 para pessoas com deficiência, 2 para candidatos negros)','ref':'Capítulo 2, item 2.1 (quadro de vagas)','pagina':1},
 {'id':'provas','rotulo':'Provas objetivas do B02','valor':'Conhecimentos Gerais: 25 questões, peso 1. Conhecimentos Específicos: 45 questões, peso 2. Duração total: 4h30.','ref':'Capítulo 7, item 7.1','pagina':8},
 {'id':'discursiva','rotulo':'Prova Discursiva – Estudo de Caso','valor':'1 questão prática sobre os Conhecimentos Específicos, de 0 a 100 pontos; habilitado com nota igual ou superior a 50.','ref':'Capítulo 11, itens 11.4 a 11.9','pagina':13},
 {'id':'corte','rotulo':'Habilitação nas objetivas','valor':'Soma das notas padronizadas das provas objetivas igual ou superior a 150.','ref':'Capítulo 9, item 9.5','pagina':12},
 {'id':'final','rotulo':'Nota final do B02','valor':'Soma das notas ponderadas das objetivas mais a nota do Estudo de Caso.','ref':'Capítulo 12, item 12.2','pagina':14},
 {'id':'ndisc','rotulo':'Questões por disciplina','valor':'Não informado no edital. O edital define apenas o total de questões por bloco.','ref':'Capítulo 7, item 7.1','pagina':8},
]
nucleos = [
 {'id':'CG','nome':'Conhecimentos Gerais','apelido':'Núcleo comum','descricao':'Conhecimentos Gerais para os cargos A01 e B02 (Anexo II). Prova objetiva com 25 questões, peso 1 (item 7.1).','pagina':19},
 {'id':'CE','nome':'Conhecimentos Específicos','apelido':'Núcleo específico','descricao':'Conhecimentos Específicos para o cargo B02 (Anexo II). Prova objetiva com 45 questões, peso 2 (item 7.1).','pagina':20},
]
seed = {'seedVersion':1,'fonte':{'edital':'Edital nº 01/2026 – Abertura de Inscrições (TCE-GO, FCC)','planilha':'Edital Verticalizado TCE-GO 2026 – B02, versão 2.0 (planilha do usuário)'},
        'nucleos':nucleos,'disciplinas':disciplinas,'topicos':topicos,'dependenciasSugeridas':deps,'fatos':fatos}
json.dump(seed, open(out,'w'), ensure_ascii=False, indent=1)
print(len(disciplinas), len(topicos), len(deps), 'baixa confianca:', low)
from collections import Counter
print(Counter(t['ref']['confianca'] for t in topicos))
for t in topicos:
    if t['ref']['confianca']=='baixa': print(' ', t['numero'], t['titulo'])
