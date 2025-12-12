<?php
// login.php
require_once '../config.php';

// Устанавливаем заголовки CORS
setCorsHeaders();

// Получаем метод запроса
$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'POST') {
    jsonResponse(['error' => 'Method not allowed'], 405);
}

// Получаем данные из тела запроса
$data = json_decode(file_get_contents('php://input'), true);

// Валидация данных
if (empty($data['username']) || empty($data['password'])) {
    jsonResponse(['error' => 'Username and password are required'], 400);
}

// Очищаем данные
$username = sanitize($data['username']);
$password = $data['password'];

// Подключаемся к БД
$pdo = getDBConnection();
if (!$pdo) {
    jsonResponse(['error' => 'Database connection failed'], 500);
}

try {
    // Ищем администратора
    $stmt = $pdo->prepare("
        SELECT id, username, password_hash, role, is_active 
        FROM admins 
        WHERE username = ? AND is_active = 1
    ");
    $stmt->execute([$username]);
    $admin = $stmt->fetch();
    
    if (!$admin) {
        jsonResponse(['error' => 'Invalid credentials'], 401);
    }
    
    // Проверяем пароль
    if (!password_verify($password, $admin['password_hash'])) {
        jsonResponse(['error' => 'Invalid credentials'], 401);
    }
    
    // Создаем сессию
    session_start();
    session_regenerate_id(true);
    
    $_SESSION['admin_id'] = $admin['id'];
    $_SESSION['admin_username'] = $admin['username'];
    $_SESSION['admin_role'] = $admin['role'];
    $_SESSION['admin_logged_in'] = true;
    $_SESSION['last_activity'] = time();
    
    // Обновляем время последнего входа
    $stmt = $pdo->prepare("UPDATE admins SET last_login = NOW() WHERE id = ?");
    $stmt->execute([$admin['id']]);
    
    // Логируем вход
    logAdminAction($admin['id'], 'login');
    
    // Генерируем токен (для API)
    $token = bin2hex(random_bytes(32));
    
    // Сохраняем токен в сессии
    $_SESSION['admin_token'] = $token;
    
    // Возвращаем успешный ответ
    jsonResponse([
        'success' => true,
        'message' => 'Login successful',
        'admin_id' => $admin['id'],
        'username' => $admin['username'],
        'role' => $admin['role'],
        'token' => $token
    ]);
    
} catch (PDOException $e) {
    error_log("Login failed: " . $e->getMessage());
    jsonResponse(['error' => 'Login failed'], 500);
}
?>