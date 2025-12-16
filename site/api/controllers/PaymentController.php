<?php
class PaymentController {
    private $db;
    
    public function __construct($db) {
        $this->db = $db;
    }
    
    public function handleRequest($method, $data) {
        if ($method === 'POST') {
            $this->createPayment($data);
        } else {
            http_response_code(405);
            echo json_encode(['success' => false, 'message' => 'Method not allowed']);
        }
    }
    
    private function createPayment($data) {
        // Валидация данных
        if (!isset($data['order_id']) || !isset($data['amount']) || !isset($data['description'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Missing required fields']);
            return;
        }
        
        try {
            // Создаем платеж в БД
            $query = "INSERT INTO payments (order_id, amount, description, status) 
                     VALUES (:order_id, :amount, :description, 'pending')";
            
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':order_id', $data['order_id']);
            $stmt->bindParam(':amount', $data['amount']);
            $stmt->bindParam(':description', $data['description']);
            $stmt->execute();
            
            $paymentId = $this->db->lastInsertId();
            
            // Генерируем ссылку для оплаты
            $paymentUrl = $this->generateYooKassaPayment($data);
            
            echo json_encode([
                'success' => true,
                'payment_id' => $paymentId,
                'payment_url' => $paymentUrl,
                'message' => 'Payment created successfully'
            ]);
            
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
        }
    }
    
    private function generateYooKassaPayment($data) {
        // Тестовые данные ЮKassa
        $shopId = '1226686';
        $secretKey = 'test_3LHmCEnVpAOe_1nR3kfj1voQeuy-4kJtVqaBuhtBFY8';
        
        // Формируем данные для платежа
        $amount = number_format(floatval($data['amount']), 2, '.', '');
        
        // Для тестирования возвращаем заглушку
        // В реальном проекте здесь будет вызов API ЮKassa
        $paymentUrl = 'https://yookassa.ru/integration/simplepay?orderId=' . $data['order_id'] . 
                     '&amount=' . $amount . 
                     '&description=' . urlencode($data['description']) . 
                     '&shopId=' . $shopId . 
                     '&demo=true';
        
        return $paymentUrl;
    }
}