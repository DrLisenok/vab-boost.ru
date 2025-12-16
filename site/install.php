<?php
header('Content-Type: text/html; charset=utf-8');

echo '<!DOCTYPE html>
<html>
<head>
    <title>VAB Boost - Установка</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
        .success { color: green; }
        .error { color: red; }
        pre { background: #f5f5f5; padding: 10px; border-radius: 5px; }
    </style>
</head>
<body>
    <h1>Установка VAB Boost</h1>';

require_once 'api/config/database.php';

try {
    $database = new Database();
    $db = $database->getConnection();
    
    if (!$db) {
        throw new Exception('Не удалось подключиться к базе данных');
    }
    
    echo '<p class="success">✓ Подключение к БД успешно</p>';
    
    // Создаем таблицы
    if ($database->createTables()) {
        echo '<p class="success">✓ Таблицы созданы успешно</p>';
        
        // Создаем администратора по умолчанию
        $query = "INSERT IGNORE INTO users (email, password_hash, name, role) 
                 VALUES ('admin@vab-boost.ru', :password, 'Администратор', 'admin')";
        
        $stmt = $db->prepare($query);
        $password_hash = password_hash('admin123', PASSWORD_BCRYPT);
        $stmt->bindParam(':password', $password_hash);
        
        if ($stmt->execute()) {
            echo '<p class="success">✓ Администратор создан (email: admin@vab-boost.ru, password: admin123)</p>';
        }
        
        echo '<h2>Установка завершена!</h2>';
        echo '<p>Сайт готов к работе. Не забудьте удалить этот файл установки.</p>';
        echo '<p><a href="/">Перейти на сайт</a></p>';
        
    } else {
        echo '<p class="error">✗ Ошибка при создании таблиц</p>';
    }
    
} catch (Exception $e) {
    echo '<p class="error">✗ Ошибка: ' . htmlspecialchars($e->getMessage()) . '</p>';
    echo '<pre>Проверьте параметры подключения в api/config/database.php</pre>';
}

echo '</body></html>';