# SMS Gateway — Web (Next.js + Prisma)

Migração do backend PHP/MySQL para **Next.js 15 + Prisma + SQLite**, com caminho para **Supabase/Postgres**.

O projecto Android (`../app/`) continua na raiz — só muda a URL do servidor.

## Quick start

```bash
cd web
cp .env.example .env
npm install
npx prisma db push
npm run db:seed
npm run dev
```

- App: http://localhost:3000
- Health: http://localhost:3000/health.php
- Admin seed: `admin@smsgateway.local` / `admin123`

## APK

```bash
cp ../php/SMSGateway.apk public/SMSGateway.apk
```

## Docker / EasyPanel

```bash
docker compose up -d --build
```

- Porta **3000**
- SQLite em volume `smsgateway_sqlite` → `/data/smsgateway.db`
- Variáveis: `APP_URL`, `PAIRING_SECRET`, `MIGRATE_KEY`

## Estrutura

```
web/
  prisma/schema.prisma          # SQLite (activo)
  prisma/schema.postgresql.prisma  # Referência Supabase
  src/app/*.php/route.ts        # APIs compatíveis com Android
  src/lib/                      # pairing, webhook, device auth
  MIGRATION.md                  # Guia completo de migração
```

## Dashboard + Realtime

- Login: http://localhost:3000/login (`admin@smsgateway.local` / `admin123`)
- Dashboard: http://localhost:3000/dashboard
- **SSE** `/api/realtime/stream` — canais: `stats`, `sms`, `queue`, `devices`
- Push em tempo real quando Android grava SMS ou actualiza fila
- Poll de snapshot a cada 3s como fallback

## Import MySQL → SQLite

```powershell
$env:MYSQL_URL="mysql://smsuser:smspassword@127.0.0.1:3306/smsgateway"
npm run db:import-mysql
```

## Próximas fases

1. Webhook UI + admin utilizadores
2. `pair.php` página pública Next.js
3. Supabase Postgres + Auth

Ver **MIGRATION.md** para detalhes.