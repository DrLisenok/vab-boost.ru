<?php
// reviews.php
require_once '../config.php';

// Устанавливаем заголовки CORS
setCorsHeaders();

// Получаем метод запроса
$method = $_SERVER['REQUEST_METHOD'];

// Для GET запросов проверка авторизации не требуется
// Для других методов - требуется
if ($method !== 'GET' && !checkAdminAuth()) {
    jsonResponse(['error' => 'Unauthorized'], 401);
}

// Подключаемся к БД
$pdo = getDBConnection();
if (!$pdo) {
    jsonResponse(['error' => 'Database connection failed'], 500);
}

// Получаем параметры запроса
$id = $_GET['id'] ?? null;
$approved = $_GET['approved'] ?? null;
$limit = $_GET['limit'] ?? 10;
$page = $_GET['page'] ?? 1;

// Обработка запросов
switch ($method) {
    case 'GET':
        handleGetRequest($pdo, $id, $approved, $limit, $page);
        break;
    case 'POST':
        handlePostRequest($pdo);
        break;
    case 'PUT':
        handlePutRequest($pdo, $id);
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
function handleGetRequest($pdo, $id, $approved, $limit, $page) {
    if ($id) {
        // Получение одного отзыва
        $stmt = $pdo->prepare("SELECT * FROM reviews WHERE id = ?");
        $stmt->execute([$id]);
        $review = $stmt->fetch();
        
        if (!$review) {
            jsonResponse(['error' => 'Review not found'], 404);
        }
        
        jsonResponse($review);
    }
    
    // Получение списка отзывов
    $where = [];
    $params = [];
    
    if ($approved !== null) {
        $where[] = "is_approved = ?";
        $params[] = $approved ? 1 : 0;
    }
    
    $whereClause = $where ? "WHERE " . implode(" AND ", $where) : "";
    
    // Получаем общее количество
    $stmt = $pdo->prepare("SELECT COUNT(*) as total FROM reviews $whereClause");
    $stmt->execute($params);
    $total = $stmt->fetch()['total'];
    
    // Рассчитываем смещение
    $offset = ($page - 1) * $limit;
    
    // Получаем отзывы
    $stmt = $pdo->prepare("
        SELECT * FROM reviews 
        $whereClause 
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
    ");
    
    $params[] = (int)$limit;
    $params[] = (int)$offset;
    $stmt->execute($params);
    $reviews = $stmt->fetchAll();
    
    jsonResponse([
        'reviews' => $reviews,
        'pagination' => [
            'page' => (int)$page,
            'limit' => (int)$limit,
            'total' => (int)$total,
            'pages' => ceil($total / $limit)
        ]
    ]);
}

/**
 * Обработка POST запросов (создание отзыва)
 */
function handlePostRequest($pdo) {
    $data = json_decode(file_get_contents('php://input'), true);
    
    // Валидация
    $required = ['client_name', 'rating', 'content'];
    foreach ($required as $field) {
        if (empty($data[$field])) {
            jsonResponse(['error' => "Missing required field: $field"], 400);
        }
    }
    
    // Очищаем данные
    $data = sanitize($data);
    
    // Проверяем рейтинг
    $rating = (int)$data['rating'];
    if ($rating < 1 || $rating > 5) {
        jsonResponse(['error' => 'Rating must be between 1 and 5'], 400);
    }
    
    try {
        $stmt = $pdo->prepare("
            INSERT INTO reviews (client_name, rating, content, service_type, is_approved) 
            VALUES (?, ?, ?, ?, ?)
        ");
        
        $stmt->execute([
            $data['client_name'],
            $rating,
            $data['content'],
            $data['service_type'] ?? null,
            $data['is_approved'] ?? 0
        ]);
        
        $reviewId = $pdo->lastInsertId();
        
        jsonResponse([
            'success' => true,
            'message' => 'Review created successfully',
            'review_id' => $reviewId
        ], 201);
        
    } catch (PDOException $e) {
        error_log("Review creation failed: " . $e->getMessage());
        jsonResponse(['error' => 'Failed to create review'], 500);
    }
}

/**
 * Обработка PUT запросов (обновление отзыва)
 */
function handlePutRequest($pdo, $id) {
    if (!$id) {
        jsonResponse(['error' => 'Review ID is required'], 400);
    }
    
    $data = json_decode(file_get_contents('php://input'), true);
    
    // Проверяем существование отзыва
    $stmt = $pdo->prepare("SELECT * FROM reviews WHERE id = ?");
    $stmt->execute([$id]);
    $review = $stmt->fetch();
    
    if (!$review) {
        jsonResponse(['error' => 'Review not found'], 404);
    }
    
    // Очищаем данные
    $data = sanitize($data);
    
    // Обновляем только разрешенные поля
    $allowedFields = ['client_name', 'rating', 'content', 'service_type', 'is_approved'];
    $updates = [];
    $params = [];
    
    foreach ($allowedFields as $field) {
        if (isset($data[$field])) {
            $updates[] = "$field = ?";
            $params[] = $data[$field];
        }
    }
    
    if (empty($updates)) {
        jsonResponse(['error' => 'No fields to update'], 400);
    }
    
    $params[] = $id;
    
    $query = "UPDATE reviews SET " . implode(', ', $updates) . " WHERE id = ?";
    $stmt = $pdo->prepare($query);
    
    try {
        $stmt->execute($params);
        
        // Логируем действие
        if (isset($_SESSION['admin_id'])) {
            logAdminAction($_SESSION['admin_id'], 'update_review', "Updated review: $id");
        }
        
        jsonResponse([
            'success' => true,
            'message' => 'Review updated successfully'
        ]);
        
    } catch (PDOException $e) {
        error_log("Review update failed: " . $e->getMessage());
        jsonResponse(['error' => 'Failed to update review'], 500);
    }
}

/**
 * Обработка DELETE запросов (удаление отзыва)
 */
function handleDeleteRequest($pdo, $id) {
    if (!$id) {
        jsonResponse(['error' => 'Review ID is required'], 400);
    }
    
    // Проверяем существование отзыва
    $stmt = $pdo->prepare("SELECT * FROM reviews WHERE id = ?");
    $stmt->execute([$id]);
    $review = $stmt->fetch();
    
    if (!$review) {
        jsonResponse(['error' => 'Review not found'], 404);
    }
    
    try {
        $stmt = $pdo->prepare("DELETE FROM reviews WHERE id = ?");
        $stmt->execute([$id]);
        
        // Логируем действие
        if (isset($_SESSION['admin_id'])) {
            logAdminAction($_SESSION['admin_id'], 'delete_review', "Deleted review: $id");
        }
        
        jsonResponse([
            'success' => true,
            'message' => 'Review deleted successfully'
        ]);
        
    } catch (PDOException $e) {
        error_log("Review deletion failed: " . $e->getMessage());
        jsonResponse(['error' => 'Failed to delete review'], 500);
    }
}
?>