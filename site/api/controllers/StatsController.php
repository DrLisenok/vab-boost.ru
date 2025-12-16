<?php
class StatsController {
    private $db;
    
    public function __construct($db) {
        $this->db = $db;
    }
    
    public function handleRequest($method, $data) {
        if ($method === 'GET') {
            $this->getStats();
        } else {
            http_response_code(405);
            echo json_encode(['success' => false, 'message' => 'Method not allowed']);
        }
    }
    
    private function getStats() {
        try {
            // Получаем статистику заказов
            $query = "SELECT COUNT(*) as total_orders, COALESCE(SUM(total), 0) as total_revenue FROM orders 
                     WHERE status = 'completed'";
            $stmt = $this->db->prepare($query);
            $stmt->execute();
            $orders = $stmt->fetch(PDO::FETCH_ASSOC);
            
            // Получаем количество пользователей
            $query = "SELECT COUNT(*) as total_users FROM users WHERE status = 'active'";
            $stmt = $this->db->prepare($query);
            $stmt->execute();
            $users = $stmt->fetch(PDO::FETCH_ASSOC);
            
            // Получаем средний рейтинг
            $query = "SELECT COALESCE(AVG(rating), 4.9) as avg_rating FROM reviews WHERE is_approved = TRUE";
            $stmt = $this->db->prepare($query);
            $stmt->execute();
            $rating = $stmt->fetch(PDO::FETCH_ASSOC);
            
            $stats = [
                [
                    'icon' => 'shopping-cart',
                    'value' => intval($orders['total_orders']),
                    'label' => 'Выполненных заказов'
                ],
                [
                    'icon' => 'ruble-sign',
                    'value' => number_format(floatval($orders['total_revenue']), 0, '', ' '),
                    'label' => 'Общая выручка'
                ],
                [
                    'icon' => 'users',
                    'value' => intval($users['total_users']),
                    'label' => 'Довольных клиентов'
                ],
                [
                    'icon' => 'star',
                    'value' => number_format(floatval($rating['avg_rating']), 1),
                    'label' => 'Средний рейтинг'
                ]
            ];
            
            echo json_encode([
                'success' => true,
                'stats' => $stats
            ]);
            
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
        }
    }
}