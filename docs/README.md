# Documentação

| Documento | Assunto |
|---|---|
| [IMPLANTACAO.md](IMPLANTACAO.md) | Publicação em produção, backups, restauração e atualização |
| [PLANO-VARIOS-EDITAIS.md](PLANO-VARIOS-EDITAIS.md) | Plano para vários editais por conta e inclusão do IFG 2026 |
| [tce-go-2026/ANALISE-A01.md](tce-go-2026/ANALISE-A01.md) | TCE-GO 2026: método e fontes do edital verticalizado do cargo A01 |
| [ifg-2026/ANALISE-BANCA-AOCP.md](ifg-2026/ANALISE-BANCA-AOCP.md) | IFG 2026: análise das provas AOCP para Técnico de Laboratório/Química |

## Organização

- `docs/`: textos de referência, com uma pasta por concurso (`tce-go-2026/`, `ifg-2026/`).
- `fontes/`: arquivos de entrada dos scripts que geram os editais (planilhas e contagens), também com uma pasta por concurso. A pasta não entra na imagem Docker.
- `public/editais/`: PDF de cada edital, servido pela plataforma só para quem entrou (`tce-go-2026.pdf`, `ifg-2026.pdf`). Os scripts de `scripts/` também leem o texto oficial daqui.
