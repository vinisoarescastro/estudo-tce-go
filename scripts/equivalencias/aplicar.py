"""Gera src/data/equivalencias.json a partir da planilha revisada de pares.

Uso: python scripts/equivalencias/aplicar.py fontes/equivalencias/pares-sugeridos.xlsx src/data/equivalencias.json

Só entram as linhas com Decisão "aceito". Cada par liga um conteúdo de um edital a um conteúdo de outro
edital (ids das colunas ID A e ID B). O servidor grava a lista no banco ao iniciar (server/equivalencias.ts).
"""
import json, os, sys

import openpyxl

planilha, saida = sys.argv[1], sys.argv[2]
RAIZ = os.path.join(os.path.dirname(__file__), '..', '..')
EDITAIS = [('B02', 'src/data/seed.json'), ('A01', 'src/data/seed-a01.json'), ('IFG308', 'src/data/seed-ifg308.json')]

cargo_de = {}
for cargo, arq in EDITAIS:
    for t in json.load(open(os.path.join(RAIZ, arq), encoding='utf8'))['topicos']:
        cargo_de[t['id']] = cargo

ws = openpyxl.load_workbook(planilha, read_only=True)['Pares']
linhas = ws.iter_rows(values_only=True)
cab = list(next(linhas))
pares, recusados, em_branco, problemas = set(), 0, 0, []
for n, r in enumerate(linhas, start=2):
    d = dict(zip(cab, r))
    dec = (d.get('Decisão') or '').strip().lower()
    if dec == 'recusado':
        recusados += 1
        continue
    if dec != 'aceito':
        if dec:
            problemas.append(f'linha {n}: decisão desconhecida "{d.get("Decisão")}"')
        em_branco += 1
        continue
    a, b = d.get('ID A'), d.get('ID B')
    if a not in cargo_de or b not in cargo_de:
        problemas.append(f'linha {n}: id desconhecido ({a}, {b})')
        continue
    if cargo_de[a] == cargo_de[b]:
        problemas.append(f'linha {n}: os dois conteúdos são do mesmo edital ({cargo_de[a]})')
        continue
    pares.add(tuple(sorted((a, b))))

if problemas:
    sys.exit('Planilha com problemas:\n  ' + '\n  '.join(problemas))

lista = [{'a': a, 'b': b} for a, b in sorted(pares)]
with open(saida, 'w', encoding='utf8') as f:
    json.dump({'pares': lista}, f, ensure_ascii=False, indent=1)
    f.write('\n')
print(f'{len(lista)} pares aceitos gravados em {saida} ({recusados} recusados, {em_branco} em branco).')
