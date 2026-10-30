<?php
/**
 * api.php — API autenticada do Dashboard (sessão PHP)
 */
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/webhook.php';
json_headers();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit;

$action = $_GET['action'] ?? 'stats';
$user   = require_login();
$uid    = (int) $user['id'];
$con    = db_connect();

switch ($action) {

    case 'me':
        json_response([
            'status' => 'success',
            'user'   => [
                'id'                 => $uid,
                'name'               => $user['name'],
                'email'              => $user['email'],
                'api_key'            => $user['api_key'],
                'role'               => $user['role'] ?? 'user',
                'is_admin'           => is_admin($user),
                'can_webhook'        => user_webhook_allowed($user),
                'webhook_enabled'    => (int)($user['webhook_enabled'] ?? 0),
                'webhook_auto'       => (int)($user['webhook_auto'] ?? 0),
                'webhook_configured' => trim($user['webhook_url'] ?? '') !== '',
                'webhook_url'        => $user['webhook_url'] ?? '',
                'webhook_api_key'    => mask_webhook_key($user['webhook_api_key'] ?? ''),
            ],
        ]);
        break;

    /* ── Gestão de utilizadores (admin) ───────────────── */
    case 'users':
        require_admin();
        $res = $con->query(
            "SELECT u.id, u.name, u.email, u.role, u.is_active, u.webhook_enabled, u.created_at,
                    (SELECT COUNT(*) FROM user_devices d WHERE d.user_id = u.id AND d.is_active = 1) AS devices,
                    (SELECT COUNT(*) FROM sms_received s WHERE s.user_id = u.id) AS sms_count
             FROM users u ORDER BY u.created_at DESC"
        );
        $users = $res ? $res->fetch_all(MYSQLI_ASSOC) : [];
        json_response(['status' => 'success', 'data' => $users]);
        break;

    case 'create_user':
        require_admin();
        $name  = trim($_POST['name']  ?? $_GET['name']  ?? '');
        $email = trim($_POST['email'] ?? $_GET['email'] ?? '');
        $pass  = $_POST['password'] ?? $_GET['password'] ?? '';
        $role  = ($_POST['role'] ?? $_GET['role'] ?? 'user') === 'admin' ? 'admin' : 'user';

        if ($name === '' || $email === '' || $pass === '') {
            json_response(['status' => 'error', 'message' => 'Nome, email e palavra-passe são obrigatórios.'], 400);
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            json_response(['status' => 'error', 'message' => 'Email inválido.'], 400);
        }
        if (strlen($pass) < 6) {
            json_response(['status' => 'error', 'message' => 'A palavra-passe deve ter pelo menos 6 caracteres.'], 400);
        }

        $chk = $con->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
        $chk->bind_param('s', $email);
        $chk->execute();
        if ($chk->get_result()->num_rows > 0) {
            $chk->close();
            json_response(['status' => 'error', 'message' => 'Este email já está registado.'], 409);
        }
        $chk->close();

        $hash    = password_hash($pass, PASSWORD_BCRYPT);
        $api_key = generate_token(32);
        $inactive = 0;
        $stmt = $con->prepare(
            'INSERT INTO users (name, email, password, api_key, role, is_active) VALUES (?, ?, ?, ?, ?, ?)'
        );
        $stmt->bind_param('sssssi', $name, $email, $hash, $api_key, $role, $inactive);

        if ($stmt->execute()) {
            json_response([
                'status'  => 'success',
                'message' => "Utilizador $name criado. Active a conta para permitir o login.",
                'id'      => $con->insert_id,
            ]);
        }
        json_response(['status' => 'error', 'message' => 'Erro ao criar utilizador.'], 500);
        break;

    case 'toggle_user':
        require_admin();
        $target_id = (int)($_GET['id'] ?? $_POST['id'] ?? 0);
        $active    = (int)($_GET['active'] ?? $_POST['active'] ?? 1) ? 1 : 0;

        if ($target_id <= 0) {
            json_response(['status' => 'error', 'message' => 'ID inválido.'], 400);
        }
        if ($target_id === $uid && !$active) {
            json_response(['status' => 'error', 'message' => 'Não pode desactivar a sua própria conta.'], 400);
        }

        $stmt = $con->prepare('UPDATE users SET is_active = ? WHERE id = ?');
        $stmt->bind_param('ii', $active, $target_id);
        $stmt->execute();
        $stmt->close();

        json_response([
            'status'  => 'success',
            'message' => $active ? 'Utilizador activado.' : 'Utilizador desactivado.',
        ]);
        break;

    case 'toggle_webhook_profile':
        require_admin();
        $target_id = (int)($_GET['id'] ?? $_POST['id'] ?? 0);
        $enabled   = (int)($_GET['enabled'] ?? $_POST['enabled'] ?? 1) ? 1 : 0;

        if ($target_id <= 0) {
            json_response(['status' => 'error', 'message' => 'ID inválido.'], 400);
        }

        $chk = $con->prepare('SELECT id, role FROM users WHERE id = ? LIMIT 1');
        $chk->bind_param('i', $target_id);
        $chk->execute();
        $target = $chk->get_result()->fetch_assoc();
        $chk->close();

        if (!$target) {
            json_response(['status' => 'error', 'message' => 'Utilizador não encontrado.'], 404);
        }
        if (($target['role'] ?? 'user') !== 'user') {
            json_response(['status' => 'error', 'message' => 'O perfil webhook só pode ser gerido para utilizadores (não administradores).'], 400);
        }

        $stmt = $con->prepare('UPDATE users SET webhook_enabled = ? WHERE id = ? AND role = ?');
        $role = 'user';
        $stmt->bind_param('iis', $enabled, $target_id, $role);
        $stmt->execute();
        $stmt->close();

        json_response([
            'status'  => 'success',
            'message' => $enabled ? 'Perfil webhook activado.' : 'Perfil webhook desactivado.',
        ]);
        break;

    case 'webhook_settings':
        if (!user_webhook_allowed($user)) {
            json_response(['status' => 'error', 'message' => 'Perfil webhook desactivado. Contacte o administrador.'], 403);
        }
        json_response([
            'status' => 'success',
            'data'   => [
                'webhook_url'        => $user['webhook_url'] ?? '',
                'webhook_api_key'    => mask_webhook_key($user['webhook_api_key'] ?? ''),
                'webhook_auto'       => (int)($user['webhook_auto'] ?? 0),
                'webhook_configured' => trim($user['webhook_url'] ?? '') !== '',
            ],
        ]);
        break;

    case 'save_webhook':
        if (!user_webhook_allowed($user)) {
            json_response(['status' => 'error', 'message' => 'Perfil webhook desactivado. Contacte o administrador.'], 403);
        }

        $url  = trim($_POST['webhook_url'] ?? $_GET['webhook_url'] ?? '');
        $key  = trim($_POST['webhook_api_key'] ?? $_GET['webhook_api_key'] ?? '');
        $auto = (int)($_POST['webhook_auto'] ?? $_GET['webhook_auto'] ?? 0) ? 1 : 0;
        $keep_key = ($key === '' || str_contains($key, '*'));

        if ($url !== '' && !filter_var($url, FILTER_VALIDATE_URL)) {
            json_response(['status' => 'error', 'message' => 'URL do webhook inválido.'], 400);
        }

        if ($keep_key) {
            $stmt = $con->prepare('UPDATE users SET webhook_url = ?, webhook_auto = ? WHERE id = ?');
            $stmt->bind_param('sii', $url, $auto, $uid);
        } else {
            $stmt = $con->prepare('UPDATE users SET webhook_url = ?, webhook_api_key = ?, webhook_auto = ? WHERE id = ?');
            $stmt->bind_param('ssii', $url, $key, $auto, $uid);
        }
        $stmt->execute();
        $stmt->close();

        json_response(['status' => 'success', 'message' => 'Configuração webhook guardada.']);
        break;

    case 'test_webhook':
        if (!user_webhook_allowed($user)) {
            json_response(['status' => 'error', 'message' => 'Perfil webhook desactivado.'], 403);
        }

        $config = get_user_webhook_config($con, $uid);
        if (!$config || trim($config['webhook_url'] ?? '') === '') {
            json_response(['status' => 'error', 'message' => 'Configure o URL do webhook primeiro.'], 400);
        }

        $result = send_sms_webhook($config, [
            'phone_num'    => '+000000000',
            'message'      => 'Teste SMSGateway — webhook n8n',
            'datestamp'    => date('Y-m-d H:i:s'),
            'record_stamp' => date('Y-m-d H:i:s'),
            'device_id'    => null,
        ], 'webhook_test');

        if ($result['ok']) {
            json_response(['status' => 'success', 'message' => 'Webhook de teste enviado com sucesso.', 'http_code' => $result['http_code']]);
        }
        json_response(['status' => 'error', 'message' => $result['error'] ?? 'Falha no webhook', 'http_code' => $result['http_code'] ?? 0], 502);
        break;

    case 'forward_webhook':
        if (!user_webhook_allowed($user)) {
            json_response(['status' => 'error', 'message' => 'Perfil webhook desactivado. Contacte o administrador.'], 403);
        }

        $sms_id = (int)($_GET['id'] ?? $_POST['id'] ?? 0);
        if ($sms_id <= 0) {
            json_response(['status' => 'error', 'message' => 'ID de SMS inválido.'], 400);
        }

        $stmt = $con->prepare(
            'SELECT id, phone_num, message, datestamp, record_stamp, device_id
             FROM sms_received WHERE id = ? AND user_id = ? LIMIT 1'
        );
        $stmt->bind_param('ii', $sms_id, $uid);
        $stmt->execute();
        $sms = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if (!$sms) {
            json_response(['status' => 'error', 'message' => 'SMS não encontrado.'], 404);
        }

        $config = get_user_webhook_config($con, $uid);
        if (!$config || trim($config['webhook_url'] ?? '') === '') {
            json_response(['status' => 'error', 'message' => 'Configure o URL do webhook nas definições.'], 400);
        }

        $result = send_sms_webhook($config, $sms, 'sms_forward');
        update_sms_webhook_status($con, $sms_id, $uid, $result['ok'], $result['error'] ?? null);

        if ($result['ok']) {
            json_response(['status' => 'success', 'message' => 'SMS reenviado para o webhook n8n.', 'http_code' => $result['http_code']]);
        }
        json_response(['status' => 'error', 'message' => $result['error'] ?? 'Falha ao reenviar', 'http_code' => $result['http_code'] ?? 0], 502);
        break;

    case 'regenerate_api_key':
        $new_key = generate_token(32);
        $stmt = $con->prepare('UPDATE users SET api_key = ? WHERE id = ?');
        $stmt->bind_param('si', $new_key, $uid);
        $stmt->execute();
        $stmt->close();
        json_response(['status' => 'success', 'api_key' => $new_key]);
        break;

    /* ── Stats (escopo do utilizador) ─────────────────── */
    case 'stats':
        $stmt = $con->prepare('SELECT COUNT(*) FROM sms_received WHERE user_id = ?');
        $stmt->bind_param('i', $uid);
        $stmt->execute();
        $total_sms = (int)$stmt->get_result()->fetch_row()[0];
        $stmt->close();

        $stmt = $con->prepare(
            "SELECT COUNT(*) FROM sms_received WHERE user_id = ? AND DATE(record_stamp) = CURDATE()"
        );
        $stmt->bind_param('i', $uid);
        $stmt->execute();
        $today_sms = (int)$stmt->get_result()->fetch_row()[0];
        $stmt->close();

        $stmt = $con->prepare('SELECT COUNT(*) FROM user_devices WHERE user_id = ? AND is_active = 1');
        $stmt->bind_param('i', $uid);
        $stmt->execute();
        $total_devices = (int)$stmt->get_result()->fetch_row()[0];
        $stmt->close();

        $stmt = $con->prepare('SELECT COUNT(DISTINCT phone_num) FROM sms_received WHERE user_id = ?');
        $stmt->bind_param('i', $uid);
        $stmt->execute();
        $unique_numbers = (int)$stmt->get_result()->fetch_row()[0];
        $stmt->close();

        foreach (['pending', 'sent', 'failed'] as $st) {
            $stmt = $con->prepare("SELECT COUNT(*) FROM sms_queue WHERE user_id = ? AND status = ?");
            $stmt->bind_param('is', $uid, $st);
            $stmt->execute();
            ${'queue_' . $st} = (int)$stmt->get_result()->fetch_row()[0];
            $stmt->close();
        }

        $device_online = false;
        $last_seen = null;
        $seconds_since_poll = null;
        $dev_res = $con->prepare(
            "SELECT MAX(last_seen) AS ls,
                    MIN(TIMESTAMPDIFF(SECOND, last_seen, NOW())) AS secs
             FROM user_devices WHERE user_id = ? AND is_active = 1 AND last_seen IS NOT NULL"
        );
        $dev_res->bind_param('i', $uid);
        $dev_res->execute();
        if ($row = $dev_res->get_result()->fetch_assoc()) {
            $last_seen = $row['ls'];
            if ($row['secs'] !== null) {
                $seconds_since_poll = (int)$row['secs'];
                $device_online = $seconds_since_poll <= 30;
            }
        }
        $dev_res->close();

        $recent_stmt = $con->prepare(
            "SELECT id, phone_num, message, datestamp, record_stamp FROM sms_received
             WHERE user_id = ? ORDER BY record_stamp DESC LIMIT 5"
        );
        $recent_stmt->bind_param('i', $uid);
        $recent_stmt->execute();
        $recent = $recent_stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $recent_stmt->close();

        json_response([
            'total_sms'          => $total_sms,
            'today_sms'          => $today_sms,
            'total_devices'      => $total_devices,
            'unique_numbers'     => $unique_numbers,
            'queue_pending'      => $queue_pending,
            'queue_sent'         => $queue_sent,
            'queue_failed'       => $queue_failed,
            'device_online'      => $device_online,
            'device_last_seen'   => $last_seen,
            'seconds_since_poll' => $seconds_since_poll,
            'recent'             => $recent,
            'server_time'        => date('d/m/Y H:i:s'),
        ]);
        break;

    /* ── SMS recebidos ────────────────────────────────── */
    case 'sms':
        $page   = max(1, (int)($_GET['page'] ?? 1));
        $limit  = min(50, max(10, (int)($_GET['limit'] ?? 20)));
        $offset = ($page - 1) * $limit;
        $q      = trim($_GET['q'] ?? '');
        $sort_by = $_GET['sort_by'] ?? 'received';
        $order   = strtolower($_GET['order'] ?? 'desc');
        $columns = ['received' => 'record_stamp', 'date' => 'datestamp', 'phone' => 'phone_num'];
        $col     = $columns[$sort_by] ?? 'record_stamp';
        $dir     = $order === 'asc' ? 'ASC' : 'DESC';

        if ($q !== '') {
            $like = "%$q%";
            $cnt = $con->prepare(
                'SELECT COUNT(*) FROM sms_received WHERE user_id = ? AND (phone_num LIKE ? OR message LIKE ?)'
            );
            $cnt->bind_param('iss', $uid, $like, $like);
            $cnt->execute();
            $total = (int)$cnt->get_result()->fetch_row()[0];
            $cnt->close();

            $sql = "SELECT * FROM sms_received WHERE user_id = ? AND (phone_num LIKE ? OR message LIKE ?)
                    ORDER BY $col $dir, id $dir LIMIT ? OFFSET ?";
            $stmt = $con->prepare($sql);
            $stmt->bind_param('issii', $uid, $like, $like, $limit, $offset);
        } else {
            $cnt = $con->prepare('SELECT COUNT(*) FROM sms_received WHERE user_id = ?');
            $cnt->bind_param('i', $uid);
            $cnt->execute();
            $total = (int)$cnt->get_result()->fetch_row()[0];
            $cnt->close();

            $sql = "SELECT * FROM sms_received WHERE user_id = ? ORDER BY $col $dir, id $dir LIMIT ? OFFSET ?";
            $stmt = $con->prepare($sql);
            $stmt->bind_param('iii', $uid, $limit, $offset);
        }

        $stmt->execute();
        $data = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt->close();

        json_response([
            'data'    => $data,
            'total'   => $total,
            'page'    => $page,
            'pages'   => max(1, (int)ceil($total / $limit)),
            'sort_by' => array_search($col, $columns, true) ?: 'received',
            'order'   => strtolower($dir),
        ]);
        break;

    /* ── SMS enviados (fila outbound) ─────────────────── */
    case 'sent':
        $page   = max(1, (int)($_GET['page'] ?? 1));
        $limit  = min(50, max(10, (int)($_GET['limit'] ?? 20)));
        $offset = ($page - 1) * $limit;
        $status = $_GET['status'] ?? 'all';
        $allowed = ['all', 'pending', 'sent', 'failed'];
        if (!in_array($status, $allowed, true)) $status = 'all';

        if ($status === 'all') {
            $cnt = $con->prepare('SELECT COUNT(*) FROM sms_queue WHERE user_id = ?');
            $cnt->bind_param('i', $uid);
            $cnt->execute();
            $total = (int)$cnt->get_result()->fetch_row()[0];
            $cnt->close();

            $stmt = $con->prepare(
                'SELECT * FROM sms_queue WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
            );
            $stmt->bind_param('iii', $uid, $limit, $offset);
        } else {
            $cnt = $con->prepare('SELECT COUNT(*) FROM sms_queue WHERE user_id = ? AND status = ?');
            $cnt->bind_param('is', $uid, $status);
            $cnt->execute();
            $total = (int)$cnt->get_result()->fetch_row()[0];
            $cnt->close();

            $stmt = $con->prepare(
                'SELECT * FROM sms_queue WHERE user_id = ? AND status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
            );
            $stmt->bind_param('isii', $uid, $status, $limit, $offset);
        }

        $stmt->execute();
        $data = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt->close();

        json_response([
            'data'  => $data,
            'total' => $total,
            'page'  => $page,
            'pages' => max(1, (int)ceil($total / $limit)),
        ]);
        break;

    /* ── Dispositivos ─────────────────────────────────── */
    case 'devices':
        $stmt = $con->prepare(
            'SELECT id, device_name, phone_number, last_seen, is_active, created_at,
                    CASE WHEN last_seen IS NOT NULL AND TIMESTAMPDIFF(SECOND, last_seen, NOW()) <= 30
                         THEN 1 ELSE 0 END AS online
             FROM user_devices WHERE user_id = ? ORDER BY created_at DESC'
        );
        $stmt->bind_param('i', $uid);
        $stmt->execute();
        $devices = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt->close();
        json_response(['status' => 'success', 'data' => $devices]);
        break;

    case 'create_pairing':
        $name  = trim($_POST['device_name'] ?? $_GET['device_name'] ?? 'Android');
        $phone = trim($_POST['phone_number'] ?? $_GET['phone_number'] ?? '');
        $code  = generate_pairing_code();

        $stmt = $con->prepare(
            'INSERT INTO user_devices (user_id, pairing_code, pairing_expires, device_name, phone_number)
             VALUES (?, ?, NOW() + INTERVAL 30 MINUTE, ?, ?)'
        );
        $stmt->bind_param('isss', $uid, $code, $name, $phone);
        if ($stmt->execute()) {
            json_response([
                'status'       => 'success',
                'pairing_code' => $code,
                'expires_in'   => 1800,
                'id'           => $con->insert_id,
                'pairing_url'  => pairing_build_url($code, $name, $phone),
                'deep_link'    => pairing_deep_link($code, $name, $phone),
                'signature'    => pairing_signature($code),
                'apk_url'      => app_base_url() . '/pair_download.php?' . http_build_query([
                    'code' => $code,
                    'sig'  => pairing_signature($code),
                ]),
            ]);
        }
        json_response(['status' => 'error', 'message' => $con->error], 500);
        break;

    case 'delete_device':
        $id = (int)($_GET['id'] ?? 0);
        $stmt = $con->prepare('UPDATE user_devices SET is_active = 0 WHERE id = ? AND user_id = ?');
        $stmt->bind_param('ii', $id, $uid);
        $stmt->execute();
        json_response(['status' => 'success', 'message' => 'Dispositivo desactivado']);
        break;

    /* ── Enviar SMS (dashboard) ───────────────────────── */
    case 'send':
        $phone = trim($_GET['phone'] ?? $_POST['phone'] ?? '');
        $msg   = trim($_GET['msg']   ?? $_POST['msg']   ?? '');

        if (!$phone || !$msg) {
            json_response(['status' => 'error', 'message' => 'Os campos phone e msg são obrigatórios.'], 400);
        }

        $stmt = $con->prepare('INSERT INTO sms_queue (user_id, phone, message) VALUES (?, ?, ?)');
        $stmt->bind_param('iss', $uid, $phone, $msg);

        if ($stmt->execute()) {
            json_response([
                'status'  => 'success',
                'message' => 'SMS na fila! O dispositivo Android enviará em breve.',
                'id'      => $con->insert_id,
            ]);
        }
        json_response(['status' => 'error', 'message' => 'Erro ao guardar: ' . $con->error], 500);
        break;

    default:
        json_response(['error' => 'Acção inválida'], 400);
}

$con->close();