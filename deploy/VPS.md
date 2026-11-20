# Estudo TCE-GO na VPS compartilhada

Registro de como a plataforma foi publicada numa VPS que já tem outras aplicações, e de como operá-la.
Não contém senhas.

## Resumo

| Item | Valor |
|---|---|
| Endereço | https://tce.nucleodedados.com (registro DNS **A** `tce` → IP da VPS) |
| Pasta na VPS | `/opt/estudo-tce-go` (clone git de `github.com/vinisoarescastro/estudo-tce-go`, branch `main`) |
| Contêiner | `estudo-tce-go-app` (projeto Compose `estudo-tce-go`) |
| Compose | `deploy/docker-compose.vps.yml` |
| Porta | `127.0.0.1:3100` (só local; nada exposto direto na internet) |
| Dados | volume Docker `estudo-tce-go_dados` (banco `estudo.db`, `backups/`, `fotos/`) |
| HTTPS | Caddy do Mandatus (`mandatus-caddy`), certificado automático |
| Limites | 512 MB de memória e 1 CPU |
| Editais | TCE-GO 2026 (B02 e A01) e IFG 2026 (IFG308); uma conta pode estudar mais de um |
| Backups extras | `/root/backups-estudo-tce-go/` (fora do volume Docker) |
| Última atualização | 20/11/2026, commit `bce91dd` (banco na migração 7) |

## Como o tráfego chega

```
navegador ──HTTPS──> mandatus-caddy (portas 80/443)
                        └─ tce.nucleodedados.com ──> estudo-tce-go-app:3000
```

- As portas 80 e 443 pertencem ao Caddy do Mandatus (`/opt/mandatus/Caddyfile`). Por isso o app não sobe um
  proxy próprio: o contêiner entra também na rede `mandatus_default` e o Caddy o alcança pelo nome.
- No fim de `/opt/mandatus/Caddyfile` há um bloco `tce.nucleodedados.com { ... }` marcado como "estudo-tce-go".
- O Caddy do Mandatus roda com `admin off`: **não recarrega** a configuração, só reinicia
  (`docker restart mandatus-caddy`, cerca de 2 a 5 segundos fora do ar para os sites do Mandatus).
- Cópia do Caddyfile original, de antes da alteração: `/opt/mandatus/Caddyfile.bak-antes-estudo`.

## Outras aplicações na mesma VPS (não mexer sem necessidade)

- `decida-voto` (`/opt/emquemvotar`): usa a porta local 3000 e um túnel Cloudflare.
- `mandatus` (`/opt/mandatus`): Caddy nas portas 80/443, API, banco e worker.
- `locacoes` (contêineres `locacoes-locacoes-web-1`, `-api-1` e `-db-1`): não publica portas no host.
- Porta 3100 é do estudo-tce-go. Antes de usar outra porta local, confira com `ss -tlnp`.
- Comandos que afetam todos os projetos ficam proibidos aqui: `docker system prune`, `docker image prune -a`,
  `docker compose down` fora desta pasta, reiniciar o Docker ou o servidor.
- Para conferir que nada além do app foi afetado: `docker ps --format "{{.Names}}	{{.Status}}"` antes e depois.

## Operação do dia a dia

Todos os comandos na pasta `/opt/estudo-tce-go`.

```bash
# Estado e logs
docker ps --filter name=estudo
docker logs -f --tail 100 estudo-tce-go-app
curl -s http://127.0.0.1:3100/api/saude            # {"ok":true}

# Atualizar o app (a pasta é um clone git; o repositório é público, sem senha)
# 1) no seu computador: commit e `git push origin main`
# 2) na VPS, nesta ordem:
docker exec estudo-tce-go-app node build/cli.mjs backup              # cópia do banco antes de tudo
git pull --ff-only                                                    # só avança; recusa se a VPS divergir
docker compose -f deploy/docker-compose.vps.yml build                 # build com o app antigo ainda no ar
docker compose -f deploy/docker-compose.vps.yml up -d                 # troca só este contêiner (uns 2 s fora do ar)
# Os dados ficam no volume; as migrações do banco rodam sozinhas na inicialização. O Mandatus não é afetado.
# Depois confira:
curl -s http://127.0.0.1:3100/api/saude                               # {"ok":true}
docker logs --since 2m estudo-tce-go-app                              # migrações e editais gravados, sem "erro"
docker ps --filter name=estudo                                        # (healthy) depois de uns 30 s
# e dê Ctrl+F5 no navegador.
# Atualização com migração de banco: antes de publicar, teste as migrações numa cópia do backup
# (`DATA_DIR=pasta-da-copia node build/cli.mjs usuario:listar` no seu computador roda as migrações na cópia).
# Se o git reclamar de "dubious ownership":
#   git config --global --add safe.directory /opt/estudo-tce-go
# Não edite arquivos direto na VPS: o próximo `git pull` pode conflitar. Altere no repositório.

# Contas (o cargo da criação é o edital principal: B02, A01 ou IFG308)
docker exec -it estudo-tce-go-app node build/cli.mjs usuario:criar --email E --nome "Nome" --cargo B02
docker exec    estudo-tce-go-app node build/cli.mjs usuario:edital --email E --cargo IFG308   # acrescenta um edital à conta
docker exec    estudo-tce-go-app node build/cli.mjs usuario:edital --email E --cargo IFG308 --principal  # e o torna o principal
docker exec    estudo-tce-go-app node build/cli.mjs usuario:edital --email E --cargo IFG308 --retirar    # retira (os dados ficam guardados)
docker exec -it estudo-tce-go-app node build/cli.mjs usuario:senha --email E     # redefinir senha
docker exec    estudo-tce-go-app node build/cli.mjs usuario:nome  --email E --nome "Nome"
docker exec    estudo-tce-go-app node build/cli.mjs usuario:listar                # inclui os editais de cada conta
# Na plataforma, o administrador faz o mesmo em Configurações → Usuários → Gerenciar.

# Foto de perfil (.webp, .png ou .jpg, até 2 MB): copie para dentro do contêiner e aplique
docker cp foto.webp estudo-tce-go-app:/tmp/foto.webp
docker exec estudo-tce-go-app node build/cli.mjs usuario:foto --email E --arquivo /tmp/foto.webp
```

## Backup e restauração

- O app cria uma cópia do banco na inicialização e a cada 24 h, mantendo as 14 mais recentes
  (`/app/data/backups` no contêiner).
- Antes de cada atualização, faça uma cópia manual (`node build/cli.mjs backup`, ver acima). Antes da atualização
  que trouxe o IFG e os vários editais por conta (migrações 5 a 7), uma cópia completa foi guardada fora do volume, em
  `/root/backups-estudo-tce-go/antes-fases-ifg-20261120-195309/`. Voltar a uma versão anterior a essa exige
  restaurar essa cópia, porque as versões antigas não conhecem a nova estrutura do banco.
- Elas ficam **na mesma VPS**. Copie para outro lugar de tempos em tempos:
  ```bash
  docker cp estudo-tce-go-app:/app/data/backups ./backups-estudo
  docker cp estudo-tce-go-app:/app/data/fotos ./fotos-estudo     # as fotos não entram nos backups do banco
  ```
- Restaurar uma cópia (com o app parado):
  ```bash
  docker compose -f deploy/docker-compose.vps.yml stop app
  docker compose -f deploy/docker-compose.vps.yml run --rm app \
    node build/cli.mjs restaurar --arquivo /app/data/backups/ARQUIVO.db --confirmar
  docker compose -f deploy/docker-compose.vps.yml start app
  ```
- **Nunca** use `docker compose down -v` nesta pasta: o `-v` apaga o volume com todos os dados.

## Desfazer a publicação

1. Remover o bloco `tce.nucleodedados.com` de `/opt/mandatus/Caddyfile` (ou restaurar
   `Caddyfile.bak-antes-estudo`) e reiniciar o Caddy: `docker restart mandatus-caddy`.
2. Parar o app: `docker compose -f deploy/docker-compose.vps.yml down` (sem `-v`, para guardar os dados).
3. Só apague o volume `estudo-tce-go_dados` se tiver certeza e já tiver copiado os backups.

## Segurança

- Login só por HTTPS (cookie seguro em produção). Sessões e senhas ficam como hash no banco.
- A foto só é entregue ao dono, depois do login (`/api/perfil/foto`).
- A VPS aceita SSH com senha para o root e não tem `fail2ban`: prefira chave SSH e instale o `fail2ban`.
  A senha do root foi compartilhada numa conversa em 20/11/2026: troque-a.
- O firewall `ufw` só libera a porta 22, mas o Docker publica portas por conta própria. Por isso o app escuta
  apenas em `127.0.0.1`.
