<?php
require_once __DIR__ . '/config.php';

// Устанавливаем заголовки
if (!headers_sent()) {
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: ' . SITE_URL);
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-CSRF-Token');
}

// Обработка preflight запросов
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Получение действия
$input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
$action = $_GET['action'] ?? $input['action'] ?? '';

// Логирование запроса
logAction('api_request', [
    'action' => $action,
    'method' => $_SERVER['REQUEST_METHOD'],
    'data' => $input
]);

try {
    switch ($action) {
        case 'create':
            createOrder($input);
            break;
            
        case 'get':
            getOrder($_GET['id'] ?? $_GET['order_number'] ?? '');
            break;
            
        case 'status':
            getOrderStatus($_GET['id'] ?? $_GET['order_number'] ?? '');
            break;
            
        case 'calculate':
            calculatePrice($input);
            break;
            
        default:
            jsonResponse(['error' => 'Неизвестное действие'], 400);
    }
} catch (Exception $e) {
    error_log('Order processing error: ' . $e->getMessage());
    jsonResponse(['error' => 'Внутренняя ошибка сервера'], 500);
}

/**
 * Создание заказа
 */
function createOrder($data) {
    // Валидация
    $rules = [
        'service_type' => 'required',
        'contact' => 'required',
        'contact_type' => 'required',
        'region' => 'required',
        'amount' => 'required|float'
    ];
    
    $validation = validateAndSanitize($data, $rules);
    
    if (!empty($validation['errors'])) {
        jsonResponse(['errors' => $validation['errors']], 400);
    }
    
    $sanitized = $validation['data'];
    
    // Проверка суммы
    if ($sanitized['amount'] <= 0 || $sanitized['amount'] > 100000) {
        jsonResponse(['error' => 'Некорректная сумма'], 400);
    }
    
    $db = getDB();
    
    // Генерация номера заказа
    $orderNumber = generateOrderNumber();
    
    // Создание заказа
    $stmt = $db->prepare("
        INSERT INTO orders (
            order_number, service_type, current_rank, target_rank,
            region, contact_type, contact, amount, notes,
            ip_address, user_agent, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'awaiting_payment')
    ");
    
    try {
        $stmt->execute([
            $orderNumber,
            $sanitized['service_type'],
            $sanitized['current_rank'] ?? '',
            $sanitized['target_rank'] ?? '',
            $sanitized['region'],
            $sanitized['contact_type'],
            $sanitized['contact'],
            floatval($sanitized['amount']),
            $sanitized['notes'] ?? '',
            getUserIP(),
            $_SERVER['HTTP_USER_AGENT'] ?? 'unknown'
        ]);
        
        $orderId = $db->lastInsertId();
        
        // Создание платежа через ЮKassa
        $paymentResult = createYookassaPayment([
            'order_id' => $orderId,
            'order_number' => $orderNumber,
            'amount' => $sanitized['amount'],
            'description' => "Оплата заказа #$orderNumber (" . $sanitized['service_type'] . ")",
            'customer_email' => $sanitized['contact_type'] === 'email' ? $sanitized['contact'] : null
        ]);
        
        if (!$paymentResult['success']) {
            // Отменяем заказ если платеж не создался
            $db->prepare("UPDATE orders SET status = 'cancelled' WHERE id = ?")->execute([$orderId]);
            jsonResponse(['error' => 'Ошибка создания платежа'], 500);
        }
        
        // Сохранение информации о платеже
        $stmt = $db->prepare("
            INSERT INTO payments (
                order_id, payment_id, amount, currency, status,
                confirmation_url, yookassa_data
            ) VALUES (?, ?, ?, 'RUB', ?, ?, ?)
        ");
        
        $stmt->execute([
            $orderId,
            $paymentResult['payment_id'],
            $sanitized['amount'],
            $paymentResult['status'],
            $paymentResult['confirmation_url'],
            json_encode($paymentResult['data'])
        ]);
        
        $paymentId = $db->lastInsertId();
        
        // Обновление заказа с payment_id
        $db->prepare("UPDATE orders SET payment_id = ? WHERE id = ?")->execute([$paymentId, $orderId]);
        
        // Логирование
        logAction('order_created', [
            'order_id' => $orderId,
            'order_number' => $orderNumber,
            'amount' => $sanitized['amount'],
            'payment_id' => $paymentResult['payment_id']
        ]);
        
        // Отправка email уведомления
        if ($sanitized['contact_type'] === 'email') {
            sendOrderEmail($sanitized['contact'], $orderNumber, $sanitized['amount']);
        }
        
        jsonResponse([
            'success' => true,
            'order' => [
                'id' => $orderId,
                'order_number' => $orderNumber,
                'amount' => $sanitized['amount']
            ],
            'payment' => [
                'id' => $paymentResult['payment_id'],
                'confirmation_url' => $paymentResult['confirmation_url']
            ],
            'message' => 'Заказ успешно создан'
        ]);
        
    } catch (PDOException $e) {
        error_log('Database error: ' . $e->getMessage());
        jsonResponse(['error' => 'Ошибка сохранения заказа'], 500);
    }
}

/**
 * Получение информации о заказе
 */
function getOrder($identifier) {
    if (empty($identifier)) {
        jsonResponse(['error' => 'Не указан номер заказа'], 400);
    }
    
    $db = getDB();
    
    if (is_numeric($identifier)) {
        $stmt = $db->prepare("
            SELECT o.*, p.payment_id, p.status as payment_status, 
                   p.confirmation_url, p.created_at as payment_created
            FROM orders o 
            LEFT JOIN payments p ON o.payment_id = p.id
            WHERE o.id = ?
        ");
        $stmt->execute([$identifier]);
    } else {
        $stmt = $db->prepare("
            SELECT o.*, p.payment_id, p.status as payment_status, 
                   p.confirmation_url, p.created_at as payment_created
            FROM orders o 
            LEFT JOIN payments p ON o.payment_id = p.id
            WHERE o.order_number = ?
        ");
        $stmt->execute([$identifier]);
    }
    
    $order = $stmt->fetch();
    
    if (!$order) {
        jsonResponse(['error' => 'Заказ не найден'], 404);
    }
    
    // Скрываем чувствительные данные
    unset($order['ip_address']);
    
    jsonResponse(['order' => $order]);
}

/**
 * Получение статуса заказа
 */
function getOrderStatus($identifier) {
    if (empty($identifier)) {
        jsonResponse(['error' => 'Не указан номер заказа'], 400);
    }
    
    $db = getDB();
    
    if (is_numeric($identifier)) {
        $stmt = $db->prepare("
            SELECT o.status, o.order_number, p.status as payment_status
            FROM orders o 
            LEFT JOIN payments p ON o.payment_id = p.id
            WHERE o.id = ?
        ");
        $stmt->execute([$identifier]);
    } else {
        $stmt = $db->prepare("
            SELECT o.status, o.order_number, p.status as payment_status
            FROM orders o 
            LEFT JOIN payments p ON o.payment_id = p.id
            WHERE o.order_number = ?
        ");
        $stmt->execute([$identifier]);
    }
    
    $status = $stmt->fetch();
    
    if (!$status) {
        jsonResponse(['error' => 'Заказ не найден'], 404);
    }
    
    jsonResponse(['status' => $status]);
}

/**
 * Расчет стоимости
 */
function calculatePrice($data) {
    $service = $data['service_type'] ?? '';
    $currentRank = $data['current_rank'] ?? '';
    $targetRank = $data['target_rank'] ?? '';
    $wins = intval($data['wins'] ?? 1);
    $hours = intval($data['hours'] ?? 1);
    
    if (empty($service)) {
        jsonResponse(['error' => 'Не указан тип услуги'], 400);
    }
    
    // Базовая цена
    $price = 0;
    $details = [];
    
    switch ($service) {
        case 'rank_boost':
            $basePrice = 1999;
            $rankPrices = [
                'iron' => 800, 'bronze' => 1000, 'silver' => 1200,
                'gold' => 1500, 'platinum' => 1800, 'diamond' => 2200,
                'ascendant' => 2600, 'immortal' => 3000, 'radiant' => 4000
            ];
            
            $price = $basePrice;
            $details[] = "Базовая стоимость: {$basePrice} ₽";
            
            if ($currentRank && $targetRank) {
                $rankOrder = ['iron', 'bronze', 'silver', 'gold', 'platinum', 
                             'diamond', 'ascendant', 'immortal', 'radiant'];
                
                $fromIndex = array_search($currentRank, $rankOrder);
                $toIndex = array_search($targetRank, $rankOrder);
                
                if ($fromIndex !== false && $toIndex !== false && $toIndex > $fromIndex) {
                    $rankCount = $toIndex - $fromIndex;
                    
                    for ($i = $fromIndex; $i < $toIndex; $i++) {
                        $rank = $rankOrder[$i];
                        $rankPrice = $rankPrices[$rank] ?? 1000;
                        $price += $rankPrice;
                        $details[] = "Ранг {$rank}: +{$rankPrice} ₽";
                    }
                    
                    // Скидка за несколько рангов
                    $discount = 0;
                    if ($rankCount >= 3) $discount = 10;
                    if ($rankCount >= 5) $discount = 15;
                    if ($rankCount >= 7) $discount = 20;
                    
                    if ($discount > 0) {
                        $discountAmount = round($price * $discount / 100);
                        $price -= $discountAmount;
                        $details[] = "Скидка {$discount}%: -{$discountAmount} ₽";
                    }
                }
            }
            break;
            
        case 'wins_boost':
            $pricePerWin = 299;
            $price = $wins * $pricePerWin;
            $details[] = "Побед: {$wins}";
            $details[] = "Цена за победу: {$pricePerWin} ₽";
            
            // Скидка за количество
            $discount = 0;
            if ($wins >= 20) $discount = 20;
            elseif ($wins >= 10) $discount = 15;
            elseif ($wins >= 5) $discount = 10;
            
            if ($discount > 0) {
                $discountAmount = round($price * $discount / 100);
                $price -= $discountAmount;
                $details[] = "Скидка {$discount}%: -{$discountAmount} ₽";
            }
            break;
            
        case 'placement':
            $price = 2499;
            $details[] = "Калибровка аккаунта (10 игр)";
            break;
            
        case 'coaching':
            $pricePerHour = 999;
            $price = $hours * $pricePerHour;
            $details[] = "Часов: {$hours}";
            $details[] = "Цена за час: {$pricePerHour} ₽";
            break;
            
        default:
            jsonResponse(['error' => 'Неизвестный тип услуги'], 400);
    }
    
    jsonResponse([
        'service' => $service,
        'price' => $price,
        'formatted_price' => number_format($price, 0, '', ' ') . ' ₽',
        'details' => $details
    ]);
}

/**
 * Создание платежа в ЮKassa
 */
function createYookassaPayment($data) {
    try {
        $client = new YooKassa\Client();
        $client->setAuth(YOOKASSA_SHOP_ID, YOOKASSA_SECRET_KEY);
        
        $paymentData = [
            'amount' => [
                'value' => number_format($data['amount'], 2, '.', ''),
                'currency' => 'RUB',
            ],
            'confirmation' => [
                'type' => 'redirect',
                'return_url' => YOOKASSA_RETURN_URL . '?order=' . $data['order_number'],
            ],
            'capture' => true,
            'description' => $data['description'],
            'metadata' => [
                'order_id' => $data['order_id'],
                'order_number' => $data['order_number']
            ],
        ];
        
        // Добавляем чек для самозанятых
        if (isset($data['customer_email']) && filter_var($data['customer_email'], FILTER_VALIDATE_EMAIL)) {
            $paymentData['receipt'] = [
                'customer' => [
                    'email' => $data['customer_email'],
                ],
                'items' => [
                    [
                        'description' => $data['description'],
                        'quantity' => '1.00',
                        'amount' => [
                            'value' => number_format($data['amount'], 2, '.', ''),
                            'currency' => 'RUB',
                        ],
                        'vat_code' => 1,
                        'payment_mode' => 'full_payment',
                        'payment_subject' => 'service',
                    ]
                ]
            ];
        }
        
        $payment = $client->createPayment($paymentData, uniqid('', true));
        
        return [
            'success' => true,
            'payment_id' => $payment->getId(),
            'confirmation_url' => $payment->getConfirmation()->getConfirmationUrl(),
            'status' => $payment->getStatus(),
            'data' => $payment->jsonSerialize()
        ];
        
    } catch (Exception $e) {
        error_log('YooKassa payment creation failed: ' . $e->getMessage());
        return [
            'success' => false,
            'error' => $e->getMessage()
        ];
    }
}

/**
 * Отправка email о создании заказа
 */
function sendOrderEmail($email, $orderNumber, $amount) {
    $subject = "Ваш заказ #{$orderNumber} принят";
    $message = "
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #6c63ff, #554fd8); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .order-info { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
                .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class='container'>
                <div class='header'>
                    <h1>✅ Заказ принят</h1>
                </div>
                <div class='content'>
                    <p>Спасибо за заказ! Мы уже начали его обработку.</p>
                    
                    <div class='order-info'>
                        <h3>Детали заказа:</h3>
                        <p><strong>Номер заказа:</strong> #{$orderNumber}</p>
                        <p><strong>Сумма:</strong> {$amount} ₽</p>
                        <p><strong>Статус:</strong> Ожидает оплаты</p>
                    </div>
                    
                    <p>В течение 15 минут с вами свяжется наш менеджер для уточнения деталей.</p>
                    
                    <p>Свяжитесь с нами, если у вас есть вопросы:</p>
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