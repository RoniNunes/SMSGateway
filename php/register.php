<?php
/**
 * register.php — Registo de dispositivo Android via código de pareamento
 *
 * POST/GET ?code=ABC12345&name=Galaxy S21&phone=+34600000000
 */
require_once __DIR__ . '/auth.php';
json_headers();

$code  = strtoupper(trim($_GET['code'] ?? $_POST['code'] ?? ''));
$sig   = trim($_GET['sig'] ?? $_POST['sig'] ?? '');
$name  = trim($_GET['name'] ?? $_POST['name'] ?? 'Android');
$phone = trim($_GET['phone'] ?? $_POST['phone'] ?? '');

if ($code === '') {
    json_response(['status' => 'error', 'message' => 'Código de pareamento obrigatório.'], 400);
}
if (strlen($code) !== 8 || !ctype_alnum($code)) {
    json_response(['status' => 'error', 'message' => 'Código de pareamento inválido.'], 400);
}

pairing_rate_limit_or_fail('register', 25, 300);

if ($sig !== '' && !pairing_verify_sig($code, $sig)) {
    json_response(['status' => 'error', 'message' => 'Assinatura de pareamento inválida.'], 403);
}

$row = pairing_lookup_pending($code);
if (!$row) {
    json_response(['status' => 'error', 'message' => 'Código inválido ou expirado. Gere um novo no painel.'], 404);
}

$con = db_connect();

$token = generate_token(32);
$did   = (int)$row['id'];
if ($name === '' || $name === 'Android') {
    $name = $row['device_name'] ?? 'Android';
}
if ($phone === '') {
    $phone = $row['phone_number'] ?? '';
}

$stmt = $con->prepare(
    'UPDATE user_devices SET device_token = ?, pairing_code = NULL, pairing_expires = NULL,
     device_name = ?, phone_number = IF(? = "", phone_number, ?)
     WHERE id = ? AND pairing_code = ? AND device_token IS NULL'
);
$stmt->bind_param('ssssis', $token, $name, $phone, $phone, $did, $code);
$stmt->execute();
$affected = $stmt->affected_rows;
$stmt->close();
$con->close();

if ($affected < 1) {
    json_response(['status' => 'error', 'message' => 'Código já utilizado ou expirado. Gere um novo no painel.'], 409);
}

json_response([
    'status'       => 'success',
    'device_token' => $token,
    'device_id'    => $did,
    'message'      => 'Dispositivo registado com sucesso.',
]);