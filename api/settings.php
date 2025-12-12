<?php
// settings.php
require_once '../config.php';

// Устанавливаем заголовки CORS
setCorsHeaders();

// Проверяем авторизацию для всех методов кроме GET
$method = $_SERVER['REQUEST_METHOD'];
if ($method !== 'GET' && !checkAdminAuth()) {
    jsonResponse(['error' => 'Unauthorized'], 401);
}

// Подключаемся к БД
$pdo = getDBConnection();
if (!$pdo) {
    jsonResponse(['error' => 'Database connection failed'], 500);
}

// Обработка запросов
switch ($method) {
    case 'GET':
        handleGetRequest($pdo);
        break;
    case 'POST':
        handlePostRequest($pdo);
        break;
    default:
        jsonResponse(['error' => 'Method not allowed'], 405);
}

/**
 * Обработка GET запросов (получение настроек)
 */
function handleGetRequest($pdo) {
    $stmt = $pdo->query("SELECT * FROM settings ORDER BY id");
    $settings = $stmt->fetchAll();
    
    // Преобразуем в ассоциативный массив для удобства
    $result = [];
    foreach ($settings as $setting) {
        $result[] = [
            'key' => $setting['key'],
            'value' => $setting['value'],
            'description' => $setting['description']
        ];
    }
    
    jsonResponse(['settings' => $result]);
}

/**
 * Обработка POST запросов (обновление настроек)
 */
function handlePostRequest($pdo) {
    // Получаем данные из тела запроса
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (empty($data)) {
        jsonResponse(['error' => 'No data provided'], 400);
    }
    
    try {
        $pdo->beginTransaction();
        
        foreach ($data as $key => $value) {
            // Проверяем, существует ли такая настройка
            $stmt = $pdo->prepare("SELECT id FROM settings WHERE `key` = ?");
            $stmt->execute([$key]);
            $exists = $stmt->fetch();
            
            if ($exists) {
                // Обновляем существующую настройку
                $stmt = $pdo->prepare("
                    UPDATE settings 
                    SET `value` = ?, updated_at = NOW() 
                    WHERE `key` = ?
                ");
                $stmt->execute([$value, $key]);
            } else {
                // Создаем новую настройку (только для разрешенных ключей)
                $allowedKeys = [
                    'site_name', 'site_description', 'telegram_support', 'discord_support',
                    'price_rank_boost', 'price_wins_boost', 'price_placement', 'price_coaching'
                ];
                
                if (in_array($key, $allowedKeys)) {
                    $stmt = $pdo->prepare("
                        INSERT INTO settings (`key`, `value`, `description`) 
                        VALUES (?, ?, ?)
                    ");
                    
                    $description = getSettingDescription($key);
                    $stmt->execute([$key, $value, $description]);
                }
            }
        }
        
        $pdo->commit();
        
        // Логируем действие
        if (isset($_SESSION['admin_id'])) {
            logAdminAction($_SESSION['admin_id'], 'update_settings', json_encode($data));
        }
        
        jsonResponse([
            'success' => true,
            'message' => 'Settings updated successfully'
        ]);
        
    } catch (PDOException $e) {
        $pdo->rollBack();
        error_log("Settings update failed: " . $e->getMessage());
        jsonResponse(['error' => 'Failed to update settings'], 500);
    }
}

/**
 * Получение описания для настройки
 */
function getSettingDescription($key) {
    $descriptions = [
        'site_name' => 'Название сайта',
        'site_description' => 'Описание сайта',
        'telegram_support' => 'Telegram для поддержки',
        'discord_support' => 'Discord для поддержки',
        'price_rank_boost' => 'Цена за повышение ранга',
        'price_wins_boost' => 'Цена за победы',
        'price_placement' => 'Цена за калибровку',
        'price_coaching' => 'Цена за коучинг'
    ];
    
    return $descriptions[$key] ?? $key;
}
?>