<?php
/**
 * save_sms0.php
 * Salva SMS recebidos no banco de dados.
 *
 * Uso: GET /save_sms0.php?phone=<numero>&msg=<mensagem>[&date=<data>&date_sent=<data_envio>]
 */

DEFINE('HOST', 'localhost');
DEFINE('USER', 'id2008008_atif');
DEFINE('PASSWORD', 'database');
DEFINE('DB', 'id2008008_trices');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Método não permitido"]);
    exit;
}

$phone = isset($_GET['phone']) ? $_GET['phone'] : '';
$msg   = isset($_GET['msg'])   ? $_GET['msg']   : '';
$user  = isset($_GET['user'])  ? $_GET['user']  : '';
$date      = isset($_GET['date'])      ? $_GET['date']      : '0000-00-00 00:00:00';
$date_sent = isset($_GET['date_sent']) ? $_GET['date_sent'] : '0000-00-00 00:00:00';

if ($phone === '' || $msg === '') {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Forneça phone e msg"]);
    exit;
}

$con = mysqli_connect(HOST, USER, PASSWORD, DB);
if (!$con) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Erro ao conectar ao banco de dados"]);
    exit;
}

// Verificar se já existe esse SMS (evitar duplicatas) - usando prepared statement
$stmt_check = mysqli_prepare($con, "SELECT id FROM sms_received WHERE phone_num = ? AND message = ? AND datestamp = ?");
mysqli_stmt_bind_param($stmt_check, "sss", $phone, $msg, $date);
mysqli_stmt_execute($stmt_check);
mysqli_stmt_store_result($stmt_check);

if (mysqli_stmt_num_rows($stmt_check) == 0) {
    mysqli_stmt_close($stmt_check);

    // Inserir novo SMS - usando prepared statement para evitar SQL Injection
    $stmt = mysqli_prepare($con, "INSERT INTO sms_received (user, phone_num, message, datestamp, date_sent) VALUES (?, ?, ?, ?, ?)");
    mysqli_stmt_bind_param($stmt, "sssss", $user, $phone, $msg, $date, $date_sent);

    if (mysqli_stmt_execute($stmt)) {
        echo json_encode(["status" => "success", "message" => "SMS salvo"]);
    } else {
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "Erro ao salvar SMS"]);
    }

    mysqli_stmt_close($stmt);
} else {
    mysqli_stmt_close($stmt_check);
    echo json_encode(["status" => "duplicate", "message" => "SMS já existe"]);
}

mysqli_close($con);
?>