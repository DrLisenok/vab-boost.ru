<?php
/**
 * CONFIG.PHP - Основной конфигурационный файл VAB BOOST
 * НАСТРОЕН ДЛЯ ТЕСТОВОГО РЕЖИМА ЮKASSA
 */

// ==================== НАСТРОЙКИ БАЗЫ ДАННЫХ ====================
define('DB_HOST', 'localhost');
define('DB_NAME', 'u3350632_adminka');
define('DB_USER', 'u3350632_administrator');
define('DB_PASS', 'rX5dN7qN6gbW3xC7'); // ЗАМЕНИТЕ на реальный пароль!
define('DB_CHARSET', 'utf8mb4');

// ==================== НАСТРОЙКИ ЮKASSA ====================
define('YOOKASSA_SHOP_ID', '1226686');
define('YOOKASSA_SECRET_KEY', 'test_3LHmCEnVpAOe_1nR3kfj1voQeuy-4kJtVqaBuhtBFY8');
define('YOOKASSA_RETURN_URL', 'https://vab-boost.ru/success.html'); // URL после оплаты

// Настройки для отладки
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Заголовки JSON
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// ==================== ОСНОВНАЯ ЛОГИКА ====================
try {
    // Получаем данные из запроса
    $input = json_decode(file_get_contents('php://input'), true);
    
    // Логируем для отладки
    error_log('=== PAYMENT REQUEST ===');
    error_log('Input data: ' . print_r($input, true));
    
    // Проверяем данные
    if (!$input) {
        throw new Exception('Неверный формат данных');
    }
    
    // Проверяем обязательные поля
    $required = ['service_type', 'price', 'contact'];
    foreach ($required as $field) {
        if (!isset($input[$field]) || empty($input[$field])) {
            throw new Exception("Отсутствует обязательное поле: $field");
        }
    }
    
    // Валидация цены
    $price = floatval($input['price']);
    if ($price <= 0 || $price > 100000) {
        throw new Exception('Некорректная сумма: ' . $price);
    }
    
    // Форматируем цену
    $formattedPrice = number_format($price, 2, '.', '');
    
    // ==================== СОЗДАНИЕ ПЛАТЕЖА В ЮKASSA ====================
    $paymentData = [
        'amount' => [
            'value' => $formattedPrice,
            'currency' => 'RUB'
        ],
        'confirmation' => [
            'type' => 'redirect',
            'return_url' => YOOKASSA_RETURN_URL . '?order_id=' . uniqid()
        ],
        'capture' => true,
        'description' => 'Заказ на услугу: ' . $input['service_type'],
        'metadata' => [
            'service_type' => $input['service_type'],
            'contact' => $input['contact'],
            'order_id' => uniqid()
        ],
        'test' => true  // ТЕСТОВЫЙ РЕЖИМ!
    ];
    
    // Добавляем дополнительные данные
    if (isset($input['current_rank'])) {
        $paymentData['metadata']['current_rank'] = $input['current_rank'];
    }
    if (isset($input['desired_rank'])) {
        $paymentData['metadata']['desired_rank'] = $input['desired_rank'];
    }
    if (isset($input['wins_count'])) {
        $paymentData['metadata']['wins_count'] = $input['wins_count'];
    }
    
    // Кодируем в JSON
    $jsonData = json_encode($paymentData);
    
    // Подготавливаем запрос к ЮKassa
    $auth = YOOKASSA_SHOP_ID . ':' . YOOKASSA_SECRET_KEY;
    
    $options = [
        'http' => [
            'method' => 'POST',
            'header' => [
                'Content-Type: application/json',
                'Authorization: Basic ' . base64_encode($auth),
                'Idempotence-Key: ' . uniqid()
            ],
            'content' => $jsonData,
            'ignore_errors' => true
        ]
    ];
    
    $context = stream_context_create($options);
    
    // Отправляем запрос
    $response = @file_get_contents('https://api.yookassa.ru/v3/payments', false, $context);
    
    if ($response === FALSE) {
        throw new Exception('Ошибка соединения с ЮKassa. Проверьте ключи.');
    }
    
    $responseData = json_decode($response, true);
    
    // Проверяем ответ ЮKassa
    if (isset($responseData['error'])) {
        $errorMsg = $responseData['description'] ?? 'Неизвестная ошибка';
        throw new Exception('ЮKassa: ' . $errorMsg . ' (код: ' . ($responseData['code'] ?? 'N/A') . ')');
    }
    
    // Проверяем наличие ссылки для оплаты
    if (empty($responseData['confirmation']['confirmation_url'])) {
        throw new Exception('Не получена ссылка для оплаты от ЮKassa');
    }
    
    // ==================== УСПЕШНЫЙ ОТВЕТ ====================
    echo json_encode([
        'success' => true,
        'payment_id' => $responseData['id'],
        'order_id' => $paymentData['metadata']['order_id'],
        'confirmation_url' => $responseData['confirmation']['confirmation_url'],
        'amount' => $formattedPrice,
        'test_mode' => true,
        'message' => '✅ Платеж создан! Используйте тестовые карты.'
    ]);
    
} catch (Exception $e) {
    // ==================== ОБРАБОТКА ОШИБОК ====================
    error_log('PAYMENT ERROR: ' . $e->getMessage());
    
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'test_mode' => true,
        'debug' => [
            'received_data' => $input ?? null,
            'timestamp' => date('Y-m-d H:i:s')
        ]
    ]);
}
?>