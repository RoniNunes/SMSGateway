# Recuperação de palavra-passe do administrador

Este guia descreve as **três formas** de restabelecer a palavra-passe de uma conta **administrador** quando não consegue iniciar sessão.

> **Importante:** esta funcionalidade **não** se aplica a utilizadores normais (`role: user`). Apenas contas com perfil **admin** podem ser recuperadas.

---

## Pré-requisito: variável `ADMIN_RECOVERY_SECRET`

A recuperação só funciona se definir no servidor (EasyPanel → **Environment** ou ficheiro `.env`):

```env
ADMIN_RECOVERY_SECRET=um_codigo_longo_aleatorio_com_pelo_menos_24_caracteres
```

| Regra | Detalhe |
|--------|---------|
| Comprimento mínimo | 24 caracteres |
| Onde guardar | Gestor de palavras-passe (1Password, Bitwarden, etc.) |
| O que **não** fazer | Commit no Git, partilhar por email/chat, colar no painel web |
| Se não estiver definida | Recuperação **desactivada** (comportamento seguro) |

### Gerar segredos automaticamente (recomendado)

No PC de desenvolvimento:

```powershell
cd C:\Users\Rsantos\StudioProjects\SMSGateway
.\scripts\prepare-easypanel-web.ps1 -AppUrl "https://SEU-DOMINIO.easypanel.host"
```

O script gera `web/.env.production` com:

- `MIGRATE_KEY`
- `PAIRING_SECRET`
- `SESSION_SECRET`
- `ADMIN_RECOVERY_SECRET` ← código de recuperação

Copie o bloco de variáveis para o **Environment** do EasyPanel e **guarde** `ADMIN_RECOVERY_SECRET` no gestor de palavras-passe.

---

## Opção 1 — Recuperação pelo ecrã de login (recomendada em emergência)

**Quando usar:** esqueceu a palavra-passe e tem acesso ao código `ADMIN_RECOVERY_SECRET`.

### Passos

1. Abra `https://SEU-DOMINIO/login`
2. Confirme que aparece o link **«Recuperação de administrador»**  
   - Se **não** aparecer → `ADMIN_RECOVERY_SECRET` não está configurado no servidor
3. Clique em **Recuperação de administrador**
4. Preencha:
   - **E-mail do administrador** (ex.: `admin@smsgateway.local`)
   - **Código de recuperação** → valor de `ADMIN_RECOVERY_SECRET`
   - **Nova palavra-passe** (mínimo 8 caracteres)
   - **Confirmar palavra-passe**
5. Clique em **Restabelecer palavra-passe**
6. Mensagem de sucesso → inicie sessão com a nova palavra-passe

### Segurança

- Máximo **5 tentativas** por IP a cada **15 minutos**
- Mensagem genérica em caso de erro (não revela se o e-mail existe)
- Registo de auditoria na base de dados (`admin_password_recovery`)

---

## Opção 2 — Linha de comandos no servidor (CLI)

**Quando usar:** tem acesso SSH/shell ao contentor ou máquina onde a app corre.

### Passos

1. Entre no contentor ou pasta `web/` do projeto
2. Confirme que `ADMIN_RECOVERY_SECRET` está no ambiente
3. Execute:

```bash
npx tsx scripts/reset-admin-password.ts \
  --email admin@smsgateway.local \
  --password "NovaSenhaSegura123"
```

Ou com o script npm:

```bash
npm run admin:reset-password -- --email admin@smsgateway.local --password "NovaSenhaSegura123"
```

4. Saída esperada:

```text
[ok] Palavra-passe de administrador actualizada: admin@smsgateway.local
```

5. Inicie sessão em `/login` com a nova palavra-passe

> O script usa `ADMIN_RECOVERY_SECRET` do ambiente — **não** precisa de introduzir o código na linha de comandos.

---

## Opção 3 — Consulta no painel (quando já está logado como admin)

**Quando usar:** está logado e quer confirmar se a recuperação está activa ou relembrar o procedimento.

### Passos

1. Inicie sessão como administrador
2. Menu lateral → **Sistema**
3. Secção **«Recuperação de palavra-passe (administrador)»**
4. Verifique o estado:
   - **Verde (activa)** → `ADMIN_RECOVERY_SECRET` configurado
   - **Amarelo (inactiva)** → defina a variável no EasyPanel e reinicie o serviço
5. Leia as instruções na secção (login + CLI)

> O código secreto **nunca** é mostrado no painel.

---

## Variável legal `LEGAL_JURISDICTION` (encoding)

No EasyPanel, evite acentos nas variáveis `.env` — alguns painéis corrompem UTF-8.

**Valor recomendado no Environment (ASCII):**

```env
LEGAL_JURISDICTION=Uniao Europeia, Brasil e jurisdicoes aplicaveis
```

A aplicação normaliza automaticamente para:

**União Europeia, Brasil e jurisdições aplicáveis**

(nos documentos legais e no painel Admin → Sistema)

Se já tinha o valor corrompido (`UniÃ£o Europeia...`):

1. Corrija no EasyPanel com o valor ASCII acima
2. Reinicie o serviço **web**
3. Opcional: painel Admin → Sistema → campo **Lei / jurisdição** → guarde com acentos correctos

---

## Resumo rápido

| Situação | Solução |
|----------|---------|
| Esqueci a senha, tenho o código secreto | Login → Recuperação de administrador |
| Esqueci a senha, tenho acesso ao servidor | `npm run admin:reset-password` |
| Quero activar recuperação | Definir `ADMIN_RECOVERY_SECRET` no EasyPanel |
| Quero ver se está activa | Painel → Sistema (logado como admin) |
| Jurisdição com caracteres estranhos | `LEGAL_JURISDICTION=Uniao Europeia, Brasil e jurisdicoes aplicaveis` |

---

## Checklist pós-deploy

- [ ] `ADMIN_RECOVERY_SECRET` definido (≥ 24 caracteres)
- [ ] Código guardado no gestor de palavras-passe
- [ ] Link «Recuperação de administrador» visível em `/login`
- [ ] `LEGAL_JURISDICTION` em ASCII no Environment
- [ ] Teste opcional: recuperação com senha temporária e alteração depois em Conta

---

## Contacto / versão

- Stack: Next.js + Prisma + SQLite (EasyPanel)
- Documento: recuperação administrador + variáveis legais
- Última actualização: 2026-06-30