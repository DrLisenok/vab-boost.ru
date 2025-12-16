<?php
class Service {
    private $conn;
    private $table = 'services';
    
    public $id;
    public $category_id;
    public $name;
    public $description;
    public $price;
    public $old_price;
    public $duration;
    public $icon;
    public $sort_order;
    public $is_popular;
    public $is_active;
    public $created_at;
    
    public function __construct($db) {
        $this->conn = $db;
    }
    
    public function getAll() {
        $query = "SELECT s.*, c.name as category_name 
                 FROM " . $this->table . " s
                 LEFT JOIN service_categories c ON s.category_id = c.id
                 WHERE s.is_active = TRUE
                 ORDER BY c.sort_order, s.sort_order";
        
        $stmt = $this->conn->prepare($query);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    public function getById($id) {
        $query = "SELECT s.*, c.name as category_name 
                 FROM " . $this->table . " s
                 LEFT JOIN service_categories c ON s.category_id = c.id
                 WHERE s.id = :id AND s.is_active = TRUE";
        
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }
    
    public function getCategories() {
        $query = "SELECT * FROM service_categories 
                 WHERE is_active = TRUE
                 ORDER BY sort_order";
        
        $stmt = $this->conn->prepare($query);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    public function getPopular() {
        $query = "SELECT s.*, c.name as category_name 
                 FROM " . $this->table . " s
                 LEFT JOIN service_categories c ON s.category_id = c.id
                 WHERE s.is_popular = TRUE AND s.is_active = TRUE
                 ORDER BY s.sort_order
                 LIMIT 6";
        
        $stmt = $this->conn->prepare($query);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}