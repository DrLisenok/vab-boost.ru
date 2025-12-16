<?php
class ReviewController {
    private $db;
    
    public function __construct($db) {
        $this->db = $db;
    }
    
    public function handleRequest($method, $data) {
        if ($method === 'GET') {
            $this->getReviews();
        } else {
            http_response_code(405);
            echo json_encode(['success' => false, 'message' => 'Method not allowed']);
        }
    }
    
    private function getReviews() {
        try {
            $query = "SELECT * FROM reviews WHERE is_approved = TRUE ORDER BY created_at DESC LIMIT 10";
            $stmt = $this->db->prepare($query);
            $stmt->execute();
            
            $reviews = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            echo json_encode([
                'success' => true,
                'reviews' => $reviews
            ]);
            
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Database error']);
        }
    }
}