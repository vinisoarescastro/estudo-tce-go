# Implantação em VPS

Guia para colocar a plataforma na internet com HTTPS, acessível só para você. Não assume nada já configurado na VPS.

## O que você precisa

| Item | Observação |
|---|---|
| VPS Linux | Ubuntu 22.04/24.04 ou Debian 12. 1 vCPU e 1 GB de RAM bastam. |
| Domínio ou subdomínio | Ex.: `estudo.seudominio.com.br`, com um registro **A** (e **AAAA**, se houver IPv6) apontando para o IP da VPS. Sem domínio não há certificado HTTPS válido. |
| Portas 80 e 443 liberadas | No firewall da VPS e no painel do provedor. A 80 é usada para emitir o certificado. |
| Acesso SSH | Com chave, de preferência. |

Escolha **um** dos caminhos: **A (Docker, recomendado)**, **B (Node + systemd)** ou **C (VPS que já tem outras aplicações e um proxy nas portas 80/443)**.

---

## Preparação da VPS (os dois caminhos)

```bash
sudo apt update && sudo apt upgrade -y
sudo adduser --disabled-password --gecos "" estudo     # usuário sem senha para rodar a aplicação
# Firewall: só SSH, HTTP e HTTPS
sudo apt install -y ufw
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable
```

Copie o projeto para a VPS (sem `node_modules`, `build`, `data` e `dist`), por exemplo com `git clone` ou:

```bash
rsync -av --exclude node_modules --exclude build --exclude data --exclude dist ./ usuario@IP:/opt/estudo-tce-go/
```

---

## Caminho A: Docker Compose + Caddy (HTTPS automático)

```bash
# Docker (script oficial)
curl -fsSL https://get.docker.com | sudo sh

cd /opt/estudo-tce-go
export DOMINIO=estudo.seudominio.com.br
sudo -E docker compose up -d --build          # sobe a aplicação e o Caddy
sudo docker compose logs -f                   # acompanhe; o Caddy emite o certificado em alguns segundos
```

Para o `DOMINIO` valer também em reinícios sem `export`, crie um arquivo `.env` ao lado do `docker-compose.yml` com `DOMINIO=estudo.seudominio.com.br`. O Compose lê esse arquivo automaticamente.

**Criar a sua conta** (só pelo terminal do servidor, nunca pela internet):

```bash
sudo docker compose exec app node build/cli.mjs usuario:criar --email voce@exemplo.com --nome "Seu nome"
```

A senha é pedida sem aparecer na tela: mínimo de 10 caracteres, e ela não pode conter o seu e-mail. Abra `https://estudo.seudominio.com.br` e entre.

**Importar os dados da versão anterior** (veja o README, seção 1): pela tela, em Configurações → Dados e backup, ou assim:

```bash
sudo docker compose cp backup.json app:/app/data/backup.json
sudo docker compose exec app node build/cli.mjs importar --email voce@exemplo.com --arquivo /app/data/backup.json
```

Comandos úteis:

| Tarefa | Comando |
|---|---|
| Logs | `sudo docker compose logs -f app` |
| Reiniciar | `sudo docker compose restart app` |
| Atualizar a aplicação | `git pull` (ou rsync) e `sudo -E docker compose up -d --build` |
| Redefinir senha esquecida | `sudo docker compose exec app node build/cli.mjs usuario:senha --email voce@exemplo.com` |
| Definir o nome exibido na saudação | `sudo docker compose exec app node build/cli.mjs usuario:nome --email voce@exemplo.com --nome "Seu nome"` |
| Definir a foto de perfil (.webp, .png ou .jpg, até 2 MB) | copie a imagem para o contêiner (`docker cp`) e rode `node build/cli.mjs usuario:foto --email voce@exemplo.com --arquivo /tmp/foto.webp`. A foto fica em `data/fotos/` e **não** entra nos backups do banco |
| Backup agora | `sudo docker compose exec app node build/cli.mjs backup` |
| Listar backups | `sudo docker compose exec app node build/cli.mjs backups` |

Os dados ficam no volume `dados` do Docker (`/app/data` no contêiner). **Não use** `docker compose down -v`: a opção `-v` apaga os volumes.

---

## Caminho B: Node.js + systemd + Caddy

```bash
# Node 24 (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
node -v                                       # precisa ser 22.13 ou superior

# Caddy (proxy com HTTPS automático)
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy

# Aplicação
sudo chown -R estudo:estudo /opt/estudo-tce-go
cd /opt/estudo-tce-go
sudo -u estudo npm ci
sudo -u estudo npm run build
sudo -u estudo cp .env.example .env           # revise: HOST=127.0.0.1, COOKIE_SECURE=true, TRUST_PROXY=true
sudo -u estudo node build/cli.mjs usuario:criar --email voce@exemplo.com --nome "Seu nome"

# Serviço
sudo cp deploy/estudo-tce-go.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now estudo-tce-go
journalctl -u estudo-tce-go -f
```

Configure o Caddy em `/etc/caddy/Caddyfile`:

```
estudo.seudominio.com.br {
	encode zstd gzip
	reverse_proxy 127.0.0.1:3000
	request_body {
		max_size 30MB
	}
}
```

Depois rode `sudo systemctl reload caddy`. Para atualizar a aplicação: `git pull`, `sudo -u estudo npm ci && sudo -u estudo npm run build` e `sudo systemctl restart estudo-tce-go`.

**Nginx no lugar do Caddy?** Funciona igual. Use `proxy_pass http://127.0.0.1:3000`, `proxy_set_header Host $host`, `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for`, `client_max_body_size 30m`, e emita o certificado com `certbot --nginx`.

---

## Caminho C: VPS que já tem outras aplicações

Use quando as portas 80 e 443 já pertencem a outro proxy (Caddy, Nginx, Traefik...). O `docker-compose.yml` do
caminho A **não serve**: ele sobe um Caddy próprio nessas portas e entraria em conflito.

Em vez disso, use [`deploy/docker-compose.vps.yml`](../deploy/docker-compose.vps.yml), que sobe só o app, numa rede
própria, escutando em `127.0.0.1:3100`, com limite de 512 MB e 1 CPU, e entra na rede do proxy existente para ele
alcançá-lo pelo nome:

```bash
docker compose -f deploy/docker-compose.vps.yml up -d --build
docker exec -it estudo-tce-go-app node build/cli.mjs usuario:criar --email voce@exemplo.com --nome "Seu nome"
```

Depois, acrescente um bloco ao proxy existente (exemplo para Caddy; o nome do contêiner vem do compose):

```
estudo.seudominio.com.br {
	encode zstd gzip
	reverse_proxy estudo-tce-go-app:3000
	request_body {
		max_size 30MB
	}
}
```

Cuidados com a VPS compartilhada: confira que a porta 3100 está livre (`ss -tlnp`), guarde uma cópia do arquivo do
proxy, valide a configuração antes de recarregar (alguns proxies, como um Caddy com `admin off`, só aplicam mudanças
reiniciando) e confirme que as outras aplicações continuam respondendo.

O registro desta publicação (domínio, estrutura, operação, backup e como desfazer) está em
[`deploy/VPS.md`](../deploy/VPS.md).

---

## Variáveis de ambiente

Todas estão comentadas em [`.env.example`](../.env.example). As principais:

| Variável | Padrão | Uso |
|---|---|---|
| `NODE_ENV` | — | `production` liga o cookie seguro por padrão |
| `HOST` / `PORT` | `127.0.0.1` / `3000` | Onde o Node escuta. Mantenha `127.0.0.1` atrás de proxy (no Docker, `0.0.0.0` na rede interna) |
| `DATA_DIR` | `./data` | Banco (`estudo.db`) e backups (`backups/`) |
| `COOKIE_SECURE` | `true` em produção | Cookie só por HTTPS. Desligue apenas em testes locais |
| `TRUST_PROXY` | `false` | `true` atrás de Caddy ou Nginx, para registrar o IP real e checar a origem |
| `SESSION_IDLE_DAYS` / `SESSION_MAX_DAYS` | `7` / `30` | Expiração das sessões |
| `LOGIN_MAX_FAILS_EMAIL` / `LOGIN_MAX_FAILS_IP` / `LOGIN_LOCK_MINUTES` | `5` / `20` / `15` | Bloqueio de tentativas |
| `BACKUP_INTERVAL_HOURS` / `BACKUP_KEEP` | `24` / `14` | Cópias automáticas |
| `LOG_LEVEL` | `info` | `debug`, `info`, `aviso` ou `erro` |

A aplicação não tem segredos obrigatórios (nada de chave de sessão ou senha de banco). Mesmo assim, o arquivo `.env` deve ter permissão restrita (`chmod 600 .env`) e nunca vai para o Git (está no `.gitignore`).

---

## Backup e restauração

**O que salvar:** a pasta `data/` inteira (`estudo.db` e `backups/`). No Docker, é o volume `dados`.

**Automático:** o servidor cria uma cópia na inicialização e a cada 24 h (`data/backups/estudo-AAAAMMDD-HHMMSS-auto.db`), mantendo as 14 mais recentes. Antes de toda importação ou de “Apagar tudo”, cria também uma cópia `-antes-substituir.db`. As cópias usam `VACUUM INTO`: são arquivos SQLite completos e consistentes, feitos sem parar o servidor.

**Cópia fora da VPS:** os backups locais não protegem contra a perda da máquina. Copie-os periodicamente para outro lugar, por exemplo com um cron no seu computador:

```bash
rsync -av usuario@IP:/opt/estudo-tce-go/data/backups/ ~/backups-estudo/
# Docker: sudo docker compose cp app:/app/data/backups ./backups-estudo
```

A exportação em JSON (Configurações → Dados e backup) é outra cópia portátil dos seus dados de estudo.

**Restaurar uma cópia do banco:**

```bash
# Caminho B
sudo systemctl stop estudo-tce-go
sudo -u estudo node build/cli.mjs backups                                   # escolha o arquivo
sudo -u estudo node build/cli.mjs restaurar --arquivo data/backups/ARQUIVO.db --confirmar
sudo systemctl start estudo-tce-go

# Caminho A: rode o comando num contêiner temporário, com a aplicação parada
sudo docker compose stop app
sudo docker compose run --rm app node build/cli.mjs restaurar --arquivo /app/data/backups/ARQUIVO.db --confirmar
sudo docker compose start app
```

O comando confere a integridade do arquivo, guarda uma cópia do banco atual (`-antes-restaurar.db`) e aplica as migrações pendentes, se a cópia for de uma versão anterior.

**Restaurar um backup JSON:** pela tela (Importar backup) ou com `node build/cli.mjs importar --email ... --arquivo ...`.

---

## Logs e erros

- Os logs saem em JSON, uma linha por evento, na saída padrão: `journalctl -u estudo-tce-go` ou `docker compose logs app`. Cada requisição da API registra método, caminho, status, duração e o id do usuário. Logins recusados e bloqueados aparecem como `aviso`, com o IP. Senhas, tokens e o conteúdo das requisições nunca são registrados.
- Erros inesperados aparecem como `erro`, com a pilha resumida. Para o usuário, aparece só uma mensagem genérica.
- Verificação de saúde: `GET /api/saude` responde `{"ok":true}`. O Docker já usa essa rota no `HEALTHCHECK`.

---

## Segurança: lista de conferência

- [ ] Acessar por `https://` e conferir o cadeado; `http://` deve redirecionar (o Caddy faz isso).
- [ ] `COOKIE_SECURE=true` e `TRUST_PROXY=true` em produção.
- [ ] O Node escuta só em `127.0.0.1` (caminho B) ou só na rede interna do Docker (caminho A): a porta 3000 não fica exposta.
- [ ] Firewall com apenas 22, 80 e 443.
- [ ] Conta criada pelo terminal, com senha longa e única.
- [ ] Backups copiados para fora da VPS.
- [ ] Atualizações do sistema em dia (`sudo apt install unattended-upgrades`).

## Mais usuários no futuro

O banco já separa todos os dados por `usuario_id`, e cada conta tem dados, preferências e sessões próprios. Para criar outra conta: `node build/cli.mjs usuario:criar --email outra@pessoa.com`. Não há cadastro aberto pela internet, de propósito.

## Limitações conhecidas

- **Recuperação de senha por e-mail** não existe, porque não há servidor de e-mail configurado. A redefinição é feita pelo terminal (`usuario:senha`), o que exige acesso à VPS.
- **SQLite** atende muito bem um ou poucos usuários. Para dezenas de usuários simultâneos, a camada `server/repositorio.ts` pode ser portada para PostgreSQL sem mexer nas regras de negócio.
- O `node:sqlite` é estável no Node 22.13+ e 24, mas ainda é marcado como “release candidate” pelo projeto Node. Por isso, use as versões LTS indicadas.
