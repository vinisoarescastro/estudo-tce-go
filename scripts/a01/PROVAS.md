# Provas FCC usadas na análise do cargo A01

Os PDFs não ficam no repositório (direitos reservados da FCC). Para refazer a análise, baixe os arquivos
`*-prova.pdf` abaixo numa pasta (por exemplo `fontes/provas-fcc/`, que o `.gitignore` já ignora) e rode:

```bash
python scripts/a01/analise_fcc.py fontes/provas-fcc fontes/a01/analise-fcc.json
python scripts/a01/seed_a01.py public/edital.pdf fontes/a01/analise-fcc.json src/data/seed-a01.json
```

Requer Python 3 e `pdftotext` (poppler-utils; use a variável `PDFTOTEXT` para indicar o caminho do executável).

| Id | Prova | Fonte (acesso aberto) |
|---|---|---|
| 12263 | TCE-GO 2009 · Técnico de Controle Externo – Técnica Administrativa (**mesmo cargo**) | https://www.estudegratis.com.br/provas/fcc-2009-tce-go-tecnico-de-controle-externo-area-administrativa |
| 32364 | TCE-GO 2014 · Analista de Controle Externo – Administrativa | https://www.estudegratis.com.br/provas/fcc-2014-tce-go-analista-de-controle-externo-administrativa |
| 32369 | TCE-GO 2014 · Analista – Orçamento e Finanças | https://www.estudegratis.com.br/provas/fcc-2014-tce-go-analista-de-controle-externo-orcamento-e-financas |
| 32365 | TCE-GO 2014 · Analista – Contabilidade | https://www.estudegratis.com.br/provas/fcc-2014-tce-go-analista-de-controle-externo-contabilidade |
| 32352 | TCE-GO 2014 · Analista – Gestão de Pessoas | https://www.estudegratis.com.br/provas/fcc-2014-tce-go-analista-de-controle-externo-gestao-de-pessoas |
| 32370 | TCE-GO 2014 · Analista – Planejamento e Desenvolvimento Organizacional | https://www.estudegratis.com.br/provas/fcc-2014-tce-go-analista-de-controle-externo-planejamento-e-desenvolvimento-organizacional |
| 34309 | TCE-CE 2015 · Técnico de Controle Externo – Administração | https://www.estudegratis.com.br/provas/fcc-2015-tce-ce-tecnico-de-controle-externo-administracao |
| 21860 | TCE-SP 2012 · Agente de Fiscalização Financeira – Administração | https://www.estudegratis.com.br/provas/fcc-2012-tce-sp-agente-de-fiscalizacao-financeira-administracao |
| 21497 | TCE-PR 2011 · Analista de Controle – Administrativa | https://www.estudegratis.com.br/provas/fcc-2011-tce-pr-analista-de-controle-administrativa |

O arquivo de cada prova é `https://www.estudegratis.com.br/images/provas/<id>-<slug>-prova.pdf`.

## Fontes que foram tentadas e não puderam ser usadas

- **FCC (concursosfcc.com.br)**: a prova do TCE-GO 2022 só abre com o número do caderno e o código de acesso do candidato.
- **PCI Concursos**: os PDFs ficam atrás de verificação anti-robô (captcha); não foi contornada.
- A prova TCE-CE 2015 · Analista – Auditoria Governamental foi baixada, mas o texto só foi lido em parte (19 questões), então ficou fora da contagem.
