<?php
/**
 * apk_info.php — Metadados do APK para o painel
 */
require_once __DIR__ . '/auth.php';
json_headers();

$user = require_login();
$file = __DIR__ . '/SMSGateway.apk';

json_response([
    'status'      => 'success',
    'available'   => is_file($file),
    'filename'    => 'SMSGateway.apk',
    'size_bytes'  => is_file($file) ? filesize($file) : 0,
    'size_human'  => is_file($file) ? round(filesize($file) / 1024 / 1024, 1) . ' MB' : null,
    'updated_at'  => is_file($file) ? date('d/m/Y H:i', filemtime($file)) : null,
    'download_url'=> 'download.php',
]);