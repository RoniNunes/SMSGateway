<?php
/**
 * webhook.php — Reenvio de SMS recebidos para webhook n8n
 */
require_once __DIR__ . '/config.php';

function user_webhook_allowed(array $user): bool {
    if (($user['role'] ?? 'user') === 'admin') {
        return true;
    }
    return (int)($user['webhook_enabled'] ?? 0) === 1;
}

/** @return array{webhook_url:string,webhook_api_key:string,webhook_auto:int,webhook_enabled:int,role:string}|null */
function get_user_webhook_config(mysqli $con, int $user_id): ?array {
    $stmt = $con->prepare(
        'SELECT webhook_url, webhook_api_key, webhook_auto, webhook_enabled, role
         FROM users WHERE id = ? LIMIT 1'
    );
    $stmt->bind_param('i', $user_id);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    return $row ?: null;
}

function mask_webhook_key(?string $key): string {
    if ($key === null || $key === '') {
        return '';
    }
    if (strlen($key) <= 8) {
        return str_repeat('*', strlen($key));
    }
    return substr($key, 0, 4) . str_repeat('*', strlen($key) - 8) . substr($key, -4);
}

/** @param array{id?:int,phone_num:string,message:string,datestamp?:string,record_stamp?:string,device_id?:int|null} $sms */
function build_webhook_payload(array $sms, string $event = 'sms_received'): array {
    return [
        'event'        => $event,
        'sms_id'       => isset($sms['id']) ? (int)$sms['id'] : null,
        'phone'        => $sms['phone_num'] ?? '',
        'message'      => $sms['message'] ?? '',
        'datestamp'    => $sms['datestamp'] ?? null,
        'record_stamp' => $sms['record_stamp'] ?? null,
        'device_id'    => isset($sms['device_id']) ? (int)$sms['device_id'] : null,
        'forwarded_at' => date('Y-m-d H:i:s'),
    ];
}

/** @return array{ok:bool,http_code?:int,body?:string,error?:string} */
function send_sms_webhook(array $config, array $sms, string $event = 'sms_received'): array {
    $url = trim($config['webhook_url'] ?? '');
    if ($url === '') {
        return ['ok' => false, 'error' => 'Webhook URL não configurado'];
    }
    if (!filter_var($url, FILTER_VALIDATE_URL)) {
        return ['ok' => false, 'error' => 'Webhook URL inválido'];
    }

    $payload = json_encode(build_webhook_payload($sms, $event), JSON_UNESCAPED_UNICODE);
    if ($payload === false) {
        return ['ok' => false, 'error' => 'Erro ao preparar payload'];
    }

    $headers = ['Content-Type: application/json'];
    $api_key = trim($config['webhook_api_key'] ?? '');
    if ($api_key !== '') {
        $headers[] = 'X-Api-Key: ' . $api_key;
    }

    $context = stream_context_create([
        'http' => [
            'method'          => 'POST',
            'header'          => implode("\r\n", $headers),
            'content'         => $payload,
            'timeout'         => 15,
            'ignore_errors'   => true,
            'follow_location' => 0,
        ],
    ]);

    $body = @file_get_contents($url, false, $context);
    $http_code = 0;
    if (isset($http_response_header[0]) && preg_match('/\d{3}/', $http_response_header[0], $m)) {
        $http_code = (int)$m[0];
    }

    if ($body === false && $http_code === 0) {
        return ['ok' => false, 'error' => 'Erro de rede ao contactar webhook'];
    }

    if ($http_code < 200 || $http_code >= 300) {
        return [
            'ok'        => false,
            'error'     => 'Webhook respondeu com HTTP ' . $http_code,
            'http_code' => $http_code,
            'body'      => is_string($body) ? substr($body, 0, 500) : '',
        ];
    }

    return [
        'ok'        => true,
        'http_code' => $http_code,
        'body'      => is_string($body) ? substr($body, 0, 500) : '',
    ];
}

function update_sms_webhook_status(mysqli $con, int $sms_id, int $user_id, bool $ok, ?string $error = null): void {
    $status = $ok ? 'sent' : 'failed';
    $err = $error ? substr($error, 0, 500) : null;
    $stmt = $con->prepare(
        'UPDATE sms_received
         SET webhook_last_status = ?, webhook_last_error = ?, webhook_last_sent = NOW()
         WHERE id = ? AND user_id = ?'
    );
    $stmt->bind_param('ssii', $status, $err, $sms_id, $user_id);
    $stmt->execute();
    $stmt->close();
}

function maybe_auto_forward_webhook(mysqli $con, int $user_id, int $sms_id, array $sms_row): void {
    $config = get_user_webhook_config($con, $user_id);
    if (!$config) {
        return;
    }

    $user = [
        'role'            => $config['role'],
        'webhook_enabled' => $config['webhook_enabled'],
    ];
    if (!user_webhook_allowed($user)) {
        return;
    }
    if (!(int)($config['webhook_auto'] ?? 0)) {
        return;
    }

    $sms_row['id'] = $sms_id;
    $result = send_sms_webhook($config, $sms_row);
    update_sms_webhook_status($con, $sms_id, $user_id, $result['ok'], $result['error'] ?? null);
}