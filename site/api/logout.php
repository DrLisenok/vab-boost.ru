<?php
// logout.php
require_once '../config.php';

// Устанавливаем заголовки CORS
setCorsHeaders();

// Проверяем авторизацию
if (!checkAdminAuth()) {
    jsonResponse(['error' => 'Unauthorized'], 401);
}

// Получаем ID администратора из сессии
session_start();
$adminId = $_SESSION['admin_id'] ?? null;

// Уничтожаем сессию
session_destroy();

// Логируем выход, если был ID администратора
if ($adminId) {
    $pdo = getDBConnection();
    if ($pdo) {
        logAdminAction($adminId, 'logout');
    }
}

jsonResponse([
    'success' => true,
    'message' => 'Logout successful'
]);
?>