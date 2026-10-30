# SMS Gateway Web — Deploy EasyPanel

Stack: **Next.js 15 + Prisma + SQLite** (1 serviço Docker).

## Gerar pacote local

```powershell
cd C:\Users\Rsantos\StudioProjects\SMSGateway
.\scripts\deploy-easypanel-web.ps1 -AppUrl "https://sms.SEU-DOMINIO.com"
```

Gera `SMSGateway-easypanel-next-vN.zip` e `web/.env.production`.

## EasyPanel — passos

| # | Acção |
|---|--------|
| 1 | Apague deploy antigo (PHP) se existir |
| 2 | **Add Service** → **Compose** |
| 3 | Upload do ZIP `SMSGateway-easypanel-next-v*.zip` |
| 4 | Compose: `docker-compose.yml` (1 serviço `web`) |
| 5 | **Environment** → cole `web/.env.production` |
| 6 | Serviço `web` → **Domains** → proxy porta **3005** → **HTTPS** |
| 7 | **Deploy** (~3–5 min na 1.ª vez — build Node) |

## Variáveis obrigatórias

```
PORT=3005
APP_URL=https://sms.seudominio.com
DATABASE_URL=file:/data/smsgateway.db
MIGRATE_KEY=...
PAIRING_SECRET=...
SESSION_SECRET=...
TZ=Europe/Lisbon
```

**Não defina** `APP_HOST` em produção — use só `APP_URL` com `https://`.

## Verificar

- `https://sms.seudominio.com/health.php` → `"database": "connected"`, `"apk": "available"`
- `https://sms.seudominio.com/login` → painel
- Login: `admin@smsgateway.local` / `admin123`

## Telefone Android

1. Dashboard → **Dispositivos** → Gerar QR
2. O QR usa `APP_URL` — confirme HTTPS e domínio correcto
3. APK: `/download.php` ou `public/SMSGateway.apk`

## Volume

| Volume | Dados |
|--------|--------|
| `sqlite_data` | Base SQLite (`/data/smsgateway.db`) |

Marque como persistente no EasyPanel.