# Plano: vários editais na mesma plataforma

Situação em 20/11/2026: plano aprovado, implementação ainda não iniciada.

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

- Edital de Abertura nº 001/2026, **versão definitiva**, em [fontes/ifg-2026/edital-ifg-001-2026.pdf](../fontes/ifg-2026/edital-ifg-001-2026.pdf). Banca: Instituto AOCP.
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

### Fase 1: IFG como novo cargo

Nada muda para as contas atuais. Contas novas podem ser criadas no IFG-308, com um edital só.

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

### Fase 2: várias inscrições por conta

1. **Migração 5**, só com acréscimos:
   - Tabela `inscricoes` (conta, cargo, principal, ativa, criada em), preenchida a partir de `usuarios.cargo_id`.
   - `cargo_id` em `configuracoes`, `ciclos`, `ciclo_itens` e `cronometros`, com o cargo atual de cada conta como valor.
   - `configuracoes`, `ciclos` e `cronometros` têm a conta como chave primária e precisam ser recriadas com chave (conta, cargo). As linhas são copiadas dentro de uma transação. É o passo mais delicado de todo o plano.
2. **API com edital ativo.** O navegador envia o edital ativo em cada chamada; se não vier, vale o principal. Uma aba aberta com a versão antiga continua funcionando.
3. **Interface.** Seletor de edital ativo e "Editais da conta" na tela de Usuários.
4. **Acompanhamento do administrador** por edital.

### Fase 3: equivalências

1. **Script de sugestão.** Reaproveita a comparação de textos de `scripts/seed.py` e gera um arquivo de pares com a pontuação de semelhança e uma coluna de decisão (aceito, recusado, corrigido).
   - Equivalência pode ser de um para vários (um item do TCE-GO para dois do IFG).
   - Onde se espera sobreposição: Português, Matemática/Raciocínio Lógico e talvez Informática. Química não tem par nos editais do TCE-GO.
2. **Revisão pelo administrador.** Só os pares aceitos são gravados na tabela `equivalencias`.
3. **Cópia do progresso** entre equivalentes, conforme as regras acima.
4. **Marca na tela:** "também no …".

## Cuidados em todas as fases

- **Migrações só acrescentam:** colunas com valor padrão e tabelas novas, como as migrações 3 e 4 em `server/db.ts`.
- **Antes de publicar:** backup do banco e teste da migração numa cópia do banco de produção.
- **Depois de publicar:** conferir que as contas atuais abrem exatamente como antes.
- **Ids estáveis:** ao mudar um seed, aumentar `seedVersion` e nunca reaproveitar ou reordenar ids. O progresso dos usuários guarda só esses ids.
