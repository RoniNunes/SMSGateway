<?php
/**
 * cli_wait_db.php — Aguarda MySQL (usado no entrypoint Docker)
 */
require_once __DIR__ . '/config.php';

$max     = (int)(getenv('WAIT_DB_ATTEMPTS') ?: 90);
$host    = DB_HOST;
$lastErr = '';

$mode = (getenv('ALL_IN_ONE') === '1' || getenv('ALL_IN_ONE') === 'true') ? 'all-in-one' : 'compose';
fwrite(STDOUT, "[wait-db] modo={$mode} Host={$host} DB=" . DB_NAME . " USER=" . DB_USER . "\n");
if ($host === 'mysql-global' && $mode !== 'all-in-one') {
    fwrite(STDERR, "[wait-db] AVISO: mysql-global inacessível — use compose.all-in-one.yaml ou corrija DB_HOST\n");
}

for ($i = 1; $i <= $max; $i++) {
    try {
        mysqli_report(MYSQLI_REPORT_OFF);
        $con = @new mysqli($host, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT);
        if (!$con->connect_error) {
            $con->close();
            fwrite(STDOUT, "[wait-db] MySQL disponível (tentativa $i)\n");
            exit(0);
        }
        $lastErr = $con->connect_error;
    } catch (Throwable $e) {
        $lastErr = $e->getMessage();
    }

    if ($i === 1 || $i % 5 === 0 || $i === $max) {
        fwrite(STDOUT, "[wait-db] A aguardar MySQL... ($i/$max) — {$lastErr}\n");
    } else {
        fwrite(STDOUT, "[wait-db] A aguardar MySQL... ($i/$max)\n");
    }
    sleep(2);
}

fwrite(STDERR, "[wait-db] TIMEOUT — não foi possível ligar a MySQL em '{$host}'\n");
fwrite(STDERR, "[wait-db] Último erro: {$lastErr}\n");
fwrite(STDERR, "[wait-db]\n");
fwrite(STDERR, "[wait-db] Verifique:\n");
if ($host === 'db') {
    fwrite(STDERR, "[wait-db]  ERRO COMUM EasyPanel: está a usar imagem web-only à espera de host 'db'\n");
    fwrite(STDERR, "[wait-db]  SOLUÇÃO: apague o serviço, faça upload do ZIP novo, use docker-compose.yml\n");
    fwrite(STDERR, "[wait-db]  Deve ver nos logs: modo=all-in-one Host=127.0.0.1\n");
    fwrite(STDERR, "[wait-db]  Remova DB_HOST do Environment do EasyPanel\n");
} else {
    fwrite(STDERR, "[wait-db]  1) DB_PASSWORD correcta\n");
    fwrite(STDERR, "[wait-db]  2) MySQL externo: DB_HOST = hostname interno (não 'db')\n");
    fwrite(STDERR, "[wait-db]  3) Recomendado: 1 container (docker-compose.yml) sem MySQL separado\n");
}
exit(1);