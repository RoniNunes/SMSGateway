<?php
/**
 * reg_device0.php
 * Registra o token FCM do dispositivo no banco de dados.
 * 
 * Uso: GET /reg_device0.php?Token=<firebase_token>
 */

DEFINE('HOST', 'localhost');
DEFINE('USER', 'id2008008_atif');
DEFINE('PASSWORD', 'database');
DEFINE('DB', 'id2008008_trices');

if (isset($_GET["Token"])) {
    $token = $_GET["Token"];

    if (empty($token)) {
        echo json_encode(["status" => "error", "message" => "Token vazio"]);
        exit;
    }

    $con = mysqli_connect(HOST, USER, PASSWORD, DB);
    if (!$con) {
        echo json_encode(["status" => "error", "message" => "Erro ao conectar ao banco de dados"]);
        exit;
    }

    // Usando prepared statement para evitar SQL Injection
    $stmt = mysqli_prepare($con, "INSERT INTO registered_devices (device, type) VALUES (?, 'sms') ON DUPLICATE KEY UPDATE device = ?");
    mysqli_stmt_bind_param($stmt, "ss", $token, $token);

    if (mysqli_stmt_execute($stmt)) {
        echo json_encode(["status" => "success", "message" => "Dispositivo registrado"]);
    } else {
        echo json_encode(["status" => "error", "message" => "Erro ao registrar dispositivo"]);
    }

    mysqli_stmt_close($stmt);
    mysqli_close($con);
} else {
    echo json_encode(["status" => "error", "message" => "Token não fornecido"]);
}
?>