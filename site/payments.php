<?php
// Простейший payments.php для тестирования
header('Content-Type: application/json; charset=utf-8');

// Проверка метода запроса
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// Получение данных
$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (!$data) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON data']);
    exit;
}

// Минимальная валидация
$required = ['service_type', 'contact_type', 'contact_value'];
foreach ($required as $field) {
    if (empty($data[$field])) {
        http_response_code(400);
        echo json_encode(['error' => "Missing required field: $field"]);
        exit;
    }
}

// Генерация ID заказа
$orderId = 'VAB-' . date('Ymd') . '-' . strtoupper(substr(md5(uniqid()), 0, 6));

// Расчет суммы (упрощенный)
$amount = $data['amount'] ?? 1999;

// Для тестирования - возвращаем успешный ответ с тестовым URL
echo json_encode([
    'success' => true,
    'order_id' => $orderId,
    'amount' => $amount,
    'confirmation_url' => 'https://yoomoney.ru/checkout/payments/v2/contract?orderId=' . $orderId,
    'message' => 'Payment created successfully',
    'test_mode' => true // Удалите в продакшене
]);
?>