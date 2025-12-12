<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/vendor/autoload.php'; // Composer autoload

use YooKassa\Client;

/**
 * Создание платежа в ЮKassa
 * @param array $data (order_id, amount, description)
 * @return array
 */
function createYookassaPayment($data) {
    $client = new Client();
    $client->setAuth(YOOKASSA_SHOP_ID, YOOKASSA_SECRET_KEY);

    try {
        $payment = $client->createPayment(
            [
                'amount' => [
                    'value' => number_format($data['amount'], 2, '.', ''),
                    'currency' => 'RUB',
                ],
                'confirmation' => [
                    'type' => 'redirect',
                    'return_url' => YOOKASSA_RETURN_URL,
                ],
                'capture' => true,
                'description' => $data['description'] ?? 'Оплата заказа',
                'metadata' => [
                    'order_id' => $data['order_id'],
                ],
            ],
            uniqid('', true)
        );

        return [
            'success' => true,
            'payment_id' => $payment->getId(),
            'confirmation_url' => $payment->getConfirmation()->getConfirmationUrl(),
            'status' => $payment->getStatus(),
        ];
    } catch (Exception $e) {
        logError('YooKassa payment creation failed: ' . $e->getMessage());
        return [
            'success' => false,
            'error' => $e->getMessage(),
        ];
    }
}

/**
 * Обработка уведомления от ЮKassa (webhook)
 */
function handleYookassaWebhook() {
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);

    if (!$data || !isset($data['event'], $data['object'])) {
        http_response_code(400);
        exit;
    }

    $paymentId = $data['object']['id'];
    $status = $data['object']['status'];
    $orderId = $data['object']['metadata']['order_id'] ?? 0;

    $db = getDB();
    $stmt = $db->prepare("UPDATE payments SET status = ?, updated_at = NOW() WHERE payment_id = ?");
    $stmt->execute([$status, $paymentId]);

    // Обновляем статус заказа
    if ($status === 'succeeded') {
        $db->prepare("UPDATE orders SET status = 'paid', updated_at = NOW() WHERE id = ?")->execute([$orderId]);
    } elseif ($status === 'canceled') {
        $db->prepare("UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = ?")->execute([$orderId]);
    }

    http_response_code(200);
}

// Маршрутизация запросов
if ($_SERVER['REQUEST_METHOD'] === 'POST' && empty($_GET['action'])) {
    // Создание платежа
    $input = json_decode(file_get_contents('php://input'), true);
    $result = createYookassaPayment($input);
    jsonResponse($result);
} elseif ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['payment_id'])) {
    // Проверка статуса платежа
    $db = getDB();
    $stmt = $db->prepare("SELECT * FROM payments WHERE payment_id = ?");
    $stmt->execute([$_GET['payment_id']]);
    $payment = $stmt->fetch();
    jsonResponse($payment ?: ['error' => 'Платеж не найден']);
} elseif ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_GET['action']) && $_GET['action'] === 'webhook') {
    // Webhook от ЮKassa
    handleYookassaWebhook();
} else {
    jsonResponse(['error' => 'Неверный запрос'], 400);
}
?>