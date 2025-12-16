<?php
class ServiceController {
    private $db;
    
    public function __construct($db) {
        $this->db = $db;
    }
    
    public function handleRequest($method, $data) {
        if ($method === 'GET') {
            $this->getServices();
        } else {
            http_response_code(405);
            echo json_encode(['success' => false, 'message' => 'Method not allowed']);
        }
    }
    
    private function getServices() {
        try {
            $query = "SELECT * FROM services WHERE is_active = TRUE ORDER BY sort_order";
            $stmt = $this->db->prepare($query);
            $stmt->execute();
            
            $services = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            echo json_encode([
                'success' => true,
                'services' => $services
            ]);
            
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Database error']);
        }
    }
}