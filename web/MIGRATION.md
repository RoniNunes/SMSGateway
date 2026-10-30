# Migração PHP/MySQL → Next.js/Prisma/SQLite → Supabase

## Mapa de equivalência

| MySQL (PHP) | Prisma (SQLite) |
|-------------|-----------------|
| `users` | `User` |
| `user_devices` | `Device` |
| `sms_received` | `SmsReceived` |
| `sms_received.user` | `SmsReceived.userLabel` (`legacy_user`) |
| `sms_queue` | `SmsQueue` |

## Fase 1 — Arrancar stack nova (paralelo ao PHP)

```bash
cd web
cp .env.example .env
npm install
npx prisma db push
npm run db:seed
npm run dev
```

Testar:

- http://localhost:3000/health.php
- App Android: URL = `http://SEU-IP:3000` (mesmos endpoints `.php`)

## Fase 2 — APIs já migradas (compatível Android)

| Endpoint PHP | Route Next.js |
|--------------|---------------|
| `/health.php` | `src/app/health.php/route.ts` |
| `/register.php` | `src/app/register.php/route.ts` |
| `/save_sms.php` | `src/app/save_sms.php/route.ts` |
| `/send_sms.php` | `src/app/send_sms.php/route.ts` |
| `/api_v1.php` | `src/app/api_v1.php/route.ts` |

**Pendente (fase 3):** dashboard (`index.php`), login, pair.php, webhooks UI, admin users.

## Fase 3 — Importar dados do MySQL

### 3.1 Importar com script (recomendado)

Com o container PHP/MySQL a correr localmente:

```bash
cd web
npm install
# Porta 8081 = deploy PHP local; ajuste user/password
set MYSQL_URL=mysql://smsuser:smspassword@127.0.0.1:3306/smsgateway
npm run db:import-mysql
```

PowerShell:

```powershell
# MariaDB dentro do container (recomendado)
npm run db:import-docker

# Ou MySQL exposto na porta 3306:
$env:MYSQL_URL="mysql://smsuser:smspassword@127.0.0.1:3306/smsgateway"
npm run db:import-mysql
```

O script importa `users`, `user_devices`, `sms_received`, `sms_queue` preservando IDs.

### 3.2 Ordem de importação

1. `users`
2. `user_devices`
3. `sms_received`
4. `sms_queue`

### 3.3 Coluna `user` → `legacy_user`

No export MySQL a coluna chama-se `user`. No Prisma mapeia para `userLabel` / coluna `legacy_user`.

## Fase 4 — Cutover produção

1. Manter PHP online
2. Deploy `web/` em paralelo (porta 3000 ou subdomínio `api.`)
3. Testar 1 dispositivo Android contra Next.js
4. Apontar `APP_URL` e domínio principal para Next.js
5. Desactivar container PHP

## Fase 5 — SQLite → Supabase (Postgres)

### 5.1 Criar projecto Supabase

1. [supabase.com](https://supabase.com) → New project
2. Copiar connection strings (pooler + direct)

### 5.2 Alterar Prisma

```bash
cp prisma/schema.postgresql.prisma prisma/schema.prisma
```

`.env`:

```env
DATABASE_URL="postgresql://postgres.[ref]:[pass]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[ref]:[pass]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres"
```

### 5.3 Migrar schema

```bash
npx prisma migrate dev --name supabase_init
# ou em CI/produção:
npx prisma migrate deploy
```

### 5.4 Migrar dados SQLite → Postgres

Opções:

- **pgloader** (recomendado para volume médio)
- Script custom `scripts/sqlite-to-postgres.ts` com Prisma batch inserts
- Export CSV de cada tabela + import Supabase SQL editor

### 5.5 Supabase extras (opcional)

| Feature | Uso no SMS Gateway |
|---------|-------------------|
| Auth | Login dashboard (substituir sessão PHP) |
| Realtime | SMS recebidos ao vivo no dashboard |
| RLS | Isolamento `user_id` por tenant |
| Edge Functions | Webhooks / retry jobs |

O Android **continua** a usar HTTP para a API Next.js — não precisa do SDK Supabase no telefone.

## Checklist de validação

- [ ] `/health.php` → `database: connected`
- [ ] Pareamento QR (`register.php`)
- [ ] Fila envio (`send_sms.php?action=pending`)
- [ ] SMS recebido (`save_sms.php`)
- [ ] API externa (`api_v1.php?action=send`)
- [ ] Webhook auto após `save_sms`
- [ ] Volume `/data` persistente (Docker/EasyPanel)