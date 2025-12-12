<?php
// ==================== НАСТРОЙКИ БАЗЫ ДАННЫХ ====================
define('DB_HOST', 'localhost');
define('DB_NAME', 'u3350632_adminka');
define('DB_USER', 'u3350632_administrator');
define('DB_PASS', 'rX5dN7qN6gbW3xC7');
define('DB_CHARSET', 'utf8mb4');

// ==================== НАСТРОЙКИ ЮKASSA ====================
define('YOOKASSA_SHOP_ID', '1226686');
define('YOOKASSA_SECRET_KEY', 'test_3LHmCEnVpAOe_1nR3kfj1voQeuy-4kJtVqaBuhtBFY8');
define('YOOKASSA_RETURN_URL', 'https://vab-boost.ru/success.html');
define('YOOKASSA_WEBHOOK_URL', 'https://vab-boost.ru/api/payments.php?action=webhook');

// ==================== НАСТРОЙКИ САЙТА ====================
define('SITE_NAME', 'VAB BOOST');
define('SITE_URL', 'https://vab-boost.ru');
define('ADMIN_EMAIL', 'admin@vab-boost.ru');
define('SUPPORT_EMAIL', 'support@vab-boost.ru');

// ==================== БЕЗОПАСНОСТЬ ====================
define('ENCRYPTION_KEY', 'v4bb00st_2024_secure_key_!@#$%');
define('SESSION_TIMEOUT', 3600);
define('CSRF_TOKEN_LIFE', 1800);

// ==================== НАСТРОЙКИ АДМИНА ====================
define('ADMIN_USERNAME', 'admin');
define('ADMIN_PASSWORD_HASH', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi');

// ==================== ОШИБКИ ====================
error_reporting(E_ALL);
ini_set('display_errors', 0); // Изменили на 0 для продакшена
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/logs/php_errors.log');

// ==================== СЕССИЯ ====================
// Проверяем, не отправлены ли уже заголовки
if (session_status() === PHP_SESSION_NONE) {
    // Устанавливаем параметры сессии перед её стартом
    session_set_cookie_params([
        'lifetime' => 86400, // 24 часа
        'path' => '/',
        'domain' => '', // текущий домен
        'secure' => true, // только HTTPS
        'httponly' => true,
        'samesite' => 'Strict'
    ]);
    
    // Стартуем сессию только если заголовки не отправлены
    if (!headers_sent()) {
        session_start();
    }
}

// ==================== ФУНКЦИИ ====================

/**
 * Подключение к базе данных
 */
function getDB() {
    static $db = null;
    if ($db === null) {
        try {
            $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
            $db = new PDO($dsn, DB_USER, DB_PASS, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false
            ]);
        } catch (PDOException $e) {
            // В режиме продакшена не показываем детали ошибки
            error_log("Database connection failed: " . $e->getMessage());
            $errorMessage = 'Сервис временно недоступен. Пожалуйста, попробуйте позже.';
            
            // Отправляем JSON ошибку для API
            if (strpos($_SERVER['REQUEST_URI'], '/api/') !== false || 
                strpos($_SERVER['REQUEST_URI'], '.php') !== false) {
                header('Content-Type: application/json');
                http_response_code(500);
                echo json_encode(['error' => $errorMessage], JSON_UNESCAPED_UNICODE);
            } else {
                // Для обычных страниц показываем красивую ошибку
                include __DIR__ . '/error.html';
            }
            exit;
        }
    }
    return $db;
}

/**
 * Проверка авторизации администратора
 */
function isAdminAuthenticated() {
    if (!isset($_SESSION['admin_id']) || !isset($_SESSION['admin_token'])) {
        return false;
    }
    
    // Проверка таймаута сессии
    if (isset($_SESSION['last_activity']) && 
        (time() - $_SESSION['last_activity'] > SESSION_TIMEOUT)) {
        session_unset();
        session_destroy();
        return false;
    }
    
    $_SESSION['last_activity'] = time();
    
    // Проверка токена
    $expectedToken = hash_hmac('sha256', $_SESSION['admin_id'] . ADMIN_USERNAME, ENCRYPTION_KEY);
    return hash_equals($expectedToken, $_SESSION['admin_token']);
}

/**
 * Авторизация администратора
 */
function adminLogin($username, $password) {
    // Проверка в базе данных
    $db = getDB();
    $stmt = $db->prepare("SELECT id, username, password_hash FROM admins WHERE username = ?");
    $stmt->execute([$username]);
    $admin = $stmt->fetch();
    
    if ($admin && password_verify($password, $admin['password_hash'])) {
        $_SESSION['admin_id'] = $admin['id'];
        $_SESSION['admin_username'] = $admin['username'];
        $_SESSION['admin_token'] = hash_hmac('sha256', $admin['id'] . $admin['username'], ENCRYPTION_KEY);
        $_SESSION['last_activity'] = time();
        
        // Обновляем время последнего входа
        $stmt = $db->prepare("UPDATE admins SET last_login = NOW() WHERE id = ?");
        $stmt->execute([$admin['id']]);
        
        return true;
    }
    
    return false;
}

/**
 * Генерация уникального номера заказа
 */
function generateOrderNumber() {
    $prefix = 'VAB';
    $date = date('Ymd');
    $random = strtoupper(substr(md5(uniqid()), 0, 6));
    
    // Проверка уникальности
    $db = getDB();
    $orderNumber = $prefix . '-' . $date . '-' . $random;
    
    $stmt = $db->prepare("SELECT COUNT(*) FROM orders WHERE order_number = ?");
    $stmt->execute([$orderNumber]);
    
    $counter = 1;
    while ($stmt->fetchColumn() > 0) {
        $orderNumber = $prefix . '-' . $date . '-' . $random . '-' . $counter;
        $stmt->execute([$orderNumber]);
        $counter++;
    }
    
    return $orderNumber;
}

/**
 * Генерация CSRF токена
 */
function generateCSRFToken() {
    if (!isset($_SESSION['csrf_tokens'])) {
        $_SESSION['csrf_tokens'] = [];
    }
    
    $token = bin2hex(random_bytes(32));
    $_SESSION['csrf_tokens'][$token] = time() + CSRF_TOKEN_LIFE;
    
    // Очистка старых токенов
    foreach ($_SESSION['csrf_tokens'] as $storedToken => $expiry) {
        if ($expiry < time()) {
            unset($_SESSION['csrf_tokens'][$storedToken]);
        }
    }
    
    return $token;
}

/**
 * Проверка CSRF токена
 */
function verifyCSRFToken($token) {
    return isset($_SESSION['csrf_tokens'][$token]) && 
           $_SESSION['csrf_tokens'][$token] > time();
}

/**
 * Ответ в JSON формате
 */
function jsonResponse($data, $statusCode = 200) {
    // Устанавливаем заголовки перед любым выводом
    if (!headers_sent()) {
        http_response_code($statusCode);
        header('Content-Type: application/json; charset=utf-8');
        header('X-Content-Type-Options: nosniff');
        
        // Добавляем CSRF токен для POST запросов
        if ($_SERVER['REQUEST_METHOD'] === 'POST' && !isset($data['csrf_token'])) {
            $data['csrf_token'] = generateCSRFToken();
        }
    }
    
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

/**
 * Валидация и санитизация данных
 */
function validateAndSanitize($data, $rules) {
    $errors = [];
    $sanitized = [];
    
    foreach ($rules as $field => $rule) {
        $value = $data[$field] ?? '';
        $required = strpos($rule, 'required') !== false;
        
        if ($required && empty($value)) {
            $errors[$field] = "Поле '$field' обязательно для заполнения";
            continue;
        }
        
        if (!empty($value)) {
            // Санитизация
            $value = htmlspecialchars(trim($value), ENT_QUOTES, 'UTF-8');
            
            // Валидация по типу
            if (strpos($rule, 'email') !== false && !filter_var($value, FILTER_VALIDATE_EMAIL)) {
                $errors[$field] = "Некорректный email";
            } elseif (strpos($rule, 'number') !== false && !is_numeric($value)) {
                $errors[$field] = "Поле должно быть числом";
            } elseif (strpos($rule, 'int') !== false && !filter_var($value, FILTER_VALIDATE_INT)) {
                $errors[$field] = "Поле должно быть целым числом";
            } elseif (strpos($rule, 'float') !== false && !filter_var($value, FILTER_VALIDATE_FLOAT)) {
                $errors[$field] = "Поле должно быть числом с плавающей точкой";
            }
        }
        
        $sanitized[$field] = $value;
    }
    
    return ['data' => $sanitized, 'errors' => $errors];
}

/**
 * Получение IP пользователя
 */
function getUserIP() {
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    
    if (!empty($_SERVER['HTTP_CLIENT_IP'])) {
        $ip = $_SERVER['HTTP_CLIENT_IP'];
    } elseif (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $ip = $_SERVER['HTTP_X_FORWARDED_FOR'];
    }
    
    // Берем первый IP если их несколько
    $ip = explode(',', $ip)[0];
    
    return filter_var($ip, FILTER_VALIDATE_IP) ? $ip : 'invalid';
}

/**
 * Логирование действий
 */
function logAction($action, $data = []) {
    $logDir = __DIR__ . '/logs';
    if (!is_dir($logDir)) {
        mkdir($logDir, 0755, true);
    }
    
    $logFile = $logDir . '/actions.log';
    $logEntry = [
        'timestamp' => date('Y-m-d H:i:s'),
        'action' => $action,
        'ip' => getUserIP(),
        'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown',
        'data' => $data
    ];
    
    file_put_contents($logFile, json_encode($logEntry, JSON_UNESCAPED_UNICODE) . PHP_EOL, FILE_APPEND);
}

/**
 * Отправка email
 */
function sendEmail($to, $subject, $message, $headers = []) {
    $defaultHeaders = [
        'From' => SUPPORT_EMAIL,
        'Reply-To' => SUPPORT_EMAIL,
        'Content-Type' => 'text/html; charset=UTF-8',
        'X-Mailer' => 'PHP/' . phpversion()
    ];
    
    $headers = array_merge($defaultHeaders, $headers);
    
    $headersString = '';
    foreach ($headers as $key => $value) {
        $headersString .= "$key: $value\r\n";
    }
    
    return mail($to, $subject, $message, $headersString);
}

/**
 * Редирект
 */
function redirect($url, $statusCode = 302) {
    if (!headers_sent()) {
        header("Location: $url", true, $statusCode);
        exit;
    } else {
        echo "<script>window.location.href='$url';</script>";
        exit;
    }
}

/**
 * Получение настроек
 */
function getSettings() {
    static $settings = null;
    
    if ($settings === null) {
        $db = getDB();
        $stmt = $db->query("SELECT setting_key, setting_value FROM settings");
        $rows = $stmt->fetchAll();
        
        $settings = [];
        foreach ($rows as $row) {
            $settings[$row['setting_key']] = $row['setting_value'];
        }
    }
    
    return $settings;
}

// Установка часового пояса
date_default_timezone_set('Europe/Moscow');

// Автозагрузка классов Composer
if (file_exists(__DIR__ . '/vendor/autoload.php')) {
    require_once __DIR__ . '/vendor/autoload.php';
}

// Проверка на режим обслуживания
$settings = getSettings();
if (isset($settings['maintenance_mode']) && $settings['maintenance_mode'] == '1' && 
    !isset($_SESSION['admin_id'])) {
    http_response_code(503);
    include __DIR__ . '/maintenance.html';
    exit;
}
?>