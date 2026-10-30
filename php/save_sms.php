<?php
/**
 * save_sms.php — Guardar SMS recebido (autenticado por device_token)
 */
require_once __DIR__ . '/auth.php';
json_headers();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_response(['status' => 'error', 'message' => 'Use GET.'], 405);
}

$device = require_device();
$uid    = (int) $device['user_id'];
$did    = (int) $device['id'];
touch_device($did);

$phone     = trim($_GET['phone']     ?? '');
$msg       = trim($_GET['msg']       ?? '');
$date      = trim($_GET['date']      ?? date('Y-m-d H:i:s'));
$date_sent = trim($_GET['date_sent'] ?? $date);

if ($phone === '' || $msg === '') {
    json_response(['status' => 'error', 'message' => 'phone e msg obrigatórios.'], 400);
}

$con = db_connect();

$stmt = $con->prepare(
    'SELECT id FROM sms_received WHERE user_id=? AND phone_num=? AND message=? AND datestamp=? LIMIT 1'
);
$stmt->bind_param('isss', $uid, $phone, $msg, $date);
$stmt->execute();
$stmt->store_result();

if ($stmt->num_rows > 0) {
    $stmt->close();
    $con->close();
    json_response(['status' => 'duplicate', 'message' => 'SMS já registado.']);
}
$stmt->close();

$empty = '';
$stmt = $con->prepare(
    'INSERT INTO sms_received (user_id, device_id, user, phone_num, message, datestamp, date_sent)
     VALUES (?, ?, ?, ?, ?, ?, ?)'
);
$stmt->bind_param('iisssss', $uid, $did, $empty, $phone, $msg, $date, $date_sent);

if ($stmt->execute()) {
    $id = $con->insert_id;
    $stmt->close();

    require_once __DIR__ . '/webhook.php';
    maybe_auto_forward_webhook($con, $uid, $id, [
        'phone_num'    => $phone,
        'message'      => $msg,
        'datestamp'    => $date,
        'record_stamp' => date('Y-m-d H:i:s'),
        'device_id'    => $did,
    ]);

    $con->close();
    json_response(['status' => 'success', 'message' => 'SMS salvo.', 'id' => $id]);
}

$stmt->close();
$con->close();
json_response(['status' => 'error', 'message' => 'Erro ao salvar SMS.'], 500);