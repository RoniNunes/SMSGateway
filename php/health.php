<?php
/**
 * health.php
 * Endpoint de health check — verifica se o servidor e o banco estão operacionais.
 * GET /health.php
 */
require_once 'config.php';
json_headers();

$status = [
    'service'   => 'SMSGateway API',
    'version'   => '3.1.0',
    'env'       => APP_ENV,
    'timestamp' => date('Y-m-d H:i:s'),
    'php'       => PHP_VERSION,
    'database'  => 'error',
    'app_url'   => APP_URL !== '' ? APP_URL : 'not_configured',
    'apk'       => is_file(__DIR__ . '/SMSGateway.apk') ? 'available' : 'missing',
    'pairing'   => 'enabled',
    'https'     => request_is_https() ? 'yes' : 'no',
];

$con = @new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT);
if ($con->connect_error) {
    $status['database'] = 'error: ' . $con->connect_error;
    http_response_code(503);
} else {
    $con->set_charset('utf8mb4');
    $result = $con->query('SELECT COUNT(*) AS total FROM sms_received');
    if ($result) {
        $row = $result->fetch_assoc();
        $status['database'] = 'connected';
        $status['sms_count'] = (int)$row['total'];
        http_response_code(200);
    } else {
        $status['database'] = 'error: ' . $con->error;
        http_response_code(503);
    }
    $con->close();
}

echo json_encode($status, JSON_PRETTY_PRINT);
