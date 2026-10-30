<?php
/**
 * send_sms0.php
 * Envia uma mensagem SMS para o dispositivo Android via Firebase Cloud Messaging (FCM).
 *
 * AVISO: A API legada do FCM (fcm.googleapis.com/fcm/send) foi DESCONTINUADA em junho de 2024.
 * Para uso em produção, migre para a API FCM v1 (Firebase Admin SDK ou HTTP v1 API):
 * https://firebase.google.com/docs/cloud-messaging/migrate-v1
 *
 * Uso: GET /send_sms0.php?phone=<numero>&msg=<mensagem>
 */

DEFINE('HOST', 'localhost');
DEFINE('USER', 'id2008008_atif');
DEFINE('PASSWORD', 'database');
DEFINE('DB', 'id2008008_trices');

/**
 * Envia notificação push FCM para os dispositivos registrados.
 * 
 * NOTA: Substitua a chave abaixo pela sua Server Key do Firebase Console.
 * Migre para FCM v1 API para produção.
 */
function send_notification($tokens, $message)
{
    // ATENÇÃO: FCM Legacy API descontinuada em junho/2024.
    // Esta chave precisa ser atualizada com sua própria Server Key do Firebase.
    $fcm_server_key = 'SUA_SERVER_KEY_FIREBASE_AQUI';

    $url = "https://fcm.googleapis.com/fcm/send";
    $fields = array(
        'registration_ids' => $tokens,
        'data'             => $message
    );

    $header = array(
        'Authorization: key=' . $fcm_server_key,
        'Content-Type: application/json'
    );

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $header);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($fields));

    $result = curl_exec($ch);
    if ($result === false) {
        $error = curl_error($ch);
        curl_close($ch);
        return json_encode(["status" => "error", "message" => "cURL falhou: " . $error]);
    }

    curl_close($ch);
    return $result;
}

$phone = isset($_GET['phone']) ? $_GET['phone'] : '';
$msg   = isset($_GET['msg'])   ? $_GET['msg']   : '';

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

$sql    = "SELECT device AS token FROM registered_devices WHERE type = 'sms'";
$result = mysqli_query($con, $sql);
$tokens = [];

if (mysqli_num_rows($result) > 0) {
    while ($row = mysqli_fetch_assoc($result)) {
        $tokens[] = $row["token"];
    }
}

mysqli_close($con);

if (empty($tokens)) {
    echo json_encode(["status" => "error", "message" => "Nenhum dispositivo registrado"]);
    exit;
}

$message        = ["msg" => $msg, "phone" => $phone];
$message_status = send_notification($tokens, $message);

echo $message_status;
?>