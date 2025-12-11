<?php
// users.php
require_once '../config.php';

// Устанавливаем заголовки CORS
setCorsHeaders();

// Проверяем авторизацию
if (!checkAdminAuth()) {
    jsonResponse(['error' => 'Unauthorized'], 401);
}

// Получаем метод запроса
$method = $_SERVER['REQUEST_METHOD'];

// Подключаемся к БД
$pdo = getDBConnection();
if (!$pdo) {
    jsonResponse(['error' => 'Database connection failed'], 500);
}

// Получаем параметры запроса
$id = $_GET['id'] ?? null;
$limit = $_GET['limit'] ?? 20;
$page = $_GET['page'] ?? 1;

// Обработка запросов
switch ($method) {
    case 'GET':
        handleGetRequest($pdo, $id, $limit, $page);
        break;
    case 'DELETE':
        handleDeleteRequest($pdo, $id);
        break;
    default:
        jsonResponse(['error' => 'Method not allowed'], 405);
}

/**
 * Обработка GET запросов
 */
function handleGetRequest($pdo, $id, $limit, $page) {
    if ($id) {
        // Получение одного пользователя с его заказами
        $stmt = $pdo->prepare("
            SELECT u.*, 
                   COUNT(o.id) as total_orders,
                   SUM(o.amount) as total_spent
            FROM users u
            LEFT JOIN orders o ON u.id = o.user_id
            WHERE u.id = ?
            GROUP BY u.id
        ");
        $stmt->execute([$id]);
        $user = $stmt->fetch();
        
        if (!$user) {
            jsonResponse(['error' => 'User not found'], 404);
        }
        
        // Получаем заказы пользователя
        $stmt = $pdo->prepare("
            SELECT * FROM orders 
            WHERE user_id = ? 
            ORDER BY created_at DESC 
            LIMIT 10
        ");
        $stmt->execute([$id]);
        $user['orders'] = $stmt->fetchAll();
        
        jsonResponse($user);
    }
    
    // Получение списка пользователей
    // Получаем общее количество
    $stmt = $pdo->query("SELECT COUNT(*) as total FROM users");
    $total = $stmt->fetch()['total'];
    
    // Рассчитываем смещение
    $offset = ($page - 1) * $limit;
    
    // Получаем пользователей с их статистикой
    $stmt = $pdo->prepare("
        SELECT u.*, 
               COUNT(o.id) as total_orders,
               SUM(o.amount) as total_spent
        FROM users u
        LEFT JOIN orders o ON u.id = o.user_id
        GROUP BY u.id
        ORDER BY u.created_at DESC
        LIMIT ? OFFSET ?
    ");
    
    $stmt->execute([(int)$limit, (int)$offset]);
    $users = $stmt->fetchAll();
    
    jsonResponse([
        'users' => $users,
        'pagination' => [
            'page' => (int)$page,
            'limit' => (int)$limit,
            'total' => (int)$total,
            'pages' => ceil($total / $limit)
        ]
    ]);
}

/**
 * Обработка DELETE запросов
 */
function handleDeleteRequest($pdo, $id) {
    if (!$id) {
        jsonResponse(['error' => 'User ID is required'], 400);
    }
    
    // Проверяем существование пользователя
    $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
    $stmt->execute([$id]);
    $user = $stmt->fetch();
    
    if (!$user) {
        jsonResponse(['error' => 'User not found'], 404);
    }
    
    // Проверяем, есть ли у пользователя заказы
    $stmt = $pdo->prepare("SELECT COUNT(*) as order_count FROM orders WHERE user_id = ?");
    $stmt->execute([$id]);
    $orderCount = $stmt->fetch()['order_count'];
    
    if ($orderCount > 0) {
        jsonResponse(['error' => 'Cannot delete user with existing orders'], 400);
    }
    
    try {
        $stmt = $pdo->prepare("DELETE FROM users WHERE id = ?");
        $stmt->execute([$id]);
        
        // Логируем действие
        if (isset($_SESSION['admin_id'])) {
            logAdminAction($_SESSION['admin_id'], 'delete_user', "Deleted user: $id");
        }
        
        jsonResponse([
            'success' => true,
            'message' => 'User deleted successfully'
        ]);
        
    } catch (PDOException $e) {
        error_log("User deletion failed: " . $e->getMessage());
        jsonResponse(['error' => 'Failed to delete user'], 500);
    }
}
?>