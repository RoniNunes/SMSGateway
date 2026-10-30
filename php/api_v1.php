<?php
/**
 * api_v1.php — API pública com API Key
 *
 * Enviar:  GET/POST ?action=send&api_key=X&phone=Y&msg=Z
 * Estado: GET      ?action=status&api_key=X&id=N
 */
require_once __DIR__ . '/auth.php';
json_headers();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit;

$user = require_api_key();
$uid  = (int) $user['id'];
$con  = db_connect();
$action = $_GET['action'] ?? $_POST['action'] ?? 'send';

switch ($action) {

    case 'send':
        $phone = trim($_GET['phone'] ?? $_POST['phone'] ?? '');
        $msg   = trim($_GET['msg']   ?? $_POST['msg']   ?? '');

        if (!$phone || !$msg) {
            json_response(['status' => 'error', 'message' => 'Parâmetros phone e msg obrigatórios.'], 400);
        }

        $stmt = $con->prepare('INSERT INTO sms_queue (user_id, phone, message) VALUES (?, ?, ?)');
        $stmt->bind_param('iss', $uid, $phone, $msg);

        if ($stmt->execute()) {
            json_response([
                'status'  => 'queued',
                'id'      => $con->insert_id,
                'message' => 'SMS adicionado à fila de envio.',
            ]);
        }
        json_response(['status' => 'error', 'message' => 'Erro ao enfileirar SMS.'], 500);
        break;

    case 'status':
        $id = (int)($_GET['id'] ?? $_POST['id'] ?? 0);
        if ($id <= 0) {
            json_response(['status' => 'error', 'message' => 'ID inválido.'], 400);
        }

        $stmt = $con->prepare(
            'SELECT id, phone, message, status, created_at, sent_at, error_msg
             FROM sms_queue WHERE id = ? AND user_id = ? LIMIT 1'
        );
        $stmt->bind_param('ii', $id, $uid);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if (!$row) {
            json_response(['status' => 'error', 'message' => 'SMS não encontrado.'], 404);
        }

        json_response([
            'status'     => 'success',
            'id'         => (int)$row['id'],
            'phone'      => $row['phone'],
            'message'    => $row['message'],
            'delivery'   => $row['status'],
            'created_at' => $row['created_at'],
            'sent_at'    => $row['sent_at'],
            'error'      => $row['error_msg'],
            'delivered'  => $row['status'] === 'sent',
        ]);
        break;

    default:
        json_response(['status' => 'error', 'message' => 'Acção inválida. Use send ou status.'], 400);
}

$con->close();