<?php
/**
 * reg_device.php
 * Regista o token FCM de um dispositivo Android.
 *
 * GET /reg_device.php?Token=<fcm_token>
 */
require_once 'config.php';

$token = trim($_GET['Token'] ?? '');

if ($token === '') {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Parâmetro "Token" é obrigatório.']);
    exit;
}

if (strlen($token) > 255) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Token inválido.']);
    exit;
}

$con = db_connect();

$stmt = $con->prepare(
    'INSERT INTO registered_devices (device, type) VALUES (?, "sms")
     ON DUPLICATE KEY UPDATE device = VALUES(device), created_at = CURRENT_TIMESTAMP'
);
$stmt->bind_param('s', $token);

if ($stmt->execute()) {
    $action = $stmt->affected_rows === 1 ? 'registrado' : 'atualizado';
    $stmt->close();
    $con->close();
    echo json_encode(['status' => 'success', 'message' => "Dispositivo $action."]);
} else {
    $stmt->close();
    $con->close();
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Erro ao registrar dispositivo.']);
}
