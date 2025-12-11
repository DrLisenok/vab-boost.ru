<?php
require_once 'config.php';
setCorsHeaders();

header('Content-Type: application/json; charset=utf-8');

// Получение метода запроса
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

try {
    switch ($method) {
        case 'GET':
            handleGetRequest($action);
            break;
        case 'POST':
            handlePostRequest($action);
            break;
        case 'PUT':
            handlePutRequest();
            break;
        case 'DELETE':
            handleDeleteRequest();
            break;
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
            break;
    }
} catch (Exception $e) {
    error_log("API Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Internal server error', 'message' => $e->getMessage()]);
}

// ==================== GET ЗАПРОСЫ ====================

function handleGetRequest($action) {
    switch ($action) {
        case 'list':
            getOrdersList();
            break;
        case 'details':
            getOrderDetails();
            break;
        case 'check_auth':
            checkAdminAuthentication();
            break;
        case 'login':
            // Это должно быть в POST, но оставим для совместимости
            http_response_code(405);
            echo json_encode(['error' => 'Use POST method for login']);
            break;
        default:
            http_response_code(400);
            echo json_encode(['error' => 'Invalid action']);
            break;
    }
}

function getOrdersList() {
    checkAdminAuth();
    
    $pdo = getDBConnection();
    if (!$pdo) {
        throw new Exception('Database connection failed');
    }

    // Параметры пагинации и фильтрации
    $page = max(1, intval($_GET['page'] ?? 1));
    $perPage = min(100, max(10, intval($_GET['per_page'] ?? 20)));
    $offset = ($page - 1) * $perPage;

    $whereClauses = [];
    $params = [];

    // Фильтр по статусу
    if (!empty($_GET['status'])) {
        $whereClauses[] = "o.status = ?";
        $params[] = sanitize($_GET['status']);
    }

    // Фильтр по дате от
    if (!empty($_GET['date_from'])) {
        $whereClauses[] = "DATE(o.created_at) >= ?";
        $params[] = sanitize($_GET['date_from']);
    }

    // Фильтр по дате до
    if (!empty($_GET['date_to'])) {
        $whereClauses[] = "DATE(o.created_at) <= ?";
        $params[] = sanitize($_GET['date_to']);
    }

    // Поиск по ID или контакту
    if (!empty($_GET['search'])) {
        $search = '%' . sanitize($_GET['search']) . '%';
        $whereClauses[] = "(o.order_id LIKE ? OR o.contact_value LIKE ? OR o.game_login LIKE ?)";
        $params[] = $search;
        $params[] = $search;
        $params[] = $search;
    }

    $whereSQL = $whereClauses ? "WHERE " . implode(" AND ", $whereClauses) : "";

    // Получение общего количества
    $countStmt = $pdo->prepare("SELECT COUNT(*) as total FROM orders o $whereSQL");
    $countStmt->execute($params);
    $total = $countStmt->fetch()['total'];

    // Получение заказов
    $orderBy = $_GET['order_by'] ?? 'created_at';
    $orderDir = strtoupper($_GET['order_dir'] ?? 'DESC') === 'ASC' ? 'ASC' : 'DESC';
    
    $validOrderColumns = ['id', 'order_id', 'created_at', 'updated_at', 'amount', 'status'];
    if (!in_array($orderBy, $validOrderColumns)) {
        $orderBy = 'created_at';
    }

    $sql = "SELECT 
                o.*,
                u.username as customer_name,
                a.username as assigned_admin_name
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            LEFT JOIN admins a ON o.assigned_to = a.id
            $whereSQL
            ORDER BY o.$orderBy $orderDir
            LIMIT ? OFFSET ?";
    
    $stmt = $pdo->prepare($sql);
    
    // Добавляем параметры для лимита
    $params[] = $perPage;
    $params[] = $offset;
    
    $stmt->execute($params);
    $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Дешифровка паролей (только для админов)
    foreach ($orders as &$order) {
        if (!empty($order['game_password_encrypted'])) {
            $order['game_password'] = decryptPassword($order['game_password_encrypted']);
        }
        // Убираем зашифрованный пароль из ответа
        unset($order['game_password_encrypted']);
    }

    // Логирование действия
    logAction('orders_list', ['page' => $page, 'per_page' => $perPage, 'filters' => $_GET]);

    echo json_encode([
        'success' => true,
        'orders' => $orders,
        'pagination' => [
            'page' => $page,
            'per_page' => $perPage,
            'total' => $total,
            'pages' => ceil($total / $perPage)
        ]
    ]);
}

function getOrderDetails() {
    checkAdminAuth();
    
    $orderId = $_GET['id'] ?? $_GET['order_id'] ?? null;
    if (!$orderId) {
        http_response_code(400);
        echo json_encode(['error' => 'Order ID is required']);
        return;
    }

    $pdo = getDBConnection();
    $stmt = $pdo->prepare("
        SELECT o.*, u.username as customer_name, 
               a.username as assigned_admin_name,
               GROUP_CONCAT(
                   CONCAT_WS('|', h.new_status, h.changed_by, h.created_at) 
                   ORDER BY h.created_at DESC SEPARATOR ';'
               ) as status_history
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        LEFT JOIN admins a ON o.assigned_to = a.id
        LEFT JOIN order_status_history h ON o.id = h.order_id
        WHERE o.id = ? OR o.order_id = ?
        GROUP BY o.id
    ");
    
    $stmt->execute([$orderId, $orderId]);
    $order = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$order) {
        http_response_code(404);
        echo json_encode(['error' => 'Order not found']);
        return;
    }

    // Дешифровка пароля
    if (!empty($order['game_password_encrypted'])) {
        $order['game_password'] = decryptPassword($order['game_password_encrypted']);
    }
    unset($order['game_password_encrypted']);

    // Разбор истории статусов
    if ($order['status_history']) {
        $history = [];
        $entries = explode(';', $order['status_history']);
        foreach ($entries as $entry) {
            if (!empty($entry)) {
                list($status, $changedBy, $createdAt) = explode('|', $entry);
                $history[] = [
                    'status' => $status,
                    'changed_by' => $changedBy,
                    'created_at' => $createdAt
                ];
            }
        }
        $order['status_history'] = $history;
    }

    logAction('order_view', ['order_id' => $orderId]);

    echo json_encode([
        'success' => true,
        'order' => $order
    ]);
}

function checkAdminAuthentication() {
    session_start();
    if (isset($_SESSION['admin_logged_in']) && $_SESSION['admin_logged_in'] === true) {
        echo json_encode([
            'authenticated' => true,
            'admin' => [
                'id' => $_SESSION['admin_id'] ?? null,
                'username' => $_SESSION['admin_username'] ?? null,
                'role' => $_SESSION['admin_role'] ?? null
            ]
        ]);
    } else {
        echo json_encode(['authenticated' => false]);
    }
}

// ==================== POST ЗАПРОСЫ ====================

function handlePostRequest($action) {
    switch ($action) {
        case 'login':
            adminLogin();
            break;
        case 'logout':
            adminLogout();
            break;
        default:
            http_response_code(400);
            echo json_encode(['error' => 'Invalid action']);
            break;
    }
}

function adminLogin() {
    session_start();
    
    $data = json_decode(file_get_contents('php://input'), true);
    $username = sanitize($data['username'] ?? '');
    $password = $data['password'] ?? '';

    if (empty($username) || empty($password)) {
        http_response_code(400);
        echo json_encode(['error' => 'Username and password are required']);
        return;
    }

    $pdo = getDBConnection();
    $stmt = $pdo->prepare("SELECT * FROM admins WHERE username = ? AND is_active = 1");
    $stmt->execute([$username]);
    $admin = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$admin || !password_verify($password, $admin['password_hash'])) {
        sleep(1); // Защита от брутфорса
        http_response_code(401);
        echo json_encode(['error' => 'Invalid credentials']);
        return;
    }

    // Установка сессии
    $_SESSION['admin_logged_in'] = true;
    $_SESSION['admin_id'] = $admin['id'];
    $_SESSION['admin_username'] = $admin['username'];
    $_SESSION['admin_role'] = $admin['role'];
    $_SESSION['login_time'] = time();

    // Обновление времени последнего входа
    $updateStmt = $pdo->prepare("UPDATE admins SET last_login = NOW() WHERE id = ?");
    $updateStmt->execute([$admin['id']]);

    logAction('login', null, $admin['id']);

    echo json_encode([
        'success' => true,
        'message' => 'Login successful',
        'admin' => [
            'id' => $admin['id'],
            'username' => $admin['username'],
            'role' => $admin['role'],
            'full_name' => $admin['full_name']
        ]
    ]);
}

function adminLogout() {
    session_start();
    
    $adminId = $_SESSION['admin_id'] ?? null;
    
    // Уничтожение сессии
    session_unset();
    session_destroy();
    session_write_close();
    
    logAction('logout', null, $adminId);
    
    echo json_encode(['success' => true, 'message' => 'Logged out']);
}

// ==================== PUT ЗАПРОСЫ ====================

function handlePutRequest() {
    checkAdminAuth();
    
    $data = json_decode(file_get_contents('php://input'), true);
    $action = $data['action'] ?? '';
    
    switch ($action) {
        case 'update_status':
            updateOrderStatus($data);
            break;
        case 'assign':
            assignOrder($data);
            break;
        case 'update_notes':
            updateOrderNotes($data);
            break;
        default:
            http_response_code(400);
            echo json_encode(['error' => 'Invalid action']);
            break;
    }
}

function updateOrderStatus($data) {
    $orderId = $data['order_id'] ?? null;
    $newStatus = $data['status'] ?? null;
    $adminId = $_SESSION['admin_id'] ?? null;
    $adminName = $_SESSION['admin_username'] ?? 'System';

    if (!$orderId || !$newStatus) {
        http_response_code(400);
        echo json_encode(['error' => 'Order ID and status are required']);
        return;
    }

    $validStatuses = ['pending', 'paid', 'in_progress', 'completed', 'cancelled'];
    if (!in_array($newStatus, $validStatuses)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid status']);
        return;
    }

    $pdo = getDBConnection();
    
    // Начинаем транзакцию
    $pdo->beginTransaction();
    
    try {
        // Получаем текущий статус
        $stmt = $pdo->prepare("SELECT status FROM orders WHERE id = ? OR order_id = ?");
        $stmt->execute([$orderId, $orderId]);
        $current = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$current) {
            throw new Exception('Order not found');
        }
        
        $oldStatus = $current['status'];
        
        // Обновляем статус заказа
        $updateStmt = $pdo->prepare("
            UPDATE orders 
            SET status = ?, updated_at = NOW() 
            WHERE id = ? OR order_id = ?
        ");
        $updateStmt->execute([$newStatus, $orderId, $orderId]);
        
        // Записываем в историю
        $historyStmt = $pdo->prepare("
            INSERT INTO order_status_history 
            (order_id, old_status, new_status, changed_by) 
            VALUES (?, ?, ?, ?)
        ");
        $historyStmt->execute([$orderId, $oldStatus, $newStatus, $adminName]);
        
        $pdo->commit();
        
        logAction('order_status_update', [
            'order_id' => $orderId,
            'old_status' => $oldStatus,
            'new_status' => $newStatus
        ], $adminId);
        
        echo json_encode([
            'success' => true,
            'message' => 'Status updated',
            'order_id' => $orderId,
            'old_status' => $oldStatus,
            'new_status' => $newStatus
        ]);
        
    } catch (Exception $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['error' => 'Update failed: ' . $e->getMessage()]);
    }
}

function assignOrder($data) {
    $orderId = $data['order_id'] ?? null;
    $adminId = $data['admin_id'] ?? null;
    $currentAdminId = $_SESSION['admin_id'] ?? null;

    if (!$orderId || !$adminId) {
        http_response_code(400);
        echo json_encode(['error' => 'Order ID and Admin ID are required']);
        return;
    }

    $pdo = getDBConnection();
    
    // Проверяем существование администратора
    $checkStmt = $pdo->prepare("SELECT id FROM admins WHERE id = ? AND is_active = 1");
    $checkStmt->execute([$adminId]);
    if (!$checkStmt->fetch()) {
        http_response_code(400);
        echo json_encode(['error' => 'Admin not found or inactive']);
        return;
    }
    
    $stmt = $pdo->prepare("
        UPDATE orders 
        SET assigned_to = ?, updated_at = NOW() 
        WHERE id = ? OR order_id = ?
    ");
    $stmt->execute([$adminId, $orderId, $orderId]);
    
    logAction('order_assign', [
        'order_id' => $orderId,
        'assigned_to' => $adminId
    ], $currentAdminId);
    
    echo json_encode([
        'success' => true,
        'message' => 'Order assigned',
        'order_id' => $orderId,
        'assigned_to' => $adminId
    ]);
}

function updateOrderNotes($data) {
    $orderId = $data['order_id'] ?? null;
    $notes = sanitize($data['notes'] ?? '');
    $adminId = $_SESSION['admin_id'] ?? null;

    if (!$orderId) {
        http_response_code(400);
        echo json_encode(['error' => 'Order ID is required']);
        return;
    }

    $pdo = getDBConnection();
    $stmt = $pdo->prepare("
        UPDATE orders 
        SET admin_notes = ?, updated_at = NOW() 
        WHERE id = ? OR order_id = ?
    ");
    $stmt->execute([$notes, $orderId, $orderId]);
    
    logAction('order_notes_update', [
        'order_id' => $orderId,
        'notes_length' => strlen($notes)
    ], $adminId);
    
    echo json_encode([
        'success' => true,
        'message' => 'Notes updated',
        'order_id' => $orderId
    ]);
}

// ==================== DELETE ЗАПРОСЫ ====================

function handleDeleteRequest() {
    checkAdminAuth();
    
    $data = json_decode(file_get_contents('php://input'), true);
    $orderId = $data['order_id'] ?? null;
    $adminId = $_SESSION['admin_id'] ?? null;

    if (!$orderId) {
        http_response_code(400);
        echo json_encode(['error' => 'Order ID is required']);
        return;
    }

    $pdo = getDBConnection();
    
    // Логируем перед удалением
    $stmt = $pdo->prepare("SELECT * FROM orders WHERE id = ? OR order_id = ?");
    $stmt->execute([$orderId, $orderId]);
    $order = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$order) {
        http_response_code(404);
        echo json_encode(['error' => 'Order not found']);
        return;
    }
    
    // Мягкое удаление (изменение статуса) вместо физического удаления
    $updateStmt = $pdo->prepare("
        UPDATE orders 
        SET status = 'cancelled', updated_at = NOW() 
        WHERE id = ? OR order_id = ?
    ");
    $updateStmt->execute([$orderId, $orderId]);
    
    logAction('order_cancel', [
        'order_id' => $orderId,
        'order_data' => $order
    ], $adminId);
    
    echo json_encode([
        'success' => true,
        'message' => 'Order cancelled',
        'order_id' => $orderId
    ]);
}

?>