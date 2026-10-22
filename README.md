# Estudo TCE-GO · Cargo B02

Plataforma de estudos para o cargo **B02 (Tecnologia da Informação)** do concurso do Tribunal de Contas do Estado de Goiás, **Edital nº 01/2026 (FCC)**, prova em **17/01/2027**.

Ela organiza o estudo por **ciclos**, acompanha a situação de cada um dos 253 conteúdos do edital, cronometra as sessões e mostra o progresso, as horas e o que estudar a seguir. Os dados ficam num **banco de dados no servidor**, protegido por **login**, e podem ser acessados de qualquer dispositivo.

| Camada | Tecnologia |
|---|---|
| Interface | React 18 + TypeScript, gerada pelo Vite (`build/web`) |
| Regras de negócio | `src/domain/`: código puro, o mesmo no navegador e no servidor |
| API | Node.js 22.13+ sem framework (`node:http`), empacotada com esbuild (`build/server.mjs`) |
| Banco | SQLite embutido no Node (`node:sqlite`), arquivo único em `data/estudo.db` |
| Acesso | Login por e-mail e senha (scrypt), sessão em cookie HttpOnly |

---

## 1. Como rodar

Requer **Node.js 22.13 ou superior** (o computador já tem o Node 24).

### No seu computador

```bash
npm install                 # uma vez
npm run build               # gera o frontend e o servidor em build/
npm run usuario:criar -- --email voce@exemplo.com --nome "Seu nome"   # cria a conta (pede a senha)
COOKIE_SECURE=false npm start                                         # http://127.0.0.1:3000
```

No Windows (PowerShell), o último comando fica `$env:COOKIE_SECURE='false'; npm start`. Fora de produção o cookie já é aceito sem HTTPS; a variável só é necessária se `NODE_ENV=production` estiver definido.

### Desenvolvimento

```bash
npm run dev        # servidor (porta 3000, reinicia a cada mudança) + Vite em http://localhost:5173
npm test           # testes automáticos (domínio, banco, API e segurança)
npm run typecheck  # verificação de tipos
```

Para criar a conta em desenvolvimento, rode `npm run build:server` uma vez e depois `npm run usuario:criar -- --email ...`.

### Na VPS (produção, com HTTPS)

Veja o passo a passo em **[docs/IMPLANTACAO.md](docs/IMPLANTACAO.md)**: Docker Compose com Caddy (HTTPS automático) ou Node + systemd, criação segura da conta, backups, restauração, logs e atualização.

### Trazer os dados da versão anterior

A versão anterior guardava tudo no navegador. O arquivo antigo **`dist/index.html` foi mantido intacto**, então seus dados continuam lá:

1. Abra `dist/index.html` no mesmo navegador de sempre e vá em **Configurações → Exportar backup**.
2. Na nova plataforma, vá em **Configurações → Dados e backup → Importar backup** e escolha o arquivo. Ou, pelo terminal do servidor: `node build/cli.mjs importar --email voce@exemplo.com --arquivo backup.json`.

A importação valida o arquivo antes, e o servidor guarda uma cópia do banco antes de substituir os dados. Backups antigos (sem fuso horário) recebem o fuso padrão `America/Sao_Paulo`.

---

## 2. Como usar

| Menu | Página | Para que serve |
|---|---|---|
| **Início** | Visão geral do dia | Só os 4 indicadores essenciais (conclusão do edital, dias para a prova, horas hoje, horas na semana), **Seu próximo estudo** com os botões **Estudar agora**, **Registrar sessão** e **Marcar como estudado**, e **Na sequência do ciclo**, com “Mostrar mais” e “Mostrar menos”. |
| **Estudos** | Conteúdos | Núcleo → Disciplina → Conteúdo, com busca e filtros (situação, prioridade, pré-requisito pendente, dominados, sem sessão, com observações, revisão vencida). A situação muda direto na lista. Clicar num conteúdo abre a **ficha**: trecho do edital, situação, “domino”, revisão, prioridade, pré-requisitos, sessões e observações. |
| | Ciclo de estudos | A sessão **Agora** e a **sequência**: em seguida, já passou nesta volta, desativada e dependente de pré-requisito. Reordene arrastando pela alça ou pelas setas, ajuste os minutos, ative, desative, remova ou adicione. O painel **Tempo e distribuição sugerida** abre sob demanda. |
| **Acompanhamento** | Dashboard geral | Recomendações e revisões vencidas, evolução da conclusão, situação dos conteúdos, horas por dia, semana ou mês, metas cumpridas, Gerais x Específicos, distribuição do tempo e planejado x realizado, conteúdos com mais tempo, progresso por núcleo e por disciplina, e as últimas sessões. Filtros de período, núcleo e disciplina. |
| | Histórico de estudos | Todas as sessões, com filtros, totais, correção e exclusão. A aba **Alterações** mostra o registro automático de mudanças, com busca. |
| **Edital e fontes** | Edital oficial | Dados do concurso, a data da prova configurada e o edital em PDF dentro da página. |
| | Referências e fontes | Trecho, página e situação da referência de cada conteúdo, com filtros para as que precisam de conferência. Mostra também o que é oficial e o que é estratégico, as limitações e o texto integral do Anexo II. |
| **Configurações** | Metas e planejamento | Data da prova (fonte única da contagem regressiva), metas diária e semanal, duração padrão, intervalos de revisão e fuso horário. |
| | Preferências de estudo | Disciplinas que participam do ciclo, prioridade por disciplina e todos os pré-requisitos. |
| | Personalização | Tema (automático, claro ou escuro) e menu lateral recolhido. Fica salvo na conta. |
| | Dados e backup | Situação do salvamento, exportar backup em JSON, exportar sessões em CSV, importar backup e apagar tudo. |
| | Conta e segurança | Dados da conta, troca de senha, sessões ativas em outros dispositivos e sair. |

O menu lateral pode ser **recolhido** (só ícones) pelo botão no topo dele. No celular, ele abre pelo botão ☰ e fecha com Esc ou tocando fora.

### Fluxo do dia

1. Entre e clique em **Estudar agora** em “Seu próximo estudo”. O cronômetro aparece no topo de todas as páginas.
2. Use **Pausar** e **Retomar** quando precisar. O tempo em pausa não conta, e o cronômetro fica salvo no servidor: continua certo se você recarregar a página ou trocar de dispositivo.
3. Clique em **Finalizar**, escolha a nova situação do conteúdo e salve. A sessão vai para o histórico e o ciclo avança.
4. Se estudou sem cronômetro, use **Registrar horas** (Início, Dashboard ou Histórico) ou **Registrar sessão** na ficha do conteúdo.

---

## 3. Fontes e fidelidade ao edital

| Informação | Fonte | Natureza |
|---|---|---|
| Núcleos, 14 disciplinas e texto dos conteúdos | Edital, **Anexo II**, pp. 19 a 22 | Oficial |
| Questões e pesos (CG 25 × peso 1; CE 45 × peso 2; 4h30) | Item **7.1**, p. 8 | Oficial |
| Habilitação nas objetivas (soma padronizada ≥ 150) | Item **9.5**, p. 12 | Oficial |
| Estudo de Caso (0 a 100, mínimo 50) | Itens **11.4 a 11.9**, p. 13 | Oficial |
| Nota final | Item **12.2**, p. 14 | Oficial |
| Vagas do B02 (10, sendo 1 PcD e 2 negros) | Item **2.1**, p. 1 | Oficial |
| Data da prova (17/01/2027) | **Anexo III**, item 12, p. 23 | Oficial |
| Divisão em 253 itens numerados (nº) | Planilha *Edital Verticalizado v2.0* | Planilha |
| Prioridade (Urgente/Alta/Média/Baixa) e incidência histórica | Planilha | **Estratégico, não oficial** |
| 140 pré-requisitos sugeridos | Sugestão pedagógica desta plataforma | **Estratégico** |
| Ordem e tempos do ciclo, metas, revisões | Plano de estudos e suas configurações | **Estratégico** |

**Limitações, ditas de forma explícita:**

- O **Anexo II não numera itens nem subitens**. Por isso a referência de cada conteúdo é: Anexo II, disciplina, página e o **trecho literal** do edital correspondente. O “nº” vem da planilha.
- **Não existe nível de subtópico no edital**, e a plataforma não inventa um. Quando a planilha desdobrou um trecho do edital em vários itens (marcados `[Interpretação]` na planilha), o item aparece como “desdobramento”.
- O **edital não informa quantas questões cada disciplina terá**, só o total por bloco.
- O trecho de cada conteúdo foi localizado automaticamente no texto do edital: 251 itens com correspondência alta e 2 com correspondência parcial (nº 72 e nº 88), marcados “confira a referência”.
- **Integrações não implementadas:** não há Google Drive nem banco de questões. Também não há recuperação de senha por e-mail: a senha é redefinida pelo terminal do servidor.

---

## 4. Regras de cálculo

Todas as regras estão em `src/domain/` e são cobertas por testes.

**Situação dos conteúdos** (`progress.ts`)
- As situações são: Não iniciado, Em andamento, Estudado e Em revisão.
- **Concluído** = “Estudado” ou “Em revisão”. Cada conteúdo conta uma única vez.
- **% concluído** = concluídos ÷ total de conteúdos do recorte (disciplina, núcleo ou geral).
- **Dominado** é uma autoavaliação separada. Exige o conteúdo concluído e **não altera o percentual**.
- Reabrir um conteúdo concluído (voltar para Não iniciado ou Em andamento) tira ele da contagem e desmarca “dominado”. As sessões e o histórico continuam.
- Iniciar o cronômetro num conteúdo “Não iniciado” muda ele para “Em andamento”.

**Horas** (`stats.ts`, `timer.ts`)
- Todas as horas são somas das sessões registradas. Corrigir ou excluir uma sessão recalcula tudo na hora.
- O cronômetro guarda o horário de início e o tempo acumulado, não um contador. Pausas não contam, e recarregar a página não perde nem duplica tempo: a sessão salva usa o mesmo id do cronômetro.
- Sessões com menos de 1 minuto não são salvas.
- **Média diária** = horas desde o primeiro dia com estudo até hoje ÷ número de dias. Dias sem estudo contam como zero. **Média semanal** = média diária × 7.
- **Planejado x realizado** compara o tempo planejado de cada sessão (o tempo do item do ciclo ou o informado) com o estudado.
- As semanas começam na segunda-feira.

**Ciclo** (`cycle.ts`)
- O ciclo guarda **qual é o próximo item**, não uma posição. Reordenar não muda o próximo.
- Desativar o próximo passa para o seguinte item ativo.
- Uma sessão só avança o ciclo se for do item que era o próximo.
- Ao passar do último item, o número da volta aumenta.
- Remover ou desativar um item não apaga sessões, porque as sessões guardam a disciplina.
- **Distribuição sugerida**: o peso de cada disciplina é calculado assim:
  - soma, por conteúdo pendente, do peso da prioridade (Urgente 3, Alta 2, Média 1, Baixa 0,5);
  - conteúdos concluídos contam 0,25;
  - o resultado é multiplicado pelo peso do bloco na prova (CG 1, CE 2; item 7.1) e pela prioridade da disciplina, se você definiu uma (Média = neutro).
  - O total da volta é repartido proporcionalmente, em blocos de 15 minutos, dividido entre as repetições da mesma disciplina.

**Prioridades**
- A prioridade de um conteúdo é a que você definiu ou, sem isso, a da planilha.
- A prioridade de uma disciplina é a que você definiu ou, sem isso, a mais frequente entre os conteúdos dela.

**Pré-requisitos** (`deps.ts`, `recommend.ts`)
- **Obrigatório**: se o conteúdo a estudar tem pré-requisito obrigatório não concluído, a recomendação aponta primeiro a base, seguindo a cadeia até o primeiro conteúdo liberado.
- **Recomendado**: só aparece como aviso.
- O app recusa uma dependência que crie ciclo (A antes de B antes de A), que seja duplicada ou de um conteúdo para ele mesmo.
- A lista de conteúdos marca com um alerta quando há pré-requisito obrigatório pendente.

**Próximo conteúdo de uma disciplina**: entre os não concluídos, primeiro os “Em andamento”, depois os de maior prioridade, depois a ordem da planilha.

**Recomendações** (Dashboard geral → “O que estudar agora”), nesta ordem:
1. Próximo conteúdo da próxima disciplina do ciclo, ou a base dele.
2. Até 2 revisões vencidas.
3. Equilíbrio: a disciplina do ciclo cuja fatia de horas nos últimos 14 dias está mais de 5 pontos percentuais abaixo da fatia planejada.

Cada recomendação mostra os motivos.

**Dia e semana** (`util.ts`)
- “Hoje” e “esta semana” seguem o **fuso horário configurado** (padrão `America/Sao_Paulo`), não o do servidor. Uma sessão às 23h30 em Goiânia fica no dia certo mesmo com a VPS em UTC.

**Metas** (`stats.ts`, Dashboard geral)
- Dias na meta = dias do período (até hoje) cujo total estudado atingiu a meta diária.
- Semanas na meta = semanas completas (segunda a domingo) do período que atingiram a meta semanal. A semana atual aparece à parte, como “em andamento”.
- As metas contam todas as sessões, mesmo com filtro de disciplina ou núcleo.

**Revisões** (`revisions.ts`)
- Próxima revisão = último estudo + intervalo da vez. O padrão é 1, 7 e 30 dias; depois do último intervalo, repete o maior.
- Registrar uma revisão muda a situação para “Em revisão” e conta +1 revisão.

---

---

## 5. Onde os dados ficam e como são protegidos

- **Banco**: SQLite em `data/estudo.db` (pasta definida por `DATA_DIR`), com tabelas normalizadas: usuários, sessões de login, núcleos, disciplinas, conteúdos, referências, dependências sugeridas, dados oficiais, configurações, ciclo e itens, situação dos conteúdos, prioridades, pré-requisitos, sessões de estudo, cronômetro e histórico. O esquema é versionado em `server/db.ts` (tabela `schema_migracoes`).
- **Fonte única**: o servidor aplica cada ação com o mesmo código de `src/domain/actions.ts` e grava o resultado numa transação. Se algo falhar, nada é gravado. A tela aplica a ação na hora e envia ao servidor. Se a conexão cair, as alterações ficam na aba e são reenviadas automaticamente, e o navegador avisa se você tentar fechar antes.
- **Vários dispositivos**: ao voltar para a aba, a plataforma busca mudanças feitas em outro lugar. Se duas alterações se cruzarem, o servidor aplica as duas, na ordem em que chegaram.
- **Login**: senha com hash scrypt; sessão num cookie `HttpOnly`, `SameSite=Lax` e `Secure` em produção. O banco guarda só o hash do token. A sessão expira após 7 dias sem uso ou 30 dias no total. Trocar a senha encerra as outras sessões.
- **Proteções**: toda leitura e gravação de dados exige sessão válida **no servidor**, e o edital em PDF também. Há bloqueio após 5 senhas erradas por e-mail ou 20 por IP (15 minutos), cabeçalho anti-CSRF e checagem de origem nas alterações, limite de tamanho das requisições e cabeçalhos de segurança (CSP, HSTS, `nosniff`, `frame-ancestors`).
- **Backups**: cópia automática do banco (padrão: a cada 24 h, mantendo 14), cópia extra antes de importar ou apagar tudo, `npm run backup` sob demanda e exportação em JSON pela tela. Restauração e detalhes em [docs/IMPLANTACAO.md](docs/IMPLANTACAO.md).

---

## 6. Manutenção

> Publicação em produção: [docs/IMPLANTACAO.md](docs/IMPLANTACAO.md). A instalação atual na VPS compartilhada está registrada em [deploy/VPS.md](deploy/VPS.md).

### Estrutura

```
src/
  data/seed.json      estrutura do edital (gerada pelos scripts; o servidor grava no banco)
  domain/             regras de negócio puras, usadas pela tela e pelo servidor
  api.ts              cliente da API (cookie de sessão + cabeçalho anti-CSRF)
  store/              estado da tela: carrega do servidor, aplica ações e sincroniza
  ui/                 componentes: ficha do conteúdo, cronômetro, formulário de sessão,
                      gráficos SVG, filtros, ícones
  pages/              Início, Conteúdos, Ciclo, Dashboard, Histórico, Edital oficial,
                      Referências, Foco (tela de estudo com Pomodoro), Login e config/ (6 páginas de
                      configurações, incluindo os tempos do Pomodoro)
  App.tsx             menu lateral com submenus, rotas por # e avisos
server/
  index.ts            inicialização: banco, migrações, edital, backups agendados
  app.ts              rotas da API, autenticação, CSRF, cabeçalhos e arquivos estáticos
  servico.ts          aplica as ações do domínio e grava em transação
  repositorio.ts      conversão entre o documento do domínio e as tabelas
  db.ts               conexão, migrações e transações
  edital.ts           sincroniza o seed.json com as tabelas do edital
  auth.ts             senhas, sessões e bloqueio de tentativas
  backup.ts           cópias com VACUUM INTO, rotação e conferência
  cli.ts              administração pelo terminal (contas, backup, importação)
scripts/              build do servidor, modo dev e geradores do seed
deploy/               Caddyfile e serviço systemd
public/               edital.pdf (servido só para quem entrou) e marca/ (logo do TCE-GO: completa, emblema e favicon)
dist/                 versão anterior (arquivo único com dados no navegador), mantida para exportar os dados
```

- Toda alteração de dados passa por `reduzir()` em `src/domain/actions.ts`. A tela só despacha ações, e o servidor aceita só as ações conhecidas.
- Para criar uma funcionalidade, adicione a ação ao tipo `Acao` e à lista `ACOES` em `server/servico.ts`, trate ela no `switch` e escreva testes.
- Para mudar o banco, crie uma nova migração no fim de `MIGRACOES` em `server/db.ts`. Nunca edite uma migração já aplicada.

### Testes

`npm test` roda 52 testes:
- **domínio**: estrutura do edital, progresso, cronômetro, ciclo, distribuição, pré-requisitos, recomendações, revisões, horas, importação, metas, série mensal, ids determinísticos e reinício;
- **banco**: o edital volta idêntico; gravar e ler, ação por ação, não perde dados nem a ordem das listas; uma falha no meio desfaz tudo; fuso horário;
- **API e segurança**: nada é acessível sem login; cabeçalhos de segurança; CSRF e origem; senha errada não revela se o e-mail existe; ações persistidas e versionadas; dados intactos após reiniciar; importação validada com backup; preferências; troca de senha encerra as outras sessões; bloqueio após tentativas; expiração de sessão; senhas e tokens só com hash.

### Atualizar o edital ou a planilha

Se sair uma retificação do edital ou uma nova versão da planilha:

```bash
# requer Python 3, openpyxl e pdftotext (poppler-utils)
python3 scripts/anexo.py anexo.json public/edital.pdf
python3 scripts/seed.py anexo.json fontes/edital_verticalizado_b02_v2.xlsx src/data/seed.json
npm test && npm run build   # na inicialização, o servidor grava a nova versão do edital no banco
```

- Aumente `seedVersion` em `scripts/seed.py` quando a estrutura mudar.
- Os dados do usuário guardam só o estado por id de conteúdo (`t001` a `t253`, o nº da planilha). Manter a numeração da planilha preserva o progresso.
