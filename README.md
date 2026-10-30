# SMSGateway

> Gateway SMS usando Android + PHP + MySQL em Docker.

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────┐
│                  Dispositivo Android                │
│   SMSGateway App (envia/recebe SMS)                 │
└───────────────────────┬─────────────────────────────┘
                        │ HTTP (192.168.100.21:80)
┌───────────────────────▼─────────────────────────────┐
│              Docker Compose Stack                   │
│  ┌──────────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ PHP + Apache │  │  MySQL   │  │ phpMyAdmin   │  │
│  │   :80        │  │   :3306  │  │   :8080      │  │
│  └──────┬───────┘  └────▲─────┘  └──────────────┘  │
│         └───────────────┘                           │
└─────────────────────────────────────────────────────┘
```

## 🚀 Iniciar o Servidor Local

```bash
# Subir todos os containers
docker compose up -d --build

# Ver logs em tempo real
docker compose logs -f

# Parar os containers
docker compose down
```

## 🌐 Endpoints Disponíveis

| URL | Descrição |
|-----|-----------|
| `http://localhost/health.php` | Health check da API |
| `http://localhost/save_sms.php?phone=X&msg=Y` | Salvar SMS recebido |
| `http://localhost/reg_device.php?Token=X` | Registar dispositivo FCM |
| `http://localhost/send_sms.php?phone=X&msg=Y` | Enviar SMS via FCM |
| `http://localhost:8080` | phpMyAdmin (gestão DB) |

## 📱 Configuração do App Android

O app já está configurado para usar `192.168.100.21` (IP da máquina host).

| Tipo de dispositivo | URL do servidor |
|---------------------|-----------------|
| Dispositivo físico (mesma rede WiFi) | `http://192.168.100.21/save_sms.php` |
| Emulador Android | `http://10.0.2.2/save_sms.php` |

## 🗄️ Banco de Dados

- **Host:** `localhost:3306`
- **Database:** `smsgateway`
- **User:** `smsuser` / **Password:** `smspassword`
- **Root Password:** `rootpassword`

## 🔧 Build do App

```bash
# Requer JDK do Android Studio no PATH
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"

.\gradlew.bat assembleDebug
```

## 📋 Dependências

- **Android:** API 22+ (Android 5.1 Lollipop)
- **Gradle:** 8.6 + AGP 8.2.2
- **Java:** 21 (JDK do Android Studio)
- **Docker:** 20+ com Compose v2
