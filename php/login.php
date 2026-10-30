<?php
require_once __DIR__ . '/auth.php';

if (current_user()) {
    header('Location: index.php');
    exit;
}

$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = trim($_POST['email'] ?? '');
    $pass  = $_POST['password'] ?? '';
    $result = login_user($email, $pass);
    if ($result === 'ok') {
        header('Location: index.php');
        exit;
    }
    $error = $result === 'inactive'
        ? 'Conta ainda não activada. Aguarde aprovação do administrador.'
        : 'Email ou palavra-passe incorrectos.';
}
?>
<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Login — SMS Gateway</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#0A0E1A;--card:#1A2236;--stroke:rgba(255,255,255,.08);--primary:#00C9B1;--text:#EAF0FF;--muted:#7A90B8;--rose:#FF5C6B}
body{font-family:Inter,sans-serif;background:var(--bg);color:var(--text);min-height:100vh;display:grid;place-items:center;padding:24px}
.card{background:var(--card);border:1px solid var(--stroke);border-radius:24px;padding:40px 36px;width:100%;max-width:420px;box-shadow:0 24px 80px rgba(0,0,0,.45)}
.logo{display:flex;align-items:center;gap:14px;margin-bottom:32px}
.logo-icon{width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,var(--primary),#7C73FF);display:grid;place-items:center;font-weight:800;color:#fff}
h1{font-size:22px;font-weight:700} p.sub{color:var(--muted);font-size:13px;margin-top:4px}
label{display:block;font-size:12px;font-weight:600;color:var(--muted);margin:16px 0 6px}
input{width:100%;background:rgba(255,255,255,.04);border:1px solid var(--stroke);border-radius:12px;padding:13px 14px;color:var(--text);font:inherit;font-size:14px;outline:none}
input:focus{border-color:var(--primary);box-shadow:0 0 0 3px rgba(0,201,177,.15)}
button{width:100%;margin-top:24px;background:var(--primary);color:#0A0E1A;border:none;border-radius:12px;padding:14px;font:inherit;font-size:15px;font-weight:700;cursor:pointer}
button:hover{filter:brightness(1.05)}
.err{background:rgba(255,92,107,.1);border:1px solid rgba(255,92,107,.25);color:var(--rose);padding:12px 14px;border-radius:10px;font-size:13px;margin-bottom:8px}
.hint{margin-top:20px;font-size:11px;color:var(--muted);text-align:center;line-height:1.6}
</style>
</head>
<body>
<div class="card">
  <div class="logo">
    <div class="logo-icon">SG</div>
    <div><h1>SMS Gateway</h1><p class="sub">Inicie sessão no seu painel</p></div>
  </div>
  <?php if ($error): ?><div class="err"><?= htmlspecialchars($error) ?></div><?php endif; ?>
  <form method="post">
    <label>Email</label>
    <input type="email" name="email" placeholder="admin@smsgateway.local" required autofocus />
    <label>Palavra-passe</label>
    <input type="password" name="password" placeholder="••••••••" required />
    <button type="submit">Entrar</button>
  </form>
  <p class="hint">Conta demo: admin@smsgateway.local / admin123</p>
</div>
</body>
</html>