<?php
class AuthController {
    private $db;
    private $userModel;
    
    public function __construct($db) {
        $this->db = $db;
        $this->userModel = new User($db);
    }
    
    public function handleRequest($method, $param, $data) {
        switch ($method) {
            case 'POST':
                if ($param === 'login') {
                    $this->login($data);
                } elseif ($param === 'register') {
                    $this->register($data);
                } elseif ($param === 'logout') {
                    $this->logout($data);
                } else {
                    $this->notFound();
                }
                break;
                
            case 'GET':
                if ($param === 'profile') {
                    $this->getProfile($data);
                } else {
                    $this->notFound();
                }
                break;
                
            default:
                $this->methodNotAllowed();
        }
    }
    
    private function login($data) {
        $email = $data['email'] ?? '';
        $password = $data['password'] ?? '';
        
        if (empty($email) || empty($password)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Email and password are required']);
            return;
        }
        
        $user = $this->userModel->findByEmail($email);
        if (!$user) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Invalid credentials']);
            return;
        }
        
        if (!$this->userModel->verifyPassword($password, $user['password_hash'])) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Invalid credentials']);
            return;
        }
        
        if ($user['status'] !== 'active') {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Account is not active']);
            return;
        }
        
        // Генерируем токен
        $token = bin2hex(random_bytes(32));
        $ip = $_SERVER['REMOTE_ADDR'] ?? '';
        $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';
        
        // Создаем сессию
        $this->userModel->createSession($user['id'], $token, $ip, $userAgent);
        
        // Очищаем старые сессии
        $this->userModel->cleanupSessions();
        
        // Убираем пароль из ответа
        unset($user['password_hash']);
        
        echo json_encode([
            'success' => true,
            'message' => 'Login successful',
            'token' => $token,
            'user' => $user
        ]);
    }
    
    private function register($data) {
        $email = $data['email'] ?? '';
        $password = $data['password'] ?? '';
        $telegram = $data['telegram'] ?? null;
        $name = $data['name'] ?? '';
        
        if (empty($email) || empty($password)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Email and password are required']);
            return;
        }
        
        // Проверяем существование пользователя
        $existingUser = $this->userModel->findByEmail($email);
        if ($existingUser) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Email already registered']);
            return;
        }
        
        // Проверяем telegram если указан
        if ($telegram) {
            $existingTelegram = $this->userModel->findByTelegram($telegram);
            if ($existingTelegram) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Telegram already registered']);
                return;
            }
        }
        
        // Создаем пользователя
        $this->userModel->email = $email;
        $this->userModel->telegram = $telegram;
        $this->userModel->password_hash = $password;
        $this->userModel->name = $name;
        
        if (!$this->userModel->create()) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Registration failed']);
            return;
        }
        
        // Автоматически логиним пользователя
        $user = $this->userModel->findByEmail($email);
        
        // Генерируем токен
        $token = bin2hex(random_bytes(32));
        $ip = $_SERVER['REMOTE_ADDR'] ?? '';
        $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';
        
        $this->userModel->createSession($user['id'], $token, $ip, $userAgent);
        
        unset($user['password_hash']);
        
        echo json_encode([
            'success' => true,
            'message' => 'Registration successful',
            'token' => $token,
            'user' => $user
        ]);
    }
    
    private function logout($data) {
        $token = getBearerToken();
        if ($token) {
            $this->userModel->deleteSession($token);
        }
        
        echo json_encode(['success' => true, 'message' => 'Logged out']);
    }
    
    private function getProfile($data) {
        $token = getBearerToken();
        if (!$token) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Not authenticated']);
            return;
        }
        
        $session = $this->userModel->validateSession($token);
        if (!$session) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Session expired']);
            return;
        }
        
        unset($session['password_hash']);
        unset($session['token']);
        
        echo json_encode([
            'success' => true,
            'user' => $session
        ]);
    }
    
    private function notFound() {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Endpoint not found']);
    }
    
    private function methodNotAllowed() {
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    }
}