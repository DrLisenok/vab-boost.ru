<?php
require_once __DIR__ . '/config.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . SITE_URL);
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Обработка preflight запросов
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Только для авторизованных администраторов
if (!isAdminAuthenticated()) {
    jsonResponse(['error' => 'Unauthorized'], 401);
}

try {
    $action = $_GET['action'] ?? 'dashboard';
    
    switch ($action) {
        case 'dashboard':
            getDashboardStats();
            break;
            
        case 'revenue':
            getRevenueStats();
            break;
            
        case 'orders':
            getOrderStats();
            break;
            
        case 'services':
            getServiceStats();
            break;
            
        default:
            jsonResponse(['error' => 'Invalid action'], 400);
    }
} catch (Exception $e) {
    error_log('Stats processing error: ' . $e->getMessage());
    jsonResponse(['error' => 'Internal server error'], 500);
}

/**
 * Основная статистика для дашборда
 */
function getDashboardStats() {
    $db = getDB();
    
    // Текущая дата и период
    $today = date('Y-m-d');
    $weekAgo = date('Y-m-d', strtotime('-7 days'));
    $monthAgo = date('Y-m-d', strtotime('-30 days'));
    
    // Общая статистика
    $stats = [
        'overview' => [],
        'daily' => [],
        'services' => [],
        'statuses' => []
    ];
    
    // 1. Основные показатели
    $stmt = $db->query("
        SELECT 
            COUNT(*) as total_orders,
            SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as today_orders,
            SUM(amount) as total_revenue,
            SUM(CASE WHEN DATE(created_at) = CURDATE() THEN amount ELSE 0 END) as today_revenue,
            AVG(amount) as avg_order_value,
            COUNT(DISTINCT contact) as unique_customers
        FROM orders
        WHERE status != 'cancelled'
    ");
    $stats['overview'] = $stmt->fetch();
    
    // 2. Статистика по дням за последние 7 дней
    $stmt = $db->prepare("
        SELECT 
            DATE(created_at) as date,
            COUNT(*) as orders,
            SUM(amount) as revenue,
            AVG(amount) as avg_order
        FROM orders
        WHERE created_at >= ? AND status != 'cancelled'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
        LIMIT 7
    ");
    $stmt->execute([$weekAgo]);
    $stats['daily'] = $stmt->fetchAll();
    
    // 3. Статистика по услугам
    $stmt = $db->query("
        SELECT 
            service_type,
            COUNT(*) as orders,
            SUM(amount) as revenue,
            AVG(amount) as avg_order,
            ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM orders WHERE status != 'cancelled'), 2) as percentage
        FROM orders
        WHERE status != 'cancelled'
        GROUP BY service_type
        ORDER BY revenue DESC
    ");
    $stats['services'] = $stmt->fetchAll();
    
    // 4. Статистика по статусам
    $stmt = $db->query("
        SELECT 
            status,
            COUNT(*) as count,
            SUM(amount) as revenue,
            ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM orders), 2) as percentage
        FROM orders
        GROUP BY status
        ORDER BY count DESC
    ");
    $stats['statuses'] = $stmt->fetchAll();
    
    // 5. Последние заказы
    $stmt = $db->query("
        SELECT 
            o.*,
            p.status as payment_status,
            p.payment_id
        FROM orders o
        LEFT JOIN payments p ON o.id = p.order_id
        ORDER BY o.created_at DESC
        LIMIT 10
    ");
    $stats['recent_orders'] = $stmt->fetchAll();
    
    // 6. Статистика по регионам
    $stmt = $db->query("
        SELECT 
            region,
            COUNT(*) as orders,
            SUM(amount) as revenue,
            AVG(amount) as avg_order
        FROM orders
        WHERE status != 'cancelled'
        GROUP BY region
        ORDER BY orders DESC
    ");
    $stats['regions'] = $stmt->fetchAll();
    
    // 7. Статистика по времени выполнения
    $stmt = $db->query("
        SELECT 
            service_type,
            AVG(TIMESTAMPDIFF(HOUR, created_at, updated_at)) as avg_completion_hours,
            MIN(TIMESTAMPDIFF(HOUR, created_at, updated_at)) as min_completion_hours,
            MAX(TIMESTAMPDIFF(HOUR, created_at, updated_at)) as max_completion_hours
        FROM orders
        WHERE status = 'completed'
        GROUP BY service_type
    ");
    $stats['completion_times'] = $stmt->fetchAll();
    
    jsonResponse($stats);
}

/**
 * Статистика по доходам
 */
function getRevenueStats() {
    $db = getDB();
    
    $period = $_GET['period'] ?? 'month'; // day, week, month, year
    $startDate = $_GET['start_date'] ?? '';
    $endDate = $_GET['end_date'] ?? '';
    
    // Определение периода
    if ($startDate && $endDate) {
        $dateField = "DATE(created_at) BETWEEN ? AND ?";
        $params = [$startDate, $endDate];
    } else {
        switch ($period) {
            case 'day':
                $dateField = "DATE(created_at) = CURDATE()";
                $params = [];
                break;
            case 'week':
                $dateField = "created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)";
                $params = [];
                break;
            case 'year':
                $dateField = "YEAR(created_at) = YEAR(CURDATE())";
                $params = [];
                break;
            case 'month':
            default:
                $dateField = "MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE())";
                $params = [];
                break;
        }
    }
    
    // Общая статистика по доходам
    $stmt = $db->prepare("
        SELECT 
            SUM(amount) as total_revenue,
            COUNT(*) as total_orders,
            AVG(amount) as avg_order_value,
            MAX(amount) as max_order_value,
            MIN(amount) as min_order_value
        FROM orders
        WHERE status != 'cancelled' AND $dateField
    ");
    $stmt->execute($params);
    $revenue = $stmt->fetch();
    
    // Ежедневная статистика за период
    if ($period === 'month' || ($startDate && $endDate)) {
        $groupBy = "DATE(created_at)";
    } elseif ($period === 'year') {
        $groupBy = "MONTH(created_at)";
    } else {
        $groupBy = "DATE(created_at)";
    }
    
    $stmt = $db->prepare("
        SELECT 
            $groupBy as period,
            COUNT(*) as orders,
            SUM(amount) as revenue,
            AVG(amount) as avg_order
        FROM orders
        WHERE status != 'cancelled' AND $dateField
        GROUP BY $groupBy
        ORDER BY period
    ");
    $stmt->execute($params);
    $dailyStats = $stmt->fetchAll();
    
    // Статистика по времени суток
    $stmt = $db->prepare("
        SELECT 
            HOUR(created_at) as hour,
            COUNT(*) as orders,
            SUM(amount) as revenue
        FROM orders
        WHERE status != 'cancelled' AND $dateField
        GROUP BY HOUR(created_at)
        ORDER BY hour
    ");
    $stmt->execute($params);
    $hourlyStats = $stmt->fetchAll();
    
    jsonResponse([
        'summary' => $revenue,
        'period_stats' => $dailyStats,
        'hourly_stats' => $hourlyStats,
        'period' => $period,
        'start_date' => $startDate,
        'end_date' => $endDate
    ]);
}

/**
 * Статистика по заказам
 */
function getOrderStats() {
    $db = getDB();
    
    // Статистика по статусам во времени
    $stmt = $db->query("
        SELECT 
            DATE(created_at) as date,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
            SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid,
            SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
            SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
            COUNT(*) as total
        FROM orders
        WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        GROUP BY DATE(created_at)
        ORDER BY date
    ");
    $statusHistory = $stmt->fetchAll();
    
    // Среднее время изменения статуса
    $stmt = $db->query("
        SELECT 
            service_type,
            AVG(TIMESTAMPDIFF(MINUTE, created_at, 
                CASE 
                    WHEN status = 'completed' THEN updated_at
                    ELSE NOW()
                END
            )) as avg_time_minutes
        FROM orders
        WHERE status IN ('processing', 'completed')
        GROUP BY service_type
    ");
    $processingTimes = $stmt->fetchAll();
    
    // Конверсия (заказы/уникальные посетители - упрощенно)
    $stmt = $db->query("
        SELECT 
            DATE(created_at) as date,
            COUNT(*) as orders,
            COUNT(DISTINCT contact) as unique_customers,
            ROUND(COUNT(*) * 100.0 / NULLIF(COUNT(DISTINCT contact), 0), 2) as conversion_rate
        FROM orders
        WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        GROUP BY DATE(created_at)
        ORDER BY date
    ");
    $conversionStats = $stmt->fetchAll();
    
    // Повторные покупки
    $stmt = $db->query("
        SELECT 
            contact,
            COUNT(*) as order_count,
            SUM(amount) as total_spent,
            MIN(created_at) as first_order,
            MAX(created_at) as last_order
        FROM orders
        WHERE status != 'cancelled'
        GROUP BY contact
        HAVING COUNT(*) > 1
        ORDER BY order_count DESC
        LIMIT 20
    ");
    $repeatCustomers = $stmt->fetchAll();
    
    jsonResponse([
        'status_history' => $statusHistory,
        'processing_times' => $processingTimes,
        'conversion_stats' => $conversionStats,
        'repeat_customers' => $repeatCustomers,
        'total_repeat_customers' => count($repeatCustomers)
    ]);
}

/**
 * Статистика по услугам
 */
function getServiceStats() {
    $db = getDB();
    
    // Детальная статистика по каждой услуге
    $stmt = $db->query("
        SELECT 
            service_type,
            COUNT(*) as total_orders,
            SUM(amount) as total_revenue,
            AVG(amount) as avg_price,
            MIN(amount) as min_price,
            MAX(amount) as max_price,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_orders,
            SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_orders,
            ROUND(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as completion_rate
        FROM orders
        GROUP BY service_type
        ORDER BY total_revenue DESC
    ");
    $serviceDetails = $stmt->fetchAll();
    
    // Популярные комбинации услуг
    $stmt = $db->query("
        SELECT 
            CONCAT(current_rank, ' → ', target_rank) as rank_progression,
            COUNT(*) as count,
            AVG(amount) as avg_price
        FROM orders
        WHERE service_type = 'rank_boost' 
            AND current_rank != '' 
            AND target_rank != ''
            AND current_rank != target_rank
        GROUP BY current_rank, target_rank
        HAVING COUNT(*) >= 3
        ORDER BY count DESC
        LIMIT 10
    ");
    $popularProgressions = $stmt->fetchAll();
    
    // Распределение по регионам для каждой услуги
    $stmt = $db->query("
        SELECT 
            service_type,
            region,
            COUNT(*) as orders,
            SUM(amount) as revenue,
            ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY service_type), 2) as percentage
        FROM orders
        WHERE status != 'cancelled'
        GROUP BY service_type, region
        ORDER BY service_type, orders DESC
    ");
    $regionalDistribution = $stmt->fetchAll();
    
    // Сезонность услуг (по месяцам)
    $stmt = $db->query("
        SELECT 
            service_type,
            MONTHNAME(created_at) as month,
            COUNT(*) as orders,
            SUM(amount) as revenue
        FROM orders
        WHERE YEAR(created_at) = YEAR(CURDATE())
        GROUP BY service_type, MONTH(created_at)
        ORDER BY service_type, MONTH(created_at)
    ");
    $seasonality = $stmt->fetchAll();
    
    jsonResponse([
        'service_details' => $serviceDetails,
        'popular_progressions' => $popularProgressions,
        'regional_distribution' => $regionalDistribution,
        'seasonality' => $seasonality
    ]);
}
?>