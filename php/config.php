<?php
/**
 * config.php — Configuração centralizada
 */

define('DB_NAME',       getenv('DB_NAME')       ?: 'smsgateway');
define('DB_USER',       getenv('DB_USER')       ?: 'smsuser');
define('DB_PASSWORD',   getenv('DB_PASSWORD')   ?: 'smspassword');
define('DB_PORT',       (int)(getenv('DB_PORT') ?: 3306));

/** Host MySQL — evita socket Unix de "localhost" (erro: No such file or directory) */
function db_host(): string {
    $allInOne = getenv('ALL_IN_ONE');
    if ($allInOne === '1' || $allInOne === 'true') {
        return '127.0.0.1';
    }
    $host = trim(getenv('DB_HOST') ?: '');
    if ($host === '' || $host === 'localhost') {
        $host = file_exists('/.dockerenv') ? 'db' : '127.0.0.1';
    }
    return $host;
}

define('DB_HOST', db_host());
define('HTTP_PORT',     (int)(getenv('HTTP_PORT') ?: getenv('PORT') ?: 80));
define('APP_URL',       rtrim(getenv('APP_URL') ?: '', '/'));
define('MIGRATE_KEY',   getenv('MIGRATE_KEY')   ?: 'setup2026');
define('APP_ENV',       getenv('APP_ENV')       ?: 'production');

function request_is_https(): bool {
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
}

function app_base_url(): string {
    if (APP_URL !== '') return APP_URL;
    $scheme = request_is_https() ? 'https' : 'http';
    $host   = getenv('APP_HOST') ?: ($_SERVER['HTTP_HOST'] ?? 'localhost');
    $host   = preg_replace('/:\d+$/', '', $host);
    $port   = HTTP_PORT;
    if (($scheme === 'http' && $port === 80) || ($scheme === 'https' && $port === 443)) {
        return $scheme . '://' . $host;
    }
    return $scheme . '://' . $host . ':' . $port;
}

function db_connect(): mysqli {
    $con = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT);
    if ($con->connect_error) {
        http_response_code(500);
        echo json_encode([
            'status'  => 'error',
            'message' => 'Erro de conexão com o banco de dados: ' . $con->connect_error
        ]);
        exit;
    }
    $con->set_charset('utf8mb4');
    $con->query("SET time_zone = '+00:00'");
    return $con;
}

function json_headers(): void {
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, X-Device-Token, X-Api-Key');
}

function json_response(array $data, int $code = 200): void {
    json_headers();
    http_response_code($code);
    echo json_encode($data);
    exit;
}