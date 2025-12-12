<?php
require_once __DIR__ . '/../config.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . SITE_URL);
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if (!isAdminAuthenticated()) {
    jsonResponse(['error' => 'Unauthorized'], 401);
    exit;
}

$db = getDB();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $db->query("
        SELECT id, username, email, created_at, last_login 
        FROM users 
        ORDER BY created_at DESC
    ");
    
    $users = $stmt->fetchAll();
    jsonResponse($users);
}
?>