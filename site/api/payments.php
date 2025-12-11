<?php
require_once 'config.php';
require_once 'vendor/autoload.php'; // Для ЮKassa SDK

use YooKassa\Client;

header('Content-Type: application/json; charset=utf-8');
setCorsHeaders();

try {
    // Обработка разных методов
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        createPayment();
    } elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
        checkPaymentStatus();
    } else {
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
    }
} catch (Exception $e) {
    error_log("Payments API Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Internal server error', 'message' => $e->getMessage()]);
}

// ==================== СОЗДАНИЕ ПЛАТЕЖА ====================

function createPayment() {
    $data = json_decode(file_get_contents('php://input'), true);
    
    // Валидация данных
    $errors = validatePaymentData($data);
    if (!empty($errors)) {
        http_response_code(400);
        echo json_encode(['error' => 'Validation failed', 'details' => $errors]);
        return;
    }
    
    $pdo = getDBConnection();
    
    // Начинаем транзакцию
    $pdo->beginTransaction();
    
    try {
        // 1. Создаем или находим пользователя
        $userId = findOrCreateUser($pdo, $data);
        
        // 2. Генерируем уникальный ID заказа
        $orderId = generateOrderId();
        
        // 3. Рассчитываем итоговую сумму
        $amount = calculateOrderAmount($data);
        
        // 4. Создаем запись в orders
        $orderData = [
            'order_id' => $orderId,
            'user_id' => $userId,
            'service_type' => sanitize($data['service_type']),
            'current_rank' => sanitize($data['current_rank'] ?? null),
            'target_rank' => sanitize($data['target_rank'] ?? null),
            'region' => sanitize($data['region']),
            'game_login' => sanitize($data['game_login'] ?? null),
            'game_password_encrypted' => !empty($data['game_password']) ? encryptPassword($data['game_password']) : null,
            'contact_type' => sanitize($data['contact_type']),
            'contact_value' => sanitize($data['contact_value']),
            'notes' => sanitize($data['notes'] ?? null),
            'amount' => $amount,
            'currency' => 'RUB',
            'status' => 'pending'
        ];
        
        $orderInsertId = insertOrder($pdo, $orderData);
        
        // 5. Создаем платеж в ЮKassa
        $paymentResult = createYookassaPayment($orderId, $amount, $data);
        
        // 6. Сохраняем информацию о платеже
        savePaymentInfo($pdo, $orderId, $paymentResult);
        
        // 7. Обновляем order_id в заказе (если ЮKassa вернула свой ID)
        if (!empty($paymentResult['id'])) {
            $stmt = $pdo->prepare("UPDATE orders SET payment_id = ? WHERE id = ?");
            $stmt->execute([$paymentResult['id'], $orderInsertId]);
        }
        
        $pdo->commit();
        
        // Логируем успешное создание
        logAction('payment_created', [
            'order_id' => $orderId,
            'amount' => $amount,
            'service_type' => $data['service_type']
        ]);
        
        // Возвращаем результат клиенту
        echo json_encode([
            'success' => true,
            'order_id' => $orderId,
            'amount' => $amount,
            'confirmation_url' => $paymentResult['confirmation']['confirmation_url'] ?? null,
            'payment_id' => $paymentResult['id'] ?? null,
            'message' => 'Payment created successfully'
        ]);
        
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
}

function validatePaymentData($data) {
    $errors = [];
    
    // Обязательные поля
    $required = ['service_type', 'region', 'contact_type', 'contact_value'];
    foreach ($required as $field) {
        if (empty($data[$field])) {
            $errors[] = "Field '$field' is required";
        }
    }
    
    // Валидация service_type
    $validServices = ['rank_boost', 'wins_boost', 'placement', 'coaching'];
    if (!empty($data['service_type']) && !in_array($data['service_type'], $validServices)) {
        $errors[] = "Invalid service type";
    }
    
    // Валидация contact_type
    $validContacts = ['telegram', 'discord'];
    if (!empty($data['contact_type']) && !in_array($data['contact_type'], $validContacts)) {
        $errors[] = "Invalid contact type";
    }
    
    // Валидация суммы
    if (isset($data['amount']) && (!is_numeric($data['amount']) || $data['amount'] <= 0)) {
        $errors[] = "Invalid amount";
    }
    
    return $errors;
}

function findOrCreateUser($pdo, $data) {
    // Пытаемся найти пользователя по контакту
    $contactValue = sanitize($data['contact_value']);
    $contactType = sanitize($data['contact_type']);
    
    $field = $contactType === 'telegram' ? 'telegram' : 'discord';
    
    $stmt = $pdo->prepare("SELECT id FROM users WHERE $field = ? LIMIT 1");
    $stmt->execute([$contactValue]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($user) {
        return $user['id'];
    }
    
    // Создаем нового пользователя
    $username = 'user_' . substr(md5($contactValue . time()), 0, 8);
    
    $stmt = $pdo->prepare("
        INSERT INTO users (username, $field) 
        VALUES (?, ?)
    ");
    
    $stmt->execute([$username, $contactValue]);
    
    return $pdo->lastInsertId();
}

function generateOrderId() {
    return 'VAB-' . date('Ymd') . '-' . strtoupper(substr(md5(uniqid()), 0, 6));
}

function calculateOrderAmount($data) {
    // Если сумма уже передана, используем её
    if (!empty($data['amount']) && is_numeric($data['amount'])) {
        return floatval($data['amount']);
    }
    
    // Иначе рассчитываем на основе типа услуги и региона
    $basePrices = [
        'rank_boost' => 1999,
        'wins_boost' => 299,
        'placement' => 2499,
        'coaching' => 999
    ];
    
    $regionMultipliers = [
        'RU' => 1.0,
        'EU' => 1.2,
        'NA' => 1.3,
        'ASIA' => 1.4,
        'OTHER' => 1.5
    ];
    
    $serviceType = $data['service_type'];
    $region = $data['region'] ?? 'RU';
    
    $basePrice = $basePrices[$serviceType] ?? 0;
    $multiplier = $regionMultipliers[$region] ?? 1.0;
    
    $amount = $basePrice * $multiplier;
    
    // Дополнительная логика для рангов
    if ($serviceType === 'rank_boost' && !empty($data['current_rank']) && !empty($data['target_rank'])) {
        $rankDifference = calculateRankDifference($data['current_rank'], $data['target_rank']);
        $amount += $rankDifference * 500; // +500 за каждый ранг
    }
    
    return round($amount);
}

function calculateRankDifference($currentRank, $targetRank) {
    $ranks = [
        'Iron 1', 'Iron 2', 'Iron 3',
        'Bronze 1', 'Bronze 2', 'Bronze 3',
        'Silver 1', 'Silver 2', 'Silver 3',
        'Gold 1', 'Gold 2', 'Gold 3',
        'Platinum 1', 'Platinum 2', 'Platinum 3',
        'Diamond 1', 'Diamond 2', 'Diamond 3',
        'Ascendant 1', 'Ascendant 2', 'Ascendant 3',
        'Immortal 1', 'Immortal 2', 'Immortal 3',
        'Radiant'
    ];
    
    $currentIndex = array_search($currentRank, $ranks);
    $targetIndex = array_search($targetRank, $ranks);
    
    if ($currentIndex !== false && $targetIndex !== false && $targetIndex > $currentIndex) {
        return $targetIndex - $currentIndex;
    }
    
    return 0;
}

function insertOrder($pdo, $orderData) {
    $columns = implode(', ', array_keys($orderData));
    $placeholders = implode(', ', array_fill(0, count($orderData), '?'));
    
    $stmt = $pdo->prepare("INSERT INTO orders ($columns) VALUES ($placeholders)");
    $stmt->execute(array_values($orderData));
    
    return $pdo->lastInsertId();
}

function createYookassaPayment($orderId, $amount, $data) {
    // Инициализация клиента ЮKassa
    $client = new Client();
    $client->setAuth(YOOKASSA_SHOP_ID, YOOKASSA_SECRET_KEY);
    
    // Описание платежа
    $description = getServiceName($data['service_type']) . ' - VAB BOOST';
    if (!empty($data['current_rank']) && !empty($data['target_rank'])) {
        $description .= " ($data[current_rank] → $data[target_rank])";
    }
    
    // Данные для платежа
    $paymentData = [
        'amount' => [
            'value' => number_format($amount, 2, '.', ''),
            'currency' => 'RUB',
        ],
        'confirmation' => [
            'type' => 'redirect',
            'return_url' => YOOKASSA_RETURN_URL . '?order_id=' . $orderId,
        ],
        'capture' => true,
        'description' => $description,
        'metadata' => [
            'order_id' => $orderId,
            'service_type' => $data['service_type'],
            'customer_contact' => $data['contact_value']
        ],
        'receipt' => [
            'customer' => [
                'email' => 'customer@example.com', // Можно получить из данных пользователя
            ],
            'items' => [
                [
                    'description' => getServiceName($data['service_type']),
                    'quantity' => 1,
                    'amount' => [
                        'value' => number_format($amount, 2, '.', ''),
                        'currency' => 'RUB',
                    ],
                    'vat_code' => 1, // НДС 20%
                ]
            ]
        ]
    ];
    
    try {
        $payment = $client->createPayment($paymentData, uniqid('', true));
        return $payment->jsonSerialize();
    } catch (Exception $e) {
        error_log("YooKassa API Error: " . $e->getMessage());
        throw new Exception("Failed to create payment: " . $e->getMessage());
    }
}

function getServiceName($serviceType) {
    $services = [
        'rank_boost' => 'Повышение ранга в Valorant',
        'wins_boost' => 'Буст побед в Valorant',
        'placement' => 'Калибровка аккаунта Valorant',
        'coaching' => 'Коучинг по Valorant'
    ];
    
    return $services[$serviceType] ?? $serviceType;
}

function savePaymentInfo($pdo, $orderId, $paymentResult) {
    $stmt = $pdo->prepare("
        INSERT INTO payments 
        (order_id, payment_id, amount, currency, status, confirmation_url, metadata) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ");
    
    $stmt->execute([
        $orderId,
        $paymentResult['id'] ?? null,
        $paymentResult['amount']['value'] ?? 0,
        $paymentResult['amount']['currency'] ?? 'RUB',
        $paymentResult['status'] ?? 'pending',
        $paymentResult['confirmation']['confirmation_url'] ?? null,
        json_encode($paymentResult['metadata'] ?? [], JSON_UNESCAPED_UNICODE)
    ]);
}

// ==================== ПРОВЕРКА СТАТУСА ПЛАТЕЖА ====================

function checkPaymentStatus() {
    $paymentId = $_GET['payment_id'] ?? null;
    $orderId = $_GET['order_id'] ?? null;
    
    if (!$paymentId && !$orderId) {
        http_response_code(400);
        echo json_encode(['error' => 'Payment ID or Order ID is required']);
        return;
    }
    
    $pdo = getDBConnection();
    
    // Ищем платеж в БД
    $query = "SELECT * FROM payments WHERE ";
    $params = [];
    
    if ($paymentId) {
        $query .= "payment_id = ?";
        $params[] = $paymentId;
    } else {
        $query .= "order_id = ?";
        $params[] = $orderId;
    }
    
    $stmt = $pdo->prepare($query . " ORDER BY created_at DESC LIMIT 1");
    $stmt->execute($params);
    $payment = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$payment) {
        http_response_code(404);
        echo json_encode(['error' => 'Payment not found']);
        return;
    }
    
    // Если нужно, проверяем статус в ЮKassa
    $checkYookassa = $_GET['force_check'] ?? false;
    if ($checkYookassa && $payment['status'] !== 'succeeded') {
        try {
            $client = new Client();
            $client->setAuth(YOOKASSA_SHOP_ID, YOOKASSA_SECRET_KEY);
            
            $yookassaPayment = $client->getPaymentInfo($payment['payment_id']);
            $newStatus = $yookassaPayment->getStatus();
            
            // Обновляем статус в БД если изменился
            if ($newStatus !== $payment['status']) {
                $updateStmt = $pdo->prepare("
                    UPDATE payments 
                    SET status = ?, paid = ?, updated_at = NOW() 
                    WHERE payment_id = ?
                ");
                $updateStmt->execute([
                    $newStatus,
                    $newStatus === 'succeeded' ? 1 : 0,
                    $payment['payment_id']
                ]);
                
                // Обновляем статус заказа
                if ($newStatus === 'succeeded') {
                    $orderUpdate = $pdo->prepare("
                        UPDATE orders 
                        SET status = 'paid', updated_at = NOW() 
                        WHERE order_id = ?
                    ");
                    $orderUpdate->execute([$payment['order_id']]);
                }
                
                $payment['status'] = $newStatus;
                $payment['paid'] = $newStatus === 'succeeded' ? 1 : 0;
            }
        } catch (Exception $e) {
            error_log("YooKassa status check error: " . $e->getMessage());
        }
    }
    
    echo json_encode([
        'success' => true,
        'payment' => $payment,
        'checked_at' => date('Y-m-d H:i:s')
    ]);
}

// ==================== WEBHOOK ДЛЯ ЮKASSA ====================

// Этот метод должен быть доступен по публичному URL для получения уведомлений от ЮKassa
function handleYookassaWebhook() {
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);
    
    if (empty($data['event']) || empty($data['object'])) {
        http_response_code(400);
        return;
    }
    
    $event = $data['event'];
    $payment = $data['object'];
    
    error_log("YooKassa webhook received: $event, payment ID: " . ($payment['id'] ?? 'unknown'));
    
    // Проверяем подпись (рекомендуется для безопасности)
    if (!verifyWebhookSignature()) {
        error_log("YooKassa webhook signature verification failed");
        http_response_code(401);
        return;
    }
    
    $pdo = getDBConnection();
    
    try {
        // Обновляем статус платежа в БД
        $stmt = $pdo->prepare("
            UPDATE payments 
            SET status = ?, paid = ?, updated_at = NOW() 
            WHERE payment_id = ?
        ");
        
        $paid = $event === 'payment.succeeded' ? 1 : 0;
        $stmt->execute([$payment['status'], $paid, $payment['id']]);
        
        // Если платеж успешен, обновляем статус заказа
        if ($event === 'payment.succeeded') {
            $orderUpdate = $pdo->prepare("
                UPDATE orders 
                SET status = 'paid', updated_at = NOW() 
                WHERE payment_id = ?
            ");
            $orderUpdate->execute([$payment['id']]);
            
            // Логируем успешный платеж
            logAction('payment_success', [
                'payment_id' => $payment['id'],
                'amount' => $payment['amount']['value'],
                'currency' => $payment['amount']['currency']
            ]);
        }
        
        http_response_code(200);
        
    } catch (Exception $e) {
        error_log("Webhook processing error: " . $e->getMessage());
        http_response_code(500);
    }
}

function verifyWebhookSignature() {
    // В реальном проекте нужно проверять подпись от ЮKassa
    // Для тестирования можно отключить
    return true;
}

?>