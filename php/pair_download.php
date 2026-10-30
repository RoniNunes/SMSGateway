<?php
/**
 * pair_download.php — Download do APK via link de pareamento assinado (sem login)
 */
require_once __DIR__ . '/auth.php';

$code = strtoupper(trim($_GET['code'] ?? ''));
$sig  = trim($_GET['sig'] ?? '');

pairing_rate_limit_or_fail('pair_download', 15, 300);

if (!pairing_public_validate($code, $sig)) {
    http_response_code(403);
    die('Link de pareamento inválido ou expirado.');
}

$file = __DIR__ . '/SMSGateway.apk';
if (!is_file($file)) {
    http_response_code(404);
    die('APK não disponível no servidor.');
}

header('Content-Type: application/vnd.android.package-archive');
header('Content-Disposition: attachment; filename="SMSGateway.apk"');
header('Content-Length: ' . filesize($file));
header('Cache-Control: no-store, no-cache, must-revalidate');
header('X-Content-Type-Options: nosniff');
readfile($file);
exit;