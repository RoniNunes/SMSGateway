<?php
/**
 * send_sms.php — Fila SMS (autenticada por device_token)
 */
require_once __DIR__ . '/auth.php';
json_headers();

$device = require_device();
$uid    = (int) $device['user_id'];
$did    = (int) $device['id'];
touch_device($did);

$action = $_GET['action'] ?? 'pending';
$con    = db_connect();

switch ($action) {

    case 'heartbeat':
        json_response(['status' => 'success', 'message' => 'ok', 'time' => date('Y-m-d H:i:s')]);
        break;

    case 'pending':
        $limit = min(20, max(1, (int)($_GET['limit'] ?? 10)));
        $stmt = $con->prepare(
            "SELECT id, phone, message FROM sms_queue
             WHERE user_id = ? AND status = 'pending' ORDER BY created_at ASC LIMIT ?"
        );
        $stmt->bind_param('ii', $uid, $limit);
        $stmt->execute();
        $pending = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt->close();
        json_response(['status' => 'success', 'data' => $pending, 'count' => count($pending)]);
        break;

    case 'sent':
        $id = (int)($_GET['id'] ?? 0);
        if ($id > 0) {
            $stmt = $con->prepare(
                "UPDATE sms_queue SET status='sent', sent_at=NOW(), device_id=?
                 WHERE id=? AND user_id=? AND status='pending'"
            );
            $stmt->bind_param('iii', $did, $id, $uid);
            $stmt->execute();
            $stmt->close();
        }
        json_response(['status' => 'success', 'message' => "SMS #$id marcado como enviado"]);
        break;

    case 'failed':
        $id  = (int)($_GET['id'] ?? 0);
        $err = substr(trim($_GET['error'] ?? 'Erro desconhecido'), 0, 500);
        if ($id > 0) {
            $stmt = $con->prepare(
                "UPDATE sms_queue SET status='failed', error_msg=?, device_id=?
                 WHERE id=? AND user_id=? AND status='pending'"
            );
            $stmt->bind_param('siii', $err, $did, $id, $uid);
            $stmt->execute();
            $stmt->close();
        }
        json_response(['status' => 'success', 'message' => "SMS #$id marcado como falhado"]);
        break;

    default:
        json_response(['error' => 'Acção inválida'], 400);
}

$con->close();