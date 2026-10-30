# Deploy SMS Gateway no EasyPanel

## CORRIGIR: `getaddrinfo for db failed`

Este erro significa que o EasyPanel está a usar a **imagem antiga** (só PHP) à espera de um MySQL chamado `db` que **não existe**.

**Solução (obrigatório):**

1. **Apague** o serviço SMS Gateway actual no EasyPanel
2. Gere ZIP novo: `.\scripts\deploy-easypanel.ps1 -AppUrl "https://SEU-DOMINIO.com"`
3. **Add Service** → **Compose** → upload do ZIP **v13+**
4. Ficheiro Compose: **`docker-compose.yml`** (ou deixe auto-detectar)
5. Deve existir **apenas 1 serviço**: `web` (não `db` + `web`)
6. No **Environment**, **APAGUE** `DB_HOST`, `MYSQL_ROOT_PASSWORD`, `mysql-global`
7. **Deploy** — nos logs deve aparecer:
   ```
   [entrypoint] SMS Gateway all-in-one — MariaDB + Apache
   [wait-db] modo=all-in-one Host=127.0.0.1
   [wait-db] MySQL disponível
   ```

Se ainda vir `Host=db` ou `modo=compose`, a imagem antiga está em cache — force **Rebuild** sem cache.

---

## Início rápido (recomendado)

```powershell
.\scripts\deploy-easypanel.ps1 -AppUrl "https://sms.seudominio.com"
```

Isto gera `.env.production` (passwords aleatórias) e `SMSGateway-easypanel-vN.zip`.

### No EasyPanel

| Passo | Acção |
|-------|--------|
| 1 | **Apague** deploy antigo se existir |
| 2 | **Add Service** → **Compose** (não use App/Nixpacks) |
| 3 | Upload do ZIP mais recente (**v13+**) |
| 4 | Compose: **`docker-compose.yml`** — **1 serviço** `web` |
| 5 | **Environment** → cole `.env.production` — **sem DB_HOST** |
| 6 | Serviço `web` → **Domains** → porta **80** → **HTTPS** |
| 7 | **Deploy** (~2 min na 1.ª vez) |

### Variáveis obrigatórias (serviço `app`)

```
DB_PASSWORD=...
DB_NAME=smsgateway
DB_USER=smsuser
APP_URL=https://sms.seudominio.com
MIGRATE_KEY=...
PAIRING_SECRET=...
MIGRATE_ON_START=true
TZ=Europe/Lisbon
```

**Não defina** `DB_HOST`, `MYSQL_ROOT_PASSWORD` nem `mysql-global` neste modo.

### Verificar deploy

- `https://sms.seudominio.com/health.php` → `"database": "connected"`, `"apk": "available"`
- Login: `admin@smsgateway.local` / `admin123` (altere após 1.º acesso)
- **Dispositivos** → Gerar QR → telefone liga automaticamente

---

## Requisitos

- Servidor com [EasyPanel](https://easypanel.io) instalado
- Repositório Git (GitHub/GitLab) com este projeto **ou** upload ZIP
- Domínio apontado para o servidor (ex: `sms.seudominio.com`)

## Passo 1 — Push do código

```bash
git add .
git commit -m "Prepare EasyPanel deploy"
git push origin main
```

Certifique-se que `php/SMSGateway.apk` está no repositório (ou faça build local e copie antes do push).

## ⭐ Recomendado — UM serviço só (`app` = MariaDB + PHP)

> Use isto se `mysql-global` ou Compose `db`+`web` não funcionaram.

### EasyPanel Compose (1 serviço)

1. Apague serviços antigos (`web`, Compose com `db`, etc.)
2. **Add Service** → **Compose**
3. Upload ZIP mais recente (`v9+`)
4. **Ficheiro Compose:** `compose.all-in-one.yaml`
5. Deve aparecer **apenas** o serviço **`app`**

### Variáveis (serviço `app`)

```
DB_PASSWORD=Str0ng_Db!
DB_NAME=smsgateway
DB_USER=smsuser
APP_URL=https://SEU-DOMINIO.com
MIGRATE_KEY=string-aleatoria-32-chars
MIGRATE_ON_START=true
TZ=Europe/Lisbon
```

**Apague** estas variáveis se existirem: `DB_HOST`, `MYSQL_ROOT_PASSWORD`, `mysql-global`.

> Se vir `getaddrinfo for mysql-global failed`, ainda tem `DB_HOST=mysql-global` no Environment — **remova**.

### Domínio

- Serviço **`app`** → Domains → porta **80** → HTTPS → Deploy
- Primeira execução demora ~2 min (instala MariaDB + schema)

### Verificar

```
[init] MariaDB pronto
[wait-db] MySQL disponível
[entrypoint] A iniciar supervisord
```

`https://SEU-DOMINIO/health.php` → `"database": "connected"`

### EasyPanel App (alternativa)

- **Dockerfile:** `Dockerfile.all-in-one`
- Mesmas variáveis de ambiente
- Volume persistente: `/var/lib/mysql`

---

## MySQL externo (`mysql-global`) + só `web`

Use quando já tem um serviço **MySQL** separado no EasyPanel (ex: `mysql-global`).

### A) Preparar o MySQL (`mysql-global`)

1. No painel do **mysql-global**, crie:
   - Base de dados: `smsgateway`
   - Utilizador: `smsuser` com password forte
2. Importe o schema: ficheiro `MySQL_DB.sql` do projecto  
   (consola MySQL, Adminer ou phpMyAdmin ligado ao `mysql-global`)
3. Copie o **hostname interno** do MySQL (painel EasyPanel) — normalmente:
   - `mysql-global` ou
   - `evo-go_mysql-global` (varia por projecto)

### B) Serviço Compose só `web`

1. **Add Service** → **Compose**
2. Upload ZIP recente (`v8+`)
3. **Ficheiro Compose:** `compose.web-external-mysql.yaml`
4. Deve aparecer **apenas** o serviço `web`

### C) Variáveis de ambiente (serviço `web`)

```powershell
.\scripts\prepare-easypanel.ps1 -AppUrl "https://SEU-DOMINIO.com" -DbHost "mysql-global"
```

| Variável | Valor |
|----------|-------|
| `DB_HOST` | hostname interno do `mysql-global` |
| `DB_PASSWORD` | password do user `smsuser` no mysql-global |
| `DB_USER` | `smsuser` |
| `DB_NAME` | `smsgateway` |
| `APP_URL` | `https://SEU-DOMINIO.com` |
| `MIGRATE_KEY` | string aleatória 32+ chars |
| `MIGRATE_ON_START` | `true` |

**Não use** `DB_HOST=db` nem `localhost`.

**Não precisa** de `MYSQL_ROOT_PASSWORD` no serviço `web` (só no mysql-global).

### D) Domínio e deploy

1. Serviço **`web`** → Domains → porta **80** → HTTPS
2. **Deploy**
3. Logs: `[wait-db] Host=mysql-global` → `MySQL disponível`

---

## Postgres vs MySQL

Este projeto usa **MySQL** (não PostgreSQL). O serviço `db-postgres` **não pode** ser usado como base de dados do SMS Gateway.

O PostgreSQL pode continuar no servidor — não há conflito. Precisa de um **MySQL** adicional (ou do serviço `db` no Compose).

---

## Opção A — Compose completo (`db` + `web`) — passo a passo

> Se já tem um serviço **App** `web` à espera de MySQL: **apague-o** e siga estes passos. O Postgres (`db-postgres`) pode ficar.

### 1. Remover deploy incorrecto
- Apague o serviço `sms-gateway` actual (tipo **App**, só `web`)
- **Não apague** o `db-postgres` — é outro projecto

### 2. Criar serviço Compose
1. No projecto EasyPanel (ex: `evo-go`) → **Add Service** → **Compose**
2. Nome sugerido: `smsgateway`
3. Fonte: upload **`SMSGateway-easypanel-v5.zip`** (ou mais recente)
4. Ficheiro Compose: `compose.yaml` ou `docker-compose.yml` (ambos iguais)

### 3. Confirmar 2 serviços
Após importar, deve ver:
- **`db`** — MySQL 8 (interno, sem domínio)
- **`web`** — PHP/Apache (domínio público aqui)

Se só aparecer `web`, o tipo de serviço está errado (App em vez de Compose).

### 4. Variáveis de ambiente (serviço Compose)
Gere localmente:
```powershell
.\scripts\prepare-easypanel.ps1 -AppUrl "https://SEU-DOMINIO.com"
```
Cole no **Environment** do Compose:

| Variável | Valor |
|----------|-------|
| `MYSQL_ROOT_PASSWORD` | password forte |
| `DB_PASSWORD` | **igual** em `db` e `web` |
| `DB_NAME` | `smsgateway` |
| `DB_USER` | `smsuser` |
| `APP_URL` | `https://SEU-DOMINIO.com` |
| `MIGRATE_KEY` | 32+ chars aleatórios |
| `MIGRATE_ON_START` | `true` |
| `TZ` | `Europe/Lisbon` |

**Não defina** `DB_HOST` no EasyPanel. Se existir `DB_HOST=localhost`, **apague** — causa erro `No such file or directory`.

### 5. Domínio (só no `web`)
1. Serviço **`web`** → **Domains**
2. Adicione o domínio (ex: `sms.seudominio.com`)
3. **Proxy Port:** `80`
4. Active **HTTPS**

O serviço **`db`** não recebe domínio.

### 6. Deploy e verificar
1. **Deploy** e aguarde 2–3 min (MySQL na primeira vez é mais lento)
2. Logs do **`db`**: deve mostrar `ready for connections`
3. Logs do **`web`**: `[wait-db] MySQL disponível` → `Apache a iniciar`
4. Abra `https://SEU-DOMINIO/health.php` → `"database": "connected"`
5. Login: `admin@smsgateway.local` / `admin123`

---

## Passo 2 — Criar projeto no EasyPanel (referência)

> **IMPORTANTE:** Use **Compose**, **não** App.

1. **New Project** → nome: `smsgateway`
2. **Add Service** → **Compose** (ícone Docker Compose)
3. Ligar o repositório Git e branch (`main` / `master`) **ou** fazer upload do ZIP
4. O EasyPanel deve usar `compose.yaml` / `docker-compose.yml` — **não** Nixpacks

### Upload via ZIP (sem Git)

```powershell
.\scripts\build-easypanel-zip.ps1
```

Gera `SMSGateway-easypanel-v2.zip` (incrementa automaticamente; versões anteriores são mantidas).

Envie o ZIP mais recente e confirme que o serviço é **Compose**.

## Passo 3 — Variáveis de ambiente

No painel do serviço Compose, adicione (copie de `.env.example`):

| Variável | Exemplo | Obrigatório |
|----------|---------|-------------|
| `MYSQL_ROOT_PASSWORD` | `Str0ng_R00t!` | Sim |
| `DB_PASSWORD` | `Str0ng_Db!` | Sim |
| `DB_NAME` | `smsgateway` | Não |
| `DB_USER` | `smsuser` | Não |
| `APP_URL` | `https://sms.seudominio.com` | Sim |
| `MIGRATE_KEY` | string aleatória 32+ chars | Sim |
| `MIGRATE_ON_START` | `true` | Não |
| `TZ` | `Europe/Lisbon` | Não |

Gere `MIGRATE_KEY` com:
```bash
openssl rand -hex 32
```

Ou no Windows (gera `.env.production` com passwords aleatórias):
```powershell
.\scripts\prepare-easypanel.ps1 -AppUrl "https://sms.seudominio.com"
```
Copie o conteúdo de `.env.production` para o Environment do EasyPanel.

## Passo 4 — Domínio e proxy

1. No serviço **web**, abra **Domains**
2. Adicione `sms.seudominio.com`
3. **Proxy Port**: `80`
4. Active **HTTPS** (Let's Encrypt automático)

O serviço `db` é **interno** — não precisa de domínio nem porta pública.

> O Apache está configurado para `X-Forwarded-Proto` (proxy EasyPanel). Defina sempre `APP_URL` com `https://` para links correctos no dashboard e na API.

## Passo 5 — Deploy

Clique **Deploy**. O EasyPanel:

1. Faz build da imagem `web` (Dockerfile em `docker/Dockerfile.php`)
2. Sobe MySQL com schema inicial (`MySQL_DB.sql`)
3. Executa migrações via `cli_migrate.php` no arranque
4. Expõe o dashboard em HTTPS

## Passo 6 — Verificar

- `https://sms.seudominio.com/health.php` → JSON com `"database": "connected"`
- `https://sms.seudominio.com/login.php` → painel de login
- Conta inicial: `admin@smsgateway.local` / `admin123` (**altere a password após o primeiro login**)

## Passo 7 — Configurar o telefone Android

1. Login no dashboard → **Dispositivos** → **Gerar QR / link de pareamento**
2. No telefone: leia o **QR code** ou abra o link (descarrega APK se necessário)
3. A app regista-se automaticamente via deep link

> Defina `APP_URL` com `https://` para QR/links correctos. Recompile o APK com o seu domínio em `network_security_config.xml` se usar HTTPS.

## phpMyAdmin (opcional)

No EasyPanel, se suportar profiles Compose, active o profile `admin` ou adicione ao deploy:

```bash
docker compose --profile admin up -d
```

Atribua um subdomínio separado (ex: `pma.seudominio.com`) ao serviço `phpmyadmin`, porta 80.

## Desenvolvimento local

```bash
cp .env.example .env
# Edite passwords no .env

docker compose -f docker-compose.yml -f docker-compose.dev.yml --profile admin up -d --build
```

Dashboard local: http://localhost:8081

## Volumes persistentes

| Volume | Conteúdo |
|--------|----------|
| `db_data` | Dados MySQL (SMS, utilizadores, fila) |

No EasyPanel, confirme que o volume `db_data` está marcado como persistente.

## Atualizar APK em produção

1. Compile localmente: `.\gradlew.bat assembleDebug`
2. Copie para `php/SMSGateway.apk`
3. `git push` → EasyPanel faz redeploy automático (se Auto Deploy activo)

## Troubleshooting

| Problema | Solução |
|----------|---------|
| `gradlew clean build` / `sh\r: No such file or directory` | Criou serviço **App** em vez de **Compose**. Apague o serviço, crie **Compose**, redeploy |
| `.nixpacks/Dockerfile` no log de build | Idem — Nixpacks está activo. Use **Compose** com `docker-compose.yml` |
| `open Dockerfile: no such file` | Falta `Dockerfile` na raiz — use o ZIP mais recente (`v3+`) ou serviço **Compose** |
| Serviço **App** (só web) | Funciona com `Dockerfile` na raiz, mas precisa MySQL externo (`DB_HOST` ≠ `db`) |
| 502 Bad Gateway | Verifique Proxy Port = 80 no serviço `web` |
| Erro de BD | Confirme `DB_PASSWORD` igual em `db` e `web` |
| Migração falhou | Veja logs do container `web`; execute migração manual na consola: `php cli_migrate.php` |
| Telefone offline | URL no app deve ser `APP_URL` exacta; firewall/porta 443 aberta |
| `[wait-db] A aguardar MySQL...` em loop | **Causa mais comum:** só o serviço `web` está activo (App), `DB_HOST=db` não existe. Use **Compose** com `db`+`web`, ou MySQL externo com `DB_HOST` correcto |
| Reinicia em `(57/60)` → `(1/60)` | Container `web` falhou timeout e reiniciou — MySQL não acessível no hostname configurado |

### Só vejo um serviço `web` (sem `db`)

**Causa:** deploy como **App** ou Compose incompleto.

**Opção A — Compose completo (recomendado, 2 serviços: `db` + `web`):**

1. Apague o serviço actual
2. **Add Service** → **Compose**
3. Upload `SMSGateway-easypanel-v4.zip` (ou mais recente)
4. Deve listar **`db`** e **`web`**
5. Variáveis: `MYSQL_ROOT_PASSWORD`, `DB_PASSWORD`, `APP_URL`, `MIGRATE_KEY`
6. Domínio no **`web`**, porta 80

**Opção B — Só `web` + MySQL separado no EasyPanel:**

1. **Add Service** → **MySQL** (novo, não use o Postgres)
2. Anote o **hostname interno** (ex: `evo-go_smsgateway-mysql` ou similar no painel)
3. Crie/importe a base `smsgateway` e utilizador `smsuser`
4. No serviço **web**, use `docker-compose.web-only.yml` ou variáveis:

| Variável | Valor |
|----------|-------|
| `DB_HOST` | hostname interno do **MySQL** (não `db`, não postgres) |
| `DB_PASSWORD` | password do MySQL |
| `DB_USER` | `smsuser` |
| `DB_NAME` | `smsgateway` |

5. Importe o schema: copie `MySQL_DB.sql` para o MySQL (phpMyAdmin ou consola)

> `DB_HOST=db` só funciona quando o serviço `db` (MySQL) está no **mesmo** Compose.

### Corrigir deploy App → Compose

1. No projeto EasyPanel, **remova** o serviço `sms-gateway` (tipo App)
2. **Add Service** → **Compose**
3. Aponte para o mesmo código / ZIP
4. Adicione variáveis de ambiente (`.env.example`)
5. Domínio no serviço **`web`**, porta **80**
6. **Deploy**