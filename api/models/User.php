<?php
class User {
    private $conn;
    private $table = 'users';
    
    public $id;
    public $email;
    public $telegram;
    public $password_hash;
    public $name;
    public $balance;
    public $role;
    public $status;
    public $created_at;
    public $updated_at;
    
    public function __construct($db) {
        $this->conn = $db;
    }
    
    public function create() {
        $query = "INSERT INTO " . $this->table . "
                SET email = :email,
                    telegram = :telegram,
                    password_hash = :password_hash,
                    name = :name,
                    role = 'user',
                    status = 'active'";
        
        $stmt = $this->conn->prepare($query);
        
        $this->email = htmlspecialchars(strip_tags($this->email));
        $this->telegram = htmlspecialchars(strip_tags($this->telegram));
        $this->password_hash = password_hash($this->password_hash, PASSWORD_BCRYPT);
        $this->name = htmlspecialchars(strip_tags($this->name));
        
        $stmt->bindParam(':email', $this->email);
        $stmt->bindParam(':telegram', $this->telegram);
        $stmt->bindParam(':password_hash', $this->password_hash);
        $stmt->bindParam(':name', $this->name);
        
        if ($stmt->execute()) {
            $this->id = $this->conn->lastInsertId();
            return true;
        }
        return false;
    }
    
    public function findByEmail($email) {
        $query = "SELECT * FROM " . $this->table . " WHERE email = :email LIMIT 1";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':email', $email);
        $stmt->execute();
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }
    
    public function findByTelegram($telegram) {
        $query = "SELECT * FROM " . $this->table . " WHERE telegram = :telegram LIMIT 1";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':telegram', $telegram);
        $stmt->execute();
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }
    
    public function verifyPassword($password, $hash) {
        return password_verify($password, $hash);
    }
    
    public function createSession($userId, $token, $ip, $userAgent, $expiresIn = 86400) {
        $query = "INSERT INTO user_sessions 
                SET user_id = :user_id,
                    token = :token,
                    ip_address = :ip_address,
                    user_agent = :user_agent,
                    expires_at = DATE_ADD(NOW(), INTERVAL :expires_in SECOND)";
        
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':user_id', $userId);
        $stmt->bindParam(':token', $token);
        $stmt->bindParam(':ip_address', $ip);
        $stmt->bindParam(':user_agent', $userAgent);
        $stmt->bindParam(':expires_in', $expiresIn);
        
        return $stmt->execute();
    }
    
    public function validateSession($token) {
        $query = "SELECT us.*, u.* FROM user_sessions us
                 JOIN users u ON us.user_id = u.id
                 WHERE us.token = :token 
                 AND us.expires_at > NOW()
                 AND u.status = 'active'";
        
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':token', $token);
        $stmt->execute();
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }
    
    public function deleteSession($token) {
        $query = "DELETE FROM user_sessions WHERE token = :token";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':token', $token);
        return $stmt->execute();
    }
    
    public function cleanupSessions() {
        $query = "DELETE FROM user_sessions WHERE expires_at <= NOW()";
        $stmt = $this->conn->prepare($query);
        return $stmt->execute();
    }
}