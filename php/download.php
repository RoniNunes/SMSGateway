<?php
/**
 * download.php — Download do APK Android (requer login)
 */
require_once __DIR__ . '/auth.php';

$user = current_user();
if (!$user) {
    header('Location: login.php');
    exit;
}
if (!(int)($user['is_active'] ?? 0)) {
    http_response_code(403);
    die('Conta desactivada.');
}

$file = __DIR__ . '/SMSGateway.apk';
if (!is_file($file)) {
    http_response_code(404);
    die('APK não encontrado no servidor.');
}

header('Content-Type: application/vnd.android.package-archive');
header('Content-Disposition: attachment; filename="SMSGateway.apk"');
header('Content-Length: ' . filesize($file));
header('Cache-Control: no-cache');
readfile($file);
exit;