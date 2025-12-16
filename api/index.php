<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Подключаем конфигурацию БД
require_once __DIR__ . '/config/database.php';

// Инициализируем БД
$database = new Database();
$db = $database->getConnection();

if (!$db) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection failed']);
    exit();
}

// Получаем маршрут
$route = isset($_GET['route']) ? $_GET['route'] : '';
$method = $_SERVER['REQUEST_METHOD'];

// Получаем данные запроса
$data = json_decode(file_get_contents('php://input'), true);
if (!$data) {
    $data = $_POST;
}

// Функция для получения заголовка Authorization
function getAuthorizationHeader() {
    $headers = null;
    if (isset($_SERVER['Authorization'])) {
        $headers = trim($_SERVER['Authorization']);
    } elseif (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $headers = trim($_SERVER['HTTP_AUTHORIZATION']);
    } elseif (function_exists('apache_request_headers')) {
        $requestHeaders = apache_request_headers();
        $requestHeaders = array_combine(array_map('ucwords', array_keys($requestHeaders)), array_values($requestHeaders));
        if (isset($requestHeaders['Authorization'])) {
            $headers = trim($requestHeaders['Authorization']);
        }
    }
    return $headers;
}

// Функция для получения токена
function getBearerToken() {
    $headers = getAuthorizationHeader();
    if (!empty($headers) && preg_match('/Bearer\s(\S+)/', $headers, $matches)) {
        return $matches[1];
    }
    return null;
}

// Получаем токен
$token = getBearerToken();

// Определяем обработчик на основе маршрута
switch ($route) {
    case 'cart':
        require_once __DIR__ . '/controllers/CartController.php';
        $controller = new CartController($db);
        $controller->handleRequest($method, $data);
        break;
        
    case 'services':
        require_once __DIR__ . '/controllers/ServiceController.php';
        $controller = new ServiceController($db);
        $controller->handleRequest($method, $data);
        break;
        
    case 'payment/create':
        require_once __DIR__ . '/controllers/PaymentController.php';
        $controller = new PaymentController($db);
        $controller->handleRequest($method, $data);
        break;
        
    case 'auth/login':
        require_once __DIR__ . '/controllers/AuthController.php';
        $controller = new AuthController($db);
        $controller->login($data);
        break;
        
    case 'auth/register':
        require_once __DIR__ . '/controllers/AuthController.php';
        $controller = new AuthController($db);
        $controller->register($data);
        break;
        
    case 'auth/logout':
        require_once __DIR__ . '/controllers/AuthController.php';
        $controller = new AuthController($db);
        $controller->logout();
        break;
        
    case 'reviews':
        require_once __DIR__ . '/controllers/ReviewController.php';
        $controller = new ReviewController($db);
        $controller->handleRequest($method, $data);
        break;
        
    case 'stats':
        require_once __DIR__ . '/controllers/StatsController.php';
        $controller = new StatsController($db);
        $controller->handleRequest($method, $data);
        break;
        
    case 'orders/create':
        require_once __DIR__ . '/controllers/OrderController.php';
        $controller = new OrderController($db);
        $controller->handleRequest($method, $data);
        break;
        
    default:
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Endpoint not found']);
        break;
}