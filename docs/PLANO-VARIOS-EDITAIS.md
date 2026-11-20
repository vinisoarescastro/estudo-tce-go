# Plano: vários editais na mesma plataforma

Situação em 20/11/2026: as três fases implementadas.

Hoje a plataforma atende um concurso (TCE-GO 2026, cargos B02 e A01). Este plano acrescenta o concurso do **IFG 2026, cargo 308 – Técnico de Laboratório/Área Química**, e permite que **uma mesma conta estude para mais de um edital**. A plataforma está em produção: nenhuma etapa pode mudar o que as contas atuais veem ou perder dados.

## Decisões tomadas

| Pergunta | Decisão |
|---|---|
| Quem tem dois editais estuda com um ciclo só ou dois? | **Ciclos separados**, um por edital. |
| Meta diária | **Uma meta por edital** (e uma data de prova por edital). |
| Quem inscreve uma conta em outro edital | **Somente o administrador.** |
| Conteúdos que aparecem nos dois editais | Um script sugere os pares; **o administrador revisa** e só os pares aprovados valem. |
| Prioridade de um conteúdo compartilhado | **Individual de cada edital.** |

## Dados do IFG

- Edital de Abertura nº 001/2026, **versão definitiva**, em [public/editais/ifg-2026.pdf](../public/editais/ifg-2026.pdf). Banca: Instituto AOCP.
- **Prova objetiva: 14/02/2027** (Anexo I – Cronograma Previsto).
- Prova: 50 questões. Português 10 (peso 2), Legislação 10 (peso 1), Raciocínio Lógico e Matemática 5 (peso 1), Informática 5 (peso 1), Conhecimentos Específicos de Química 20 (peso 3).
- Conteúdo de Química: 23 itens, idêntico ao do IFCE 2026.
- Edital verticalizado com prioridades: [fontes/ifg-2026/edital_verticalizado_308_quimica.xlsx](../fontes/ifg-2026/edital_verticalizado_308_quimica.xlsx) (133 conteúdos).
- Análise da banca: [ifg-2026/ANALISE-BANCA-AOCP.md](ifg-2026/ANALISE-BANCA-AOCP.md). Ela foi escrita sobre a minuta; os alertas sobre "Minuta" e sobre a falta do cronograma ficam superados pela versão definitiva acima. Ao gerar o edital do IFG, confirmar que o programa e os mínimos por disciplina não mudaram.

## Como os dados ficam organizados

| Nível | Exemplo | Situação |
|---|---|---|
| Concurso | TCE-GO 2026, IFG 2026 | Novo: nome, órgão, banca, PDF do edital e marca |
| Cargo (edital verticalizado) | B02, A01, IFG-308 | Já existe (tabela `cargos`, um seed por cargo) |
| Inscrição (conta ↔ cargo) | Uma conta no B02 e no IFG-308 | Novo; hoje cada conta tem só `usuarios.cargo_id` |

`usuarios.cargo_id` continua existindo e passa a significar "edital principal". A migração cria uma inscrição para cada conta a partir dele.

## Regras

### O que é compartilhado e o que é de cada edital

| Compartilhado entre conteúdos equivalentes | Individual de cada edital |
|---|---|
| Situação (não iniciado, em andamento, estudado, em revisão) e "dominado" | Prioridade da planilha e a prioridade definida pelo usuário |
| Data de conclusão, último estudo, revisões feitas | "Pular até a disciplina cair de novo" |
| Anotações | Ciclo, posição no ciclo e recomendações |
|  | Meta diária, meta semanal e data da prova |

`estados_topico` continua com uma linha por conteúdo. Ao atualizar um conteúdo, o servidor copia só os campos de progresso para os conteúdos equivalentes nos outros editais em que a conta está inscrita. Prioridade e "pular" nunca são copiados.

### Tempo de estudo e metas

- Uma sessão conta na meta **do edital em que foi registrada**, nunca nas duas.
- O progresso do conteúdo (estudado, revisões) é copiado para o equivalente, mas os minutos não.
- Histórico e tempo total da conta somam cada sessão uma única vez.

### Cronômetro

Continua único por conta, preso ao edital em que foi iniciado. Ao trocar de edital com ele rodando, um aviso mostra que ele pertence ao outro edital.

### Inscrições

- Só o administrador acrescenta ou retira editais de uma conta e escolhe o principal (tela de Usuários).
- Retirar um edital **desativa** a inscrição; os dados ficam guardados e voltam se a conta for inscrita de novo.
- O usuário só alterna entre os editais que tem. Quem tem um edital só não vê o seletor.

### Na tela

- Seletor de "edital ativo" no topo, onde hoje aparece o nome do cargo. Ele troca ciclo, conteúdos, painel, PDF e marca.
- Conteúdo compartilhado: a ordem segue sempre a prioridade do edital ativo; uma marca informa o outro edital e a prioridade lá, por exemplo "também no TCE-GO · Média".

## Fases

Cada fase vai para produção sozinha e só depois a próxima começa.

### Fase 1: IFG como novo cargo (implementada)

Nada muda para as contas atuais. Contas novas podem ser criadas no cargo `IFG308`, com um edital só.

Como ficou:
- O concurso de cada cargo é a coluna `cargos.concurso_id` (migração 5, só acrescenta; B02 e A01 ficam em `tce-go-2026`). Os dados de cada concurso (sigla, órgão, banca, PDF, anexo do conteúdo, marca, limitações) ficam em `src/domain/concursos.ts`.
- Ids do IFG: disciplinas `ifglp`, `ifgleg`, `ifgrlm`, `ifginf`, `ifgqui`; conteúdos `i001` a `i133`.
- Padrões do cargo: meta diária de 4 h, semanal de 24 h, ciclo de 16 h por volta com 9 h de Química. A pessoa ajusta em Metas e no Ciclo.
- O IFG ainda não tem emblema próprio: o menu mostra um ícone neutro. Para usar uma imagem, ponha o arquivo em `public/marca/` e informe `emblema` e `favicon` no concurso.

1. **Edital do IFG.** Novo `scripts/ifg/seed_ifg.py`, no molde de `scripts/a01/seed_a01.py`: lê a planilha e o PDF, localiza página e trecho oficial de cada conteúdo e gera `src/data/seed-ifg308.json`.
   - Ids com prefixo próprio (`ifg...`), sem colidir com B02 e A01.
   - `dataProva` 2027-02-14, ciclo inicial com mais tempo para Química (60 dos 100 pontos).
   - Fatos oficiais: questões, pesos, mínimos e desempate.
2. **Concurso no cargo.** O cargo informa o concurso (nome, órgão, banca, PDF, marca). Isso tira o "TCE-GO" fixo de:
   - `src/App.tsx`, `src/pages/EditalOficial.tsx`, `src/pages/Login.tsx`;
   - os links de página do edital em `src/ui/primitives.tsx`.
3. **Um PDF por concurso**, por exemplo `editais/tce-go-2026.pdf` e `editais/ifg-2026.pdf`.
   - Continuam exigindo login (`ESTATICOS_PRIVADOS` em `server/app.ts`).
   - O endereço antigo `edital.pdf` continua respondendo com o PDF do TCE-GO.
4. **Tela de login neutra**, porque ela aparece antes de se saber o concurso da conta.
5. **Registro do cargo** em `server/cargos.ts`, com testes para um terceiro cargo.
6. **Textos fixos de nomes de arquivos** exportados (backup e CSV) sem "tce-go".

### Fase 2: várias inscrições por conta (implementada)

Como ficou:
- **Migração 6.** Tabela `inscricoes` (conta, cargo, ativa, criada em), uma por conta a partir de `usuarios.cargo_id`, que continua sendo o edital principal (não há coluna "principal" separada). Todos os dados de estudo ganharam `cargo_id`, preenchido com o cargo atual da conta:
  - recriadas com o cargo na chave, copiando as mesmas linhas: `configuracoes`, `ciclos`, `ciclo_itens` e `historico`. Os ids dos itens do ciclo (`ci01`…) e o evento inicial (`ev-inicio`) se repetem entre editais;
  - só ganharam a coluna: `estados_topico`, `prioridades_disciplina`, `dependencias`, `sessoes_estudo` e `cronometros`. Os ids de conteúdos e disciplinas já são únicos entre editais.
  - `cronometros` manteve a conta como chave: **um só cronômetro por conta**. O serviço recusa iniciar outro em outro edital, e a tela mostra um aviso com o atalho para o edital do cronômetro.
- **Documento por edital.** `ServicoDados` e `repositorio.ts` leem e gravam por (conta, edital). A versão dos dados continua sendo da conta: uma mudança em um edital faz a aba de outro receber os dados completos na próxima ação, o que é seguro. Trocar o principal sobe a versão, para uma aba antiga não gravar no edital errado.
- **API.** O cabeçalho `X-Edital` escolhe o edital. Sem ele, vale o principal; com um edital em que a conta não está inscrita, a resposta é 409 (`editalInvalido`), e a tela volta ao principal. `/api/auth/eu` traz os editais da conta; `/api/dados` traz `cronometroOutro`; `/api/exportar` exporta o edital ativo.
- **Administração.** `POST /api/admin/usuarios/editais` (acrescentar ou retirar) e `POST /api/admin/usuarios/principal`, também para a própria conta. O edital principal não pode ser retirado. Retirar só desativa a inscrição: os dados ficam e voltam. No terminal: `usuario:edital`, e `importar`/`exportar` com `--cargo`.
- **Interface.** Seletor de edital no menu lateral (só para quem tem mais de um), guardado no navegador por conta; a troca recarrega a página. "Editais da conta" no Gerenciar da tela de Usuários, com a coluna Editais e o filtro por edital. O acompanhamento tem um seletor de edital, e a lista mostra o edital principal.
- **Um edital novo** herda o fuso horário da conta. Metas, data da prova e ciclo vêm dos padrões do cargo.

### Fase 3: equivalências (implementada)

Como ficou:
- **Sugestão de pares.** `scripts/equivalencias/sugerir.py` compara os títulos dos conteúdos de cada par de editais, só dentro das áreas em comum: Português, Matemática e Raciocínio Lógico, Legislação e Direito, Informática e Segurança. Usa a semelhança das palavras, um título curto contido no outro e o mesmo número de lei (contando "LGPD" como a Lei 13.709). Gera `fontes/equivalencias/pares-sugeridos.xlsx`, com a coluna Decisão: os pares de força alta já vêm como "aceito"; o resto fica em branco. Rodar de novo mantém as decisões já tomadas.
- **Revisão (20/11/2026).** Dos 155 pares sugeridos, 76 foram aceitos: os 51 itens de Conhecimentos Gerais comuns ao B02 e ao A01, um item de Constituição presente em disciplinas diferentes dos dois, 10 assuntos de Português e Constituição entre o TCE-GO e o IFG (para B02 e A01) e três leis em comum entre A01 e IFG, além da LGPD entre B02 e IFG. Critério: como o progresso é copiado nos dois sentidos, só entram pares em que estudar um cobre o outro por inteiro. Pares com um lado bem mais amplo e leis diferentes sobre o mesmo tema foram recusados. O motivo de cada decisão está na coluna Observação da planilha.
- **Revisão e aplicação.** `scripts/equivalencias/aplicar.py` grava em `src/data/equivalencias.json` só as linhas "aceito". O servidor regrava a tabela `equivalencias` (migração 7, só acrescenta) na inicialização e recusa pares com conteúdo desconhecido ou do mesmo edital.
- **Cópia do progresso.** Ao alterar um conteúdo, o servidor leva situação, "dominado", datas, revisões e anotações aos equivalentes nos outros editais ativos da conta, na mesma transação. A prioridade, o "pular" e as horas de estudo ficam em cada edital. Importar e reiniciar não mexem nos outros editais. A cópia não é em cadeia: vale para os pares diretos.
- **Edital novo.** O plano de um edital acrescentado depois já começa com o progresso dos equivalentes estudados nos outros editais (o mais avançado, se houver mais de um). Editais que já existiam antes de um par ser aprovado não são acertados retroativamente: passam a andar juntos a partir da próxima alteração.
- **Na tela.** A lista de conteúdos mostra "também no IFG 308 · Alta" (a prioridade de lá), e a ficha do conteúdo tem a seção "Também em outro edital" (`GET /api/equivalentes`).

## Cuidados em todas as fases

- **Migrações só acrescentam:** colunas com valor padrão e tabelas novas, como as migrações 3 e 4 em `server/db.ts`.
- **Antes de publicar:** backup do banco e teste da migração numa cópia do banco de produção.
- **Depois de publicar:** conferir que as contas atuais abrem exatamente como antes.
- **Ids estáveis:** ao mudar um seed, aumentar `seedVersion` e nunca reaproveitar ou reordenar ids. O progresso dos usuários guarda só esses ids.
