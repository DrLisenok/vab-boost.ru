<?php
class CartController {
    private $db;
    
    public function __construct($db) {
        $this->db = $db;
    }
    
    public function handleRequest($method, $data) {
        switch ($method) {
            case 'GET':
                $this->getCart();
                break;
            case 'POST':
                if (isset($_GET['action']) && $_GET['action'] === 'add') {
                    $this->addToCart($data);
                } else {
                    $this->updateCart($data);
                }
                break;
            case 'DELETE':
                $this->clearCart();
                break;
            default:
                http_response_code(405);
                echo json_encode(['success' => false, 'message' => 'Method not allowed']);
        }
    }
    
    private function getCart() {
        $sessionId = $this->getSessionId();
        
        try {
            $query = "SELECT * FROM carts WHERE session_id = :session_id";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':session_id', $sessionId);
            $stmt->execute();
            
            $cart = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($cart) {
                $items = json_decode($cart['items'], true);
                echo json_encode([
                    'success' => true,
                    'items' => $items ?: [],
                    'total' => $cart['total']
                ]);
            } else {
                echo json_encode([
                    'success' => true,
                    'items' => [],
                    'total' => 0
                ]);
            }
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Database error']);
        }
    }
    
    private function addToCart($data) {
        $sessionId = $this->getSessionId();
        
        if (!isset($data['id']) || !isset($data['name']) || !isset($data['price'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Missing required fields']);
            return;
        }
        
        try {
            // Получаем текущую корзину
            $query = "SELECT * FROM carts WHERE session_id = :session_id";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':session_id', $sessionId);
            $stmt->execute();
            
            $cart = $stmt->fetch(PDO::FETCH_ASSOC);
            
            $items = [];
            if ($cart) {
                $items = json_decode($cart['items'], true);
            }
            
            // Добавляем или обновляем товар
            $found = false;
            foreach ($items as &$item) {
                if ($item['id'] == $data['id']) {
                    $item['quantity'] += isset($data['quantity']) ? $data['quantity'] : 1;
                    $found = true;
                    break;
                }
            }
            
            if (!$found) {
                $items[] = [
                    'id' => $data['id'],
                    'name' => $data['name'],
                    'price' => $data['price'],
                    'icon' => isset($data['icon']) ? $data['icon'] : 'gamepad',
                    'quantity' => isset($data['quantity']) ? $data['quantity'] : 1
                ];
            }
            
            // Рассчитываем итог
            $total = 0;
            foreach ($items as $item) {
                $total += $item['price'] * $item['quantity'];
            }
            
            // Сохраняем в БД
            if ($cart) {
                $query = "UPDATE carts SET items = :items, total = :total, updated_at = NOW() 
                         WHERE session_id = :session_id";
            } else {
                $query = "INSERT INTO carts (session_id, items, total) 
                         VALUES (:session_id, :items, :total)";
            }
            
            $stmt = $this->db->prepare($query);
            $itemsJson = json_encode($items);
            $stmt->bindParam(':session_id', $sessionId);
            $stmt->bindParam(':items', $itemsJson);
            $stmt->bindParam(':total', $total);
            $stmt->execute();
            
            echo json_encode([
                'success' => true,
                'message' => 'Item added to cart',
                'items' => $items,
                'total' => $total
            ]);
            
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Database error']);
        }
    }
    
    private function updateCart($data) {
        $sessionId = $this->getSessionId();
        
        if (!isset($data['items'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Missing items data']);
            return;
        }
        
        try {
            $items = $data['items'];
            $total = 0;
            
            foreach ($items as $item) {
                $total += $item['price'] * $item['quantity'];
            }
            
            $query = "SELECT * FROM carts WHERE session_id = :session_id";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':session_id', $sessionId);
            $stmt->execute();
            
            $cart = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($cart) {
                $query = "UPDATE carts SET items = :items, total = :total, updated_at = NOW() 
                         WHERE session_id = :session_id";
            } else {
                $query = "INSERT INTO carts (session_id, items, total) 
                         VALUES (:session_id, :items, :total)";
            }
            
            $stmt = $this->db->prepare($query);
            $itemsJson = json_encode($items);
            $stmt->bindParam(':session_id', $sessionId);
            $stmt->bindParam(':items', $itemsJson);
            $stmt->bindParam(':total', $total);
            $stmt->execute();
            
            echo json_encode([
                'success' => true,
                'message' => 'Cart updated',
                'items' => $items,
                'total' => $total
            ]);
            
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Database error']);
        }
    }
    
    private function clearCart() {
        $sessionId = $this->getSessionId();
        
        try {
            $query = "DELETE FROM carts WHERE session_id = :session_id";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':session_id', $sessionId);
            $stmt->execute();
            
            echo json_encode(['success' => true, 'message' => 'Cart cleared']);
            
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Database error']);
        }
    }
    
    private function getSessionId() {
        if (!isset($_COOKIE['cart_session'])) {
            $sessionId = bin2hex(random_bytes(16));
            setcookie('cart_session', $sessionId, time() + (86400 * 30), "/");
        } else {
            $sessionId = $_COOKIE['cart_session'];
        }
        
        return $sessionId;
    }
}