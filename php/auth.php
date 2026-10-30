<?php
/**
 * auth.php — Autenticação de sessão (dashboard) e API key / device token
 */
require_once __DIR__ . '/config.php';

if (session_status() === PHP_SESSION_NONE) {
    $is_https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    if ($is_https) {
        ini_set('session.cookie_secure', '1');
    }
    ini_set('session.cookie_httponly', '1');
    ini_set('session.cookie_samesite', 'Lax');
    session_start();
}

function generate_token(int $bytes = 32): string {
    return bin2hex(random_bytes($bytes));
}

function generate_pairing_code(): string {
    return strtoupper(substr(bin2hex(random_bytes(4)), 0, 8));
}

function pairing_secret(): string {
    $secret = trim(getenv('PAIRING_SECRET') ?: '');
    return $secret !== '' ? $secret : MIGRATE_KEY;
}

function pairing_signature(string $code): string {
    return substr(hash_hmac('sha256', strtoupper(trim($code)), pairing_secret()), 0, 16);
}

function pairing_verify_sig(string $code, string $sig): bool {
    $code = strtoupper(trim($code));
    $sig  = strtolower(trim($sig));
    if ($code === '' || $sig === '' || strlen($code) !== 8) {
        return false;
    }
    return hash_equals(pairing_signature($code), $sig);
}

function pairing_build_url(string $code, ?string $name = null, ?string $phone = null): string {
    $params = ['code' => strtoupper($code), 'sig' => pairing_signature($code)];
    if ($name !== null && $name !== '') {
        $params['name'] = $name;
    }
    if ($phone !== null && $phone !== '') {
        $params['phone'] = $phone;
    }
    return app_base_url() . '/pair.php?' . http_build_query($params);
}

function pairing_deep_link(string $code, ?string $name = null, ?string $phone = null): string {
    $params = [
        'server' => app_base_url(),
        'code'   => strtoupper($code),
        'sig'    => pairing_signature($code),
    ];
    if ($name !== null && $name !== '') {
        $params['name'] = $name;
    }
    if ($phone !== null && $phone !== '') {
        $params['phone'] = $phone;
    }
    return 'smsgateway://pair?' . http_build_query($params);
}

/** @return array{id:int,user_id:int,device_name:string,phone_number:string,pairing_expires:string}|null */
function pairing_lookup_pending(string $code): ?array {
    $code = strtoupper(trim($code));
    if ($code === '' || strlen($code) !== 8) {
        return null;
    }
    $con = db_connect();
    $stmt = $con->prepare(
        'SELECT id, user_id, device_name, phone_number, pairing_expires
         FROM user_devices
         WHERE pairing_code = ? AND pairing_expires > NOW() AND device_token IS NULL AND is_active = 1
         LIMIT 1'
    );
    $stmt->bind_param('s', $code);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    $con->close();
    return $row ?: null;
}

function pairing_public_validate(string $code, string $sig): ?array {
    if (!pairing_verify_sig($code, $sig)) {
        return null;
    }
    return pairing_lookup_pending($code);
}

function pairing_rate_limit(string $bucket, int $max = 20, int $window = 300): bool {
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $file = sys_get_temp_dir() . '/smsgw_rl_' . md5($bucket . '|' . $ip);
    $now  = time();
    $data = ['count' => 0, 'window' => $now];
    if (is_file($file)) {
        $decoded = json_decode((string)file_get_contents($file), true);
        if (is_array($decoded)) {
            $data = $decoded;
        }
    }
    if ($now - (int)($data['window'] ?? 0) > $window) {
        $data = ['count' => 0, 'window' => $now];
    }
    $data['count'] = (int)($data['count'] ?? 0) + 1;
    file_put_contents($file, json_encode($data), LOCK_EX);
    return $data['count'] <= $max;
}

function pairing_rate_limit_or_fail(string $bucket, int $max = 20, int $window = 300): void {
    if (!pairing_rate_limit($bucket, $max, $window)) {
        json_response([
            'status'  => 'error',
            'message' => 'Demasiadas tentativas. Aguarde alguns minutos e tente novamente.',
        ], 429);
    }
}

/** @return array{id:int,name:string,email:string,api_key:string,role:string}|null */
function current_user(): ?array {
    if (empty($_SESSION['user_id'])) return null;
    static $cached = null;
    if ($cached !== null) return $cached;

    $con = db_connect();
    $stmt = $con->prepare(
        'SELECT id, name, email, api_key, role, is_active,
                webhook_enabled, webhook_url, webhook_api_key, webhook_auto
         FROM users WHERE id = ?'
    );
    $uid = (int)$_SESSION['user_id'];
    $stmt->bind_param('i', $uid);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    $con->close();
    $cached = $row ?: null;
    return $cached;
}

function require_login(): array {
    $user = current_user();
    if (!$user) {
        json_response(['status' => 'error', 'message' => 'Não autenticado.'], 401);
    }
    if (!(int)($user['is_active'] ?? 0)) {
        json_response(['status' => 'error', 'message' => 'Conta desactivada. Contacte o administrador.'], 403);
    }
    return $user;
}

function is_admin(?array $user = null): bool {
    $user = $user ?? current_user();
    return $user && ($user['role'] ?? 'user') === 'admin';
}

function require_admin(): array {
    $user = require_login();
    if (!is_admin($user)) {
        json_response(['status' => 'error', 'message' => 'Acesso reservado a administradores.'], 403);
    }
    return $user;
}

/** @return array{id:int,user_id:int,device_name:string,phone_number:string}|null */
function device_from_token(string $token): ?array {
    if ($token === '') return null;
    $con = db_connect();
    $stmt = $con->prepare(
        'SELECT id, user_id, device_name, phone_number FROM user_devices
         WHERE device_token = ? AND is_active = 1 LIMIT 1'
    );
    $stmt->bind_param('s', $token);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    $con->close();
    return $row ?: null;
}

function require_device(): array {
    $token = $_SERVER['HTTP_X_DEVICE_TOKEN']
        ?? $_GET['device_token']
        ?? $_POST['device_token']
        ?? '';
    $device = device_from_token(trim($token));
    if (!$device) {
        json_response(['status' => 'error', 'message' => 'Dispositivo não autorizado. Registe o aparelho no painel.'], 401);
    }
    return $device;
}

/** @return array{id:int,name:string,email:string,api_key:string}|null */
function user_from_api_key(string $key): ?array {
    if ($key === '') return null;
    $con = db_connect();
    $stmt = $con->prepare(
        'SELECT id, name, email, api_key, role, is_active FROM users WHERE api_key = ? AND is_active = 1 LIMIT 1'
    );
    $stmt->bind_param('s', $key);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    $con->close();
    return $row ?: null;
}

function require_api_key(): array {
    $key = $_SERVER['HTTP_X_API_KEY']
        ?? $_GET['api_key']
        ?? $_POST['api_key']
        ?? '';
    $user = user_from_api_key(trim($key));
    if (!$user) {
        json_response(['status' => 'error', 'message' => 'API key inválida.'], 401);
    }
    return $user;
}

function touch_device(int $device_id): void {
    $con = db_connect();
    $stmt = $con->prepare('UPDATE user_devices SET last_seen = NOW() WHERE id = ?');
    $stmt->bind_param('i', $device_id);
    $stmt->execute();
    $stmt->close();
    $con->close();
}

/** @return 'ok'|'invalid'|'inactive' */
function login_user(string $email, string $password): string {
    $con = db_connect();
    $stmt = $con->prepare('SELECT id, password, is_active FROM users WHERE email = ? LIMIT 1');
    $stmt->bind_param('s', $email);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    $con->close();

    if (!$row) return 'invalid';

    $valid = password_verify($password, $row['password'])
        || ($row['password'] === $password); // legado plain-text

    if (!$valid) return 'invalid';

    if (!(int)($row['is_active'] ?? 0)) return 'inactive';

    $_SESSION['user_id'] = (int)$row['id'];

    if ($row['password'] === $password && !str_starts_with($row['password'], '$2y$')) {
        $con = db_connect();
        $hash = password_hash($password, PASSWORD_BCRYPT);
        $stmt = $con->prepare('UPDATE users SET password = ? WHERE id = ?');
        $stmt->bind_param('si', $hash, $row['id']);
        $stmt->execute();
        $stmt->close();
        $con->close();
    }

    return 'ok';
}

function logout_user(): void {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();
}