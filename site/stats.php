<?php
require_once 'config.php';
setCorsHeaders();

header('Content-Type: application/json; charset=utf-8');

try {
    checkAdminAuth();
    
    $pdo = getDBConnection();
    if (!$pdo) {
        throw new Exception('Database connection failed');
    }

    // Получаем текущую дату и дату месяц назад
    $currentDate = date('Y-m-d');
    $monthAgo = date('Y-m-d', strtotime('-30 days'));

    $stats = [
        // Общая статистика
        'total_orders' => getTotalOrders($pdo),
        'total_revenue' => getTotalRevenue($pdo),
        'avg_order_value' => getAverageOrderValue($pdo),
        'total_customers' => getTotalCustomers($pdo),
        
        // Статистика по статусам
        'orders_by_status' => getOrdersByStatus($pdo),
        
        // Статистика по услугам
        'orders_by_service' => getOrdersByService($pdo),
        
        // Статистика по регионам
        'orders_by_region' => getOrdersByRegion($pdo),
        
        // Статистика за последний месяц
        'recent_orders' => getRecentOrders($pdo, $monthAgo, $currentDate),
        'recent_revenue' => getRecentRevenue($pdo, $monthAgo, $currentDate),
        
        // Статистика по дням (для графика)
        'daily_stats' => getDailyStats($pdo, $monthAgo, $currentDate),
        
        // Топ администраторов
        'top_admins' => getTopAdmins($pdo, $monthAgo, $currentDate),
        
        // Системная информация
        'system_info' => [
            'server_time' => date('Y-m-d H:i:s'),
            'php_version' => PHP_VERSION,
            'server_software' => $_SERVER['SERVER_SOFTWARE'] ?? 'Unknown'
        ]
    ];

    logAction('stats_view', ['stats_requested' => true]);

    echo json_encode([
        'success' => true,
        'stats' => $stats,
        'generated_at' => date('Y-m-d H:i:s')
    ]);

} catch (Exception $e) {
    error_log("Stats API Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Internal server error', 'message' => $e->getMessage()]);
}

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

function getTotalOrders($pdo) {
    $stmt = $pdo->query("SELECT COUNT(*) as count FROM orders");
    return $stmt->fetch()['count'] ?? 0;
}

function getTotalRevenue($pdo) {
    $stmt = $pdo->query("SELECT SUM(amount) as total FROM orders WHERE status IN ('paid', 'completed')");
    return floatval($stmt->fetch()['total'] ?? 0);
}

function getAverageOrderValue($pdo) {
    $totalRevenue = getTotalRevenue($pdo);
    $totalOrders = getTotalOrders($pdo);
    
    if ($totalOrders > 0) {
        return round($totalRevenue / $totalOrders, 2);
    }
    return 0;
}

function getTotalCustomers($pdo) {
    $stmt = $pdo->query("SELECT COUNT(DISTINCT contact_value) as count FROM orders");
    return $stmt->fetch()['count'] ?? 0;
}

function getOrdersByStatus($pdo) {
    $stmt = $pdo->query("
        SELECT status, COUNT(*) as count 
        FROM orders 
        GROUP BY status 
        ORDER BY count DESC
    ");
    
    $result = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $result[$row['status']] = intval($row['count']);
    }
    
    return $result;
}

function getOrdersByService($pdo) {
    $stmt = $pdo->query("
        SELECT service_type, COUNT(*) as count 
        FROM orders 
        GROUP BY service_type 
        ORDER BY count DESC
    ");
    
    $result = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $result[$row['service_type']] = intval($row['count']);
    }
    
    return $result;
}

function getOrdersByRegion($pdo) {
    $stmt = $pdo->query("
        SELECT region, COUNT(*) as count 
        FROM orders 
        WHERE region IS NOT NULL AND region != ''
        GROUP BY region 
        ORDER BY count DESC
        LIMIT 10
    ");
    
    $result = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $result[$row['region']] = intval($row['count']);
    }
    
    return $result;
}

function getRecentOrders($pdo, $fromDate, $toDate) {
    $stmt = $pdo->prepare("
        SELECT 
            COUNT(*) as total_orders,
            SUM(CASE WHEN status IN ('paid', 'completed') THEN 1 ELSE 0 END) as completed_orders,
            SUM(CASE WHEN status IN ('paid', 'completed') THEN amount ELSE 0 END) as revenue
        FROM orders 
        WHERE DATE(created_at) BETWEEN ? AND ?
    ");
    
    $stmt->execute([$fromDate, $toDate]);
    return $stmt->fetch(PDO::FETCH_ASSOC);
}

function getRecentRevenue($pdo, $fromDate, $toDate) {
    $revenueByDay = [];
    $currentDate = $fromDate;
    
    while (strtotime($currentDate) <= strtotime($toDate)) {
        $stmt = $pdo->prepare("
            SELECT COALESCE(SUM(amount), 0) as revenue
            FROM orders 
            WHERE DATE(created_at) = ? AND status IN ('paid', 'completed')
        ");
        
        $stmt->execute([$currentDate]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        
        $revenueByDay[$currentDate] = floatval($row['revenue'] ?? 0);
        $currentDate = date('Y-m-d', strtotime($currentDate . ' +1 day'));
    }
    
    return $revenueByDay;
}

function getDailyStats($pdo, $fromDate, $toDate) {
    $stmt = $pdo->prepare("
        SELECT 
            DATE(created_at) as date,
            COUNT(*) as orders_count,
            SUM(CASE WHEN status IN ('paid', 'completed') THEN amount ELSE 0 END) as revenue,
            AVG(CASE WHEN status IN ('paid', 'completed') THEN amount ELSE NULL END) as avg_order_value
        FROM orders 
        WHERE DATE(created_at) BETWEEN ? AND ?
        GROUP BY DATE(created_at)
        ORDER BY date ASC
    ");
    
    $stmt->execute([$fromDate, $toDate]);
    
    $result = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $result[] = [
            'date' => $row['date'],
            'orders' => intval($row['orders_count']),
            'revenue' => floatval($row['revenue']),
            'avg_order_value' => floatval($row['avg_order_value'] ?? 0)
        ];
    }
    
    return $result;
}

function getTopAdmins($pdo, $fromDate, $toDate) {
    $stmt = $pdo->prepare("
        SELECT 
            a.username,
            COUNT(DISTINCT o.id) as orders_handled,
            COUNT(DISTINCT CASE WHEN o.status IN ('completed') THEN o.id END) as orders_completed,
            COALESCE(SUM(CASE WHEN o.status IN ('completed') THEN o.amount ELSE 0 END), 0) as revenue_generated
        FROM admins a
        LEFT JOIN orders o ON a.id = o.assigned_to 
            AND DATE(o.created_at) BETWEEN ? AND ?
        WHERE a.is_active = 1
        GROUP BY a.id
        ORDER BY orders_handled DESC
        LIMIT 10
    ");
    
    $stmt->execute([$fromDate, $toDate]);
    
    $result = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $result[] = [
            'username' => $row['username'],
            'orders_handled' => intval($row['orders_handled']),
            'orders_completed' => intval($row['orders_completed']),
            'revenue_generated' => floatval($row['revenue_generated'])
        ];
    }
    
    return $result;
}

?>