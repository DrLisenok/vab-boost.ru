<?php
class Order {
    private $conn;
    private $table = 'orders';
    
    public function __construct($db) {
        $this->conn = $db;
    }
    
    public function create($data) {
        try {
            $this->conn->beginTransaction();
            
            // Создаем заказ
            $query = "INSERT INTO orders 
                     SET user_id = :user_id,
                         total = :total,
                         game_login = :game_login,
                         game_password = :game_password,
                         notes = :notes";
            
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':user_id', $data['user_id']);
            $stmt->bindParam(':total', $data['total']);
            $stmt->bindParam(':game_login', $data['game_login']);
            $stmt->bindParam(':game_password', $data['game_password']);
            $stmt->bindParam(':notes', $data['notes']);
            
            if (!$stmt->execute()) {
                throw new Exception('Failed to create order');
            }
            
            $orderId = $this->conn->lastInsertId();
            
            // Добавляем товары в заказ
            foreach ($data['items'] as $item) {
                $query = "INSERT INTO order_items 
                         SET order_id = :order_id,
                             service_id = :service_id,
                             name = :name,
                             price = :price,
                             quantity = :quantity,
                             total = :total";
                
                $stmt = $this->conn->prepare($query);
                $stmt->bindParam(':order_id', $orderId);
                $stmt->bindParam(':service_id', $item['id']);
                $stmt->bindParam(':name', $item['name']);
                $stmt->bindParam(':price', $item['price']);
                $stmt->bindParam(':quantity', $item['quantity']);
                $total = $item['price'] * $item['quantity'];
                $stmt->bindParam(':total', $total);
                
                if (!$stmt->execute()) {
                    throw new Exception('Failed to add order items');
                }
            }
            
            $this->conn->commit();
            return $orderId;
            
        } catch (Exception $e) {
            $this->conn->rollBack();
            error_log($e->getMessage());
            return false;
        }
    }
    
    public function getById($id) {
        $query = "SELECT o.*, 
                 GROUP_CONCAT(CONCAT(oi.name, ' (x', oi.quantity, ')') SEPARATOR ', ') as items_list
                 FROM orders o
                 LEFT JOIN order_items oi ON o.id = oi.order_id
                 WHERE o.id = :id
                 GROUP BY o.id";
        
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }
    
    public function getByUserId($userId) {
        $query = "SELECT o.*, 
                 (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as items_count
                 FROM orders o
                 WHERE o.user_id = :user_id
                 ORDER BY o.created_at DESC";
        
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':user_id', $userId);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}