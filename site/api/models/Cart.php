<?php
class Cart {
    private $conn;
    private $table = 'carts';
    
    public $id;
    public $user_id;
    public $session_id;
    public $items;
    public $total;
    public $created_at;
    public $updated_at;
    
    public function __construct($db) {
        $this->conn = $db;
    }
    
    public function getBySession($sessionId) {
        $query = "SELECT * FROM " . $this->table . " 
                 WHERE session_id = :session_id";
        
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':session_id', $sessionId);
        $stmt->execute();
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }
    
    public function getByUser($userId) {
        $query = "SELECT * FROM " . $this->table . " 
                 WHERE user_id = :user_id";
        
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':user_id', $userId);
        $stmt->execute();
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }
    
    public function createOrUpdate($sessionId, $userId = null, $items = []) {
        // Проверяем существующую корзину
        $existingCart = $userId ? $this->getByUser($userId) : $this->getBySession($sessionId);
        
        if ($existingCart) {
            // Обновляем существующую корзину
            $query = "UPDATE " . $this->table . " 
                     SET items = :items,
                         total = :total,
                         updated_at = NOW()
                     WHERE id = :id";
            
            $stmt = $this->conn->prepare($query);
            $itemsJson = json_encode($items);
            $total = $this->calculateTotal($items);
            
            $stmt->bindParam(':items', $itemsJson);
            $stmt->bindParam(':total', $total);
            $stmt->bindParam(':id', $existingCart['id']);
            
            return $stmt->execute();
        } else {
            // Создаем новую корзину
            $query = "INSERT INTO " . $this->table . "
                     SET session_id = :session_id,
                         user_id = :user_id,
                         items = :items,
                         total = :total";
            
            $stmt = $this->conn->prepare($query);
            $itemsJson = json_encode($items);
            $total = $this->calculateTotal($items);
            
            $stmt->bindParam(':session_id', $sessionId);
            $stmt->bindParam(':user_id', $userId);
            $stmt->bindParam(':items', $itemsJson);
            $stmt->bindParam(':total', $total);
            
            return $stmt->execute();
        }
    }
    
    public function delete($id) {
        $query = "DELETE FROM " . $this->table . " WHERE id = :id";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':id', $id);
        return $stmt->execute();
    }
    
    private function calculateTotal($items) {
        $total = 0;
        foreach ($items as $item) {
            $price = floatval($item['price']);
            $quantity = intval($item['quantity'] ?? 1);
            $total += $price * $quantity;
        }
        return $total;
    }
    
    public function mergeCarts($sessionCart, $userCart) {
        $sessionItems = json_decode($sessionCart['items'] ?? '[]', true);
        $userItems = json_decode($userCart['items'] ?? '[]', true);
        
        $mergedItems = $userItems;
        
        foreach ($sessionItems as $sessionItem) {
            $found = false;
            foreach ($mergedItems as &$userItem) {
                if ($userItem['id'] == $sessionItem['id']) {
                    $userItem['quantity'] += $sessionItem['quantity'];
                    $found = true;
                    break;
                }
            }
            
            if (!$found) {
                $mergedItems[] = $sessionItem;
            }
        }
        
        return $mergedItems;
    }
}