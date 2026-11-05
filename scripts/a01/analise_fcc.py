"""Conta, nas provas FCC já baixadas, as questões que tratam de cada tópico do edital do cargo A01.

Uso: python scripts/a01/analise_fcc.py <pasta_das_provas> <saida.json>

A pasta deve conter os PDFs listados em PROVAS (nome '<id>-<slug>-prova.pdf'). Os PDFs não são
versionados (direitos reservados da FCC); scripts/a01/PROVAS.md traz as fontes.
Método: o texto de cada questão é normalizado (sem acentos, minúsculo) e comparado com as expressões
de scripts/a01/taxonomia.py. Cada questão é atribuída à(s) disciplina(s) com mais tópicos casados e
conta uma ocorrência em cada tópico casado dentro dela. É uma contagem aproximada (heurística de
palavras-chave), boa para ordenar assuntos, não para afirmar números exatos de questões.
"""
import json, re, subprocess, sys, unicodedata, glob, os, hashlib
sys.path.insert(0, os.path.dirname(__file__))
from taxonomia import DISCIPLINAS, T

PDFTOTEXT = os.environ.get('PDFTOTEXT', 'pdftotext')

# id do arquivo -> (rótulo curto, órgão/cargo, tipo: 'tecnico-go' | 'analista-go' | 'outro-tce')
PROVAS = {
    '12263': ('TCE-GO 2009 Téc. Adm.', 'TCE-GO 2009 · Técnico de Controle Externo – Técnica Administrativa', 'tecnico-go'),
    '32364': ('TCE-GO 2014 Analista Adm.', 'TCE-GO 2014 · Analista de Controle Externo – Administrativa', 'analista-go'),
    '32369': ('TCE-GO 2014 Orç. e Finanças', 'TCE-GO 2014 · Analista de Controle Externo – Orçamento e Finanças', 'analista-go'),
    '32365': ('TCE-GO 2014 Contabilidade', 'TCE-GO 2014 · Analista de Controle Externo – Contabilidade', 'analista-go'),
    '32352': ('TCE-GO 2014 Gestão de Pessoas', 'TCE-GO 2014 · Analista de Controle Externo – Gestão de Pessoas', 'analista-go'),
    '32370': ('TCE-GO 2014 Planej. e DO', 'TCE-GO 2014 · Analista de Controle Externo – Planejamento e Desenvolvimento Organizacional', 'analista-go'),
    '34309': ('TCE-CE 2015 Téc. Administração', 'TCE-CE 2015 · Técnico de Controle Externo – Administração', 'outro-tce'),
    '21860': ('TCE-SP 2012 Agente Adm.', 'TCE-SP 2012 · Agente de Fiscalização Financeira – Administração', 'outro-tce'),
    '21497': ('TCE-PR 2011 Analista Adm.', 'TCE-PR 2011 · Analista de Controle – Administrativa', 'outro-tce'),
}

def norm(s):
    s = unicodedata.normalize('NFD', s.lower())
    return ''.join(c for c in s if unicodedata.category(c) != 'Mn')

def colunas(page):
    L = page.split('\n'); best = None; bs = 0
    for c in range(48, 95):
        s = sum(1 for l in L if len(l) > c + 8 and l[c-3:c+3].strip() == '' and l[:c-3].strip() and l[c+3:].strip())
        if s > bs: bs, best = s, c
    if not best or bs < 8: return page
    esq, dire = [], []
    for l in L:
        if len(l) > best and l[best-3:best+3].strip() == '': esq.append(l[:best-1]); dire.append(l[best-1:])
        else: esq.append(l)
    return '\n'.join(esq) + '\n' + '\n'.join(dire)

def questoes(pdf):
    t = subprocess.run([PDFTOTEXT, '-layout', '-enc', 'UTF-8', pdf, '-'], capture_output=True, text=True, encoding='utf8').stdout
    t = '\n'.join(colunas(p) for p in t.split('\f'))
    out, cur, esp = {}, None, 1
    for l in t.split('\n'):
        m = re.match(r'^\s{0,34}(\d{1,3})\s?\.\s+\S', l)
        if m and esp <= int(m.group(1)) <= esp + 2:
            cur = int(m.group(1)); out[cur] = [l.strip()]; esp = cur + 1; continue
        if cur: out[cur].append(l.strip())
    return {k: re.sub(r'\s+', ' ', ' '.join(v)) for k, v in out.items()}

def main(pasta, saida):
    rx = {d: [(titulo, re.compile(kw)) for titulo, kw in T[d]] for d, *_ in DISCIPLINAS}
    vistos = set()
    topicos = {d: {t: {'h': 0, 'por': {}} for t, _ in rx[d]} for d in rx}
    disc_q = {d: {} for d in rx}
    provas = {}
    sem_classe = {}
    for id_, (rot, desc, tipo) in PROVAS.items():
        arq = glob.glob(os.path.join(pasta, f'{id_}-*-prova.pdf'))
        if not arq: print('faltando', id_); continue
        qs = questoes(arq[0])
        n_dup = 0; n_ok = 0
        for num, txt in qs.items():
            chave = hashlib.md5(norm(txt)[:90].encode()).hexdigest()
            if chave in vistos: n_dup += 1; continue
            vistos.add(chave)
            n_ok += 1
            tn = norm(txt)
            casou = {d: [t for t, r in rx[d] if r.search(tn)] for d in rx}
            mx = max(len(v) for v in casou.values())
            if mx == 0: sem_classe[rot] = sem_classe.get(rot, 0) + 1; continue
            for d, ts in casou.items():
                if len(ts) == mx:
                    disc_q[d][rot] = disc_q[d].get(rot, 0) + 1
                    for t in ts:
                        topicos[d][t]['h'] += 1
                        topicos[d][t]['por'][rot] = topicos[d][t]['por'].get(rot, 0) + 1
        provas[rot] = {'descricao': desc, 'tipo': tipo, 'questoes_lidas': len(qs), 'repetidas_de_outra_prova': n_dup, 'sem_classificacao': sem_classe.get(rot, 0)}
        print(f'{rot}: {len(qs)} lidas, {n_dup} repetidas, {n_ok} novas')
    json.dump({'provas': provas, 'disciplinas': disc_q, 'topicos': topicos}, open(saida, 'w', encoding='utf8'), ensure_ascii=False, indent=1)

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
