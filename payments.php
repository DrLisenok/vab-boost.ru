<?php
require_once __DIR__ . '/config.php';

// Устанавливаем заголовки для вебхука
if (!headers_sent()) {
    header('Content-Type: text/plain; charset=utf-8');
}

// Получение действия
$action = $_GET['action'] ?? '';

if ($action === 'webhook') {
    handleWebhook();
} else {
    http_response_code(400);
    echo 'Invalid action';
    exit;
}

/**
 * Обработка вебхука от ЮKassa
 */
function handleWebhook() {
    // Получаем тело запроса
    $requestBody = file_get_contents('php://input');
    $data = json_decode($requestBody, true);
    
    if (!$data) {
        error_log('Invalid webhook data');
        http_response_code(400);
        exit;
    }
    
    // Логируем полученный вебхук
    logAction('yookassa_webhook_received', $data);
    
    try {
        // Проверяем, что это уведомление от ЮKassa
        if (!isset($data['event'], $data['object'])) {
            throw new Exception('Invalid webhook format');
        }
        
        // Инициализируем клиент ЮKassa
        $client = new YooKassa\Client();
        $client->setAuth(YOOKASSA_SHOP_ID, YOOKASSA_SECRET_KEY);
        
        // Обрабатываем уведомление в зависимости от типа
        $paymentId = $data['object']['id'] ?? null;
        $status = $data['object']['status'] ?? null;
        $orderId = $data['object']['metadata']['order_id'] ?? null;
        
        if (!$paymentId || !$status || !$orderId) {
            throw new Exception('Missing required data in webhook');
        }
        
        $db = getDB();
        
        // Проверяем существование платежа
        $stmt = $db->prepare("SELECT * FROM payments WHERE payment_id = ?");
        $stmt->execute([$paymentId]);
        $payment = $stmt->fetch();
        
        if (!$payment) {
            error_log("Payment not found: {$paymentId}");
            http_response_code(404);
            exit;
        }
        
        // Обновляем статус платежа
        $stmt = $db->prepare("
            UPDATE payments 
            SET status = ?, 
                yookassa_data = ?,
                updated_at = NOW()
            WHERE payment_id = ?
        ");
        
        $stmt->execute([
            $status,
            json_encode($data['object'], JSON_UNESCAPED_UNICODE),
            $paymentId
        ]);
        
        // Обновляем статус заказа в зависимости от статуса платежа
        $orderStatus = match($status) {
            'succeeded' => 'paid',
            'canceled' => 'cancelled',
            'waiting_for_capture' => 'awaiting_confirmation',
            default => 'awaiting_payment'
        };
        
        $stmt = $db->prepare("
            UPDATE orders 
            SET status = ?, 
                updated_at = NOW()
            WHERE id = ? 
            AND status IN ('pending', 'awaiting_payment', 'awaiting_confirmation')
        ");
        
        $stmt->execute([$orderStatus, $orderId]);
        
        // Если платеж успешен, отправляем уведомления
        if ($status === 'succeeded') {
            // Получаем информацию о заказе для отправки email
            $stmt = $db->prepare("
                SELECT o.*, p.payment_id 
                FROM orders o 
                JOIN payments p ON o.payment_id = p.id
                WHERE o.id = ?
            ");
            $stmt->execute([$orderId]);
            $order = $stmt->fetch();
            
            if ($order && $order['contact_type'] === 'email') {
                // Отправляем email об успешной оплате
                sendPaymentSuccessEmail(
                    $order['contact'],
                    $order['order_number'],
                    $order['amount']
                );
            }
            
            // Логируем успешный платеж
            logAction('payment_succeeded', [
                'order_id' => $orderId,
                'payment_id' => $paymentId,
                'amount' => $order['amount'] ?? 0
            ]);
        }
        
        // Отправляем успешный ответ
        http_response_code(200);
        echo 'OK';
        
    } catch (Exception $e) {
        error_log('Webhook processing error: ' . $e->getMessage());
        http_response_code(500);
        echo 'Error: ' . $e->getMessage();
    }
    
    exit;
}

/**
 * Отправка email об успешной оплате
 */
function sendPaymentSuccessEmail($email, $orderNumber, $amount) {
    $subject = "✅ Оплата заказа #{$orderNumber} успешна";
    $message = "
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #00c9a7, #00b894); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .order-info { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
                .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
                .button { display: inline-block; background: #6c63ff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
            </style>
        </head>
        <body>
            <div class='container'>
                <div class='header'>
                    <h1>✅ Оплата успешна!</h1>
                </div>
                <div class='content'>
                    <p>Ваш заказ успешно оплачен и принят в работу.</p>
                    
                    <div class='order-info'>
                        <h3>Детали заказа:</h3>
                        <p><strong>Номер заказа:</strong> #{$orderNumber}</p>
                        <p><strong>Сумма:</strong> {$amount} ₽</p>
                        <p><strong>Статус:</strong> Оплачено, в обработке</p>
                    </div>
                    
                    <p>Наш менеджер свяжется с вами в ближайшее время для уточнения деталей.</p>
                    
                    <p>Вы можете отслеживать статус заказа на странице:</p>
                    <p><a href='" . SITE_URL . "/success.html?order={$orderNumber}' class='button'>Отследить заказ</a></p>
                    
                    <p>Если у вас есть вопросы, свяжитесь с нами:</p>
                    <ul>
                        <li>Telegram: @vabboost_support</li>
                        <li>Email: support@vab-boost.ru</li>
                    </ul>
                </div>
                <div class='footer'>
                    <p>© 2024 VAB BOOST. Все права защищены.</p>
                </div>
            </div>
        </body>
        </html>
    ";
    
    return sendEmail($email, $subject, $message);
}
?>