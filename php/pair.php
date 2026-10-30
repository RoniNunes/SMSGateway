<?php
/**
 * pair.php — Página pública de pareamento (QR code / link)
 * Valida assinatura HMAC + código pendente; abre app ou permite download do APK.
 */
require_once __DIR__ . '/auth.php';

$code  = strtoupper(trim($_GET['code'] ?? ''));
$sig   = trim($_GET['sig'] ?? '');
$name  = trim($_GET['name'] ?? '');
$phone = trim($_GET['phone'] ?? '');

pairing_rate_limit_or_fail('pair_page', 40, 300);

$row = pairing_public_validate($code, $sig);
$valid = $row !== null;

if ($valid) {
    if ($name === '') {
        $name = $row['device_name'] ?? 'Android';
    }
    if ($phone === '') {
        $phone = $row['phone_number'] ?? '';
    }
}

$baseUrl   = app_base_url();
$deepLink  = $valid ? pairing_deep_link($code, $name, $phone) : '';
$apkUrl    = $valid ? $baseUrl . '/pair_download.php?' . http_build_query(['code' => $code, 'sig' => $sig]) : '';
$expiresAt = $valid ? ($row['pairing_expires'] ?? '') : '';

http_response_code($valid ? 200 : 400);
?>
<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>SMS Gateway — Parear dispositivo</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg: #0A0E1A; --card: #1A2236; --stroke: rgba(255,255,255,.08);
  --primary: #00C9B1; --text: #EAF0FF; --muted: #7A90B8; --rose: #FF5C6B;
}
body {
  font-family: 'Inter', system-ui, sans-serif;
  background: var(--bg); color: var(--text);
  min-height: 100vh; display: flex; align-items: center; justify-content: center;
  padding: 24px; line-height: 1.5;
}
.wrap { width: 100%; max-width: 420px; }
.card {
  background: var(--card); border: 1px solid var(--stroke);
  border-radius: 20px; padding: 28px 24px;
}
.logo { font-size: 22px; font-weight: 700; margin-bottom: 6px; }
.sub { color: var(--muted); font-size: 14px; margin-bottom: 22px; }
.badge {
  display: inline-block; font-size: 12px; font-weight: 600;
  letter-spacing: .12em; padding: 8px 14px; border-radius: 10px;
  background: rgba(0,201,177,.12); color: var(--primary); margin-bottom: 18px;
}
.steps { list-style: none; margin: 18px 0; }
.steps li {
  font-size: 14px; color: var(--muted); padding: 10px 0;
  border-bottom: 1px solid var(--stroke);
}
.steps li:last-child { border-bottom: none; }
.steps strong { color: var(--text); }
.btn {
  display: block; width: 100%; text-align: center; text-decoration: none;
  border: none; border-radius: 12px; padding: 14px 18px; font-size: 15px;
  font-weight: 600; cursor: pointer; margin-top: 10px;
}
.btn-primary { background: var(--primary); color: #041210; }
.btn-secondary {
  background: transparent; color: var(--text);
  border: 1px solid var(--stroke);
}
.btn:disabled { opacity: .55; cursor: not-allowed; }
.err { color: var(--rose); font-size: 14px; }
.hint { font-size: 12px; color: var(--muted); margin-top: 14px; text-align: center; }
#status { font-size: 13px; color: var(--muted); margin-top: 12px; min-height: 20px; }
</style>
</head>
<body>
<div class="wrap">
  <div class="card">
    <div class="logo">SMS Gateway</div>
    <p class="sub">Ligação automática do dispositivo Android</p>

    <?php if (!$valid): ?>
      <p class="err">Link inválido ou expirado. Gere um novo código QR no painel web.</p>
      <a class="btn btn-secondary" href="login.php" style="margin-top:20px">Ir para o painel</a>
    <?php else: ?>
      <div class="badge"><?= htmlspecialchars($code, ENT_QUOTES, 'UTF-8') ?></div>
      <ol class="steps">
        <li><strong>1.</strong> Se ainda não tem a app, descarregue o APK abaixo.</li>
        <li><strong>2.</strong> Toque em <strong>Abrir na app</strong> — o registo é automático.</li>
        <li><strong>3.</strong> Aceite as permissões de SMS no telefone.</li>
      </ol>

      <button type="button" class="btn btn-primary" id="btnOpenApp">Abrir na app SMS Gateway</button>
      <a class="btn btn-secondary" href="<?= htmlspecialchars($apkUrl, ENT_QUOTES, 'UTF-8') ?>">Descarregar APK</a>
      <p id="status"></p>
      <?php if ($expiresAt !== ''): ?>
        <p class="hint">Código válido até <?= htmlspecialchars($expiresAt, ENT_QUOTES, 'UTF-8') ?> UTC</p>
      <?php endif; ?>
    <?php endif; ?>
  </div>
</div>
<?php if ($valid): ?>
<script>
(function () {
  const deepLink = <?= json_encode($deepLink, JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_AMP) ?>;
  const statusEl = document.getElementById('status');
  const btn = document.getElementById('btnOpenApp');

  function openApp() {
    statusEl.textContent = 'A abrir a app…';
    window.location.href = deepLink;
    setTimeout(function () {
      statusEl.textContent = 'Se a app não abriu, instale o APK e tente novamente.';
    }, 2500);
  }

  btn.addEventListener('click', openApp);

  if (document.visibilityState === 'visible') {
    setTimeout(openApp, 400);
  }
})();
</script>
<?php endif; ?>
</body>
</html>