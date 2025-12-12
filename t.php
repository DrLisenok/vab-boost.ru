<?php
/**
 * VAB BOOST - Установочный скрипт
 * Запустите этот скрипт один раз для настройки базы данных
 */

echo "VAB BOOST - Установка\n";
echo "====================\n\n";

// Проверка на прямой доступ
if (php_sapi_name() !== 'cli' && !isset($_GET['install'])) {
    die('Для установки перейдите по адресу: ' . $_SERVER['PHP_SELF'] . '?install');
}

require_once __DIR__ . '/config.php';

try {
    echo "1. Подключение к базе данных...\n";
    
    // Создание подключения
    $dsn = "mysql:host=" . DB_HOST . ";charset=" . DB_CHARSET;
    $pdo = new PDO($dsn, DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    echo "   ✓ Подключено к MySQL серверу\n";
    
    // Создание базы данных если не существует
    $pdo->exec("CREATE DATABASE IF NOT EXISTS `" . DB_NAME . "` CHARACTER SET " . DB_CHARSET);
    $pdo->exec("USE `" . DB_NAME . "`");
    
    echo "   ✓ База данных создана/выбрана\n";
    
    echo "2. Создание таблиц...\n";
    
    // Создание таблицы admins
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `admins` (
          `id` int(11) NOT NULL AUTO_INCREMENT,
          `username` varchar(50) NOT NULL,
          `password_hash` varchar(255) NOT NULL,
          `email` varchar(100) DEFAULT NULL,
          `role` enum('admin','moderator') DEFAULT 'admin',
          `last_login` datetime DEFAULT NULL,
          `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
          `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`),
          UNIQUE KEY `username` (`username`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
    echo "   ✓ Таблица admins создана\n";
    
    // Создание таблицы orders (без payment_id)
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `orders` (
          `id` int(11) NOT NULL AUTO_INCREMENT,
          `order_number` varchar(50) NOT NULL,
          `service_type` varchar(50) NOT NULL,
          `current_rank` varchar(50) DEFAULT NULL,
          `target_rank` varchar(50) DEFAULT NULL,
          `region` varchar(50) NOT NULL,
          `contact_type` enum('telegram','discord','email','whatsapp') NOT NULL,
          `contact` varchar(255) NOT NULL,
          `amount` decimal(10,2) NOT NULL,
          `notes` text,
          `status` enum('pending','awaiting_payment','paid','processing','completed','cancelled','refunded') DEFAULT 'pending',
          `assigned_to` int(11) DEFAULT NULL,
          `ip_address` varchar(45) DEFAULT NULL,
          `user_agent` text,
          `cancellation_reason` text,
          `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
          `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`),
          UNIQUE KEY `order_number` (`order_number`),
          KEY `assigned_to` (`assigned_to`),
          KEY `status` (`status`),
          KEY `created_at` (`created_at`),
          CONSTRAINT `orders_ibfk_1` FOREIGN KEY (`assigned_to`) REFERENCES `admins` (`id`) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
    echo "   ✓ Таблица orders создана\n";
    
    // Создание таблицы payments
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `payments` (
          `id` int(11) NOT NULL AUTO_INCREMENT,
          `payment_id` varchar(100) NOT NULL,
          `order_id` int(11) NOT NULL,
          `amount` decimal(10,2) NOT NULL,
          `currency` varchar(3) DEFAULT 'RUB',
          `status` enum('pending','waiting_for_capture','succeeded','canceled','refunded') DEFAULT 'pending',
          `confirmation_url` text,
          `yookassa_data` json DEFAULT NULL,
          `metadata` json DEFAULT NULL,
          `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
          `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`),
          UNIQUE KEY `payment_id` (`payment_id`),
          KEY `order_id` (`order_id`),
          CONSTRAINT `payments_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
    echo "   ✓ Таблица payments создана\n";
    
    // Добавление payment_id в orders
    echo "3. Добавление связей между таблицами...\n";
    
    try {
        $pdo->exec("ALTER TABLE `orders` ADD COLUMN `payment_id` int(11) DEFAULT NULL AFTER `assigned_to`");
        $pdo->exec("ALTER TABLE `orders` ADD KEY `payment_id` (`payment_id`)");
        $pdo->exec("ALTER TABLE `orders` ADD CONSTRAINT `orders_ibfk_2` FOREIGN KEY (`payment_id`) REFERENCES `payments` (`id`) ON DELETE SET NULL");
        echo "   ✓ Связь orders->payments создана\n";
    } catch (Exception $e) {
        echo "   ⚠️ Связь уже существует\n";
    }
    
    // Создание остальных таблиц
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `settings` (
          `id` int(11) NOT NULL AUTO_INCREMENT,
          `setting_key` varchar(100) NOT NULL,
          `setting_value` text,
          `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
          `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`),
          UNIQUE KEY `setting_key` (`setting_key`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
    echo "   ✓ Таблица settings создана\n";
    
    echo "4. Добавление начальных данных...\n";
    
    // Добавление администратора
    $adminPassword = 'V4bB00st@dmin!2024';
    $hashedPassword = password_hash($adminPassword, PASSWORD_DEFAULT);
    
    $stmt = $pdo->prepare("
        INSERT INTO admins (username, password_hash, email, role) 
        VALUES ('admin', ?, 'admin@vab-boost.ru', 'admin')
        ON DUPLICATE KEY UPDATE password_hash = ?
    ");
    $stmt->execute([$hashedPassword, $hashedPassword]);
    
    echo "   ✓ Администратор создан\n";
    echo "      Логин: admin\n";
    echo "      Пароль: " . $adminPassword . "\n";
    
    // Добавление настроек
    $settings = [
        ['site_name', 'VAB BOOST'],
        ['site_url', 'https://vab-boost.ru'],
        ['support_email', 'support@vab-boost.ru'],
        ['admin_email', 'admin@vab-boost.ru'],
        ['telegram_support', '@vabboost_support'],
        ['yookassa_shop_id', '1226686'],
        ['yookassa_webhook', 'https://vab-boost.ru/api/payments.php?action=webhook'],
        ['currency', 'RUB'],
        ['maintenance_mode', '0'],
        ['email_notifications', '1'],
        ['session_timeout', '60']
    ];
    
    foreach ($settings as $setting) {
        $stmt = $pdo->prepare("
            INSERT INTO settings (setting_key, setting_value) 
            VALUES (?, ?)
            ON DUPLICATE KEY UPDATE setting_value = ?
        ");
        $stmt->execute([$setting[0], $setting[1], $setting[1]]);
    }
    
    echo "   ✓ Настройки добавлены\n";
    
    echo "5. Создание индексов...\n";
    
    try {
        $pdo->exec("CREATE INDEX idx_orders_status_date ON orders(status, created_at)");
        $pdo->exec("CREATE INDEX idx_payments_status_date ON payments(status, created_at)");
        echo "   ✓ Индексы созданы\n";
    } catch (Exception $e) {
        echo "   ⚠️ Индексы уже существуют\n";
    }
    
    echo "\n✅ Установка успешно завершена!\n\n";
    
    echo "Следующие шаги:\n";
    echo "1. Запустите 'composer install' для установки зависимостей\n";
    echo "2. Настройте веб-сервер (Apache/Nginx)\n";
    echo "3. Настройте SSL сертификат\n";
    echo "4. Настройте вебхук в ЮKassa\n";
    echo "5. Протестируйте систему платежей\n\n";
    
    echo "Для доступа в админ-панель:\n";
    echo "URL: https://ваш-домен/admin.html\n";
    echo "Логин: admin\n";
    echo "Пароль: " . $adminPassword . "\n";
    
} catch (Exception $e) {
    echo "\n❌ Ошибка установки: " . $e->getMessage() . "\n";
    echo "Файл: " . $e->getFile() . ":" . $e->getLine() . "\n";
    exit(1);
}
?>