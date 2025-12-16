<?php
class OrderController {
    private $db;
    
    public function __construct($db) {
        $this->db = $db;
    }
    
    public function handleRequest($method, $data) {
        if ($method === 'POST') {
            $this->createOrder($data);
        } else {
            http_response_code(405);
            echo json_encode(['success' => false, 'message' => 'Method not allowed']);
        }
    }
    
    private function createOrder($data) {
        if (!isset($data['items']) || !isset($data['total']) || !isset($data['user_id'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Missing required fields']);
            return;
        }
        
        try {
            $this->db->beginTransaction();
            
            // Создаем заказ
            $orderNumber = 'VAB-' . date('Ymd') . '-' . rand(1000, 9999);
            
            $query = "INSERT INTO orders (order_number, user_id, total, status) 
                     VALUES (:order_number, :user_id, :total, 'pending')";
            
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':order_number', $orderNumber);
            $stmt->bindParam(':user_id', $data['user_id']);
            $stmt->bindParam(':total', $data['total']);
            $stmt->execute();
            
            $orderId = $this->db->lastInsertId();
            
            // Добавляем товары в заказ
            foreach ($data['items'] as $item) {
                $query = "INSERT INTO order_items (order_id, name, price, quantity, total) 
                         VALUES (:order_id, :name, :price, :quantity, :total)";
                
                $stmt = $this->db->prepare($query);
                $total = $item['price'] * $item['quantity'];
                $stmt->bindParam(':order_id', $orderId);
                $stmt->bindParam(':name', $item['name']);
                $stmt->bindParam(':price', $item['price']);
                $stmt->bindParam(':quantity', $item['quantity']);
                $stmt->bindParam(':total', $total);
                $stmt->execute();
            }
            
            $this->db->commit();
            
            echo json_encode([
                'success' => true,
                'message' => 'Order created successfully',
                'order' => [
                    'id' => $orderId,
                    'order_number' => $orderNumber,
                    'total' => $data['total'],
                    'status' => 'pending'
                ]
            ]);
            
        } catch (PDOException $e) {
            $this->db->rollBack();
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Database error']);
        }
    }
}