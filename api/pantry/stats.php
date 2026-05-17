<?php
// Statistiche dispensa: distribuzione categorie e medie nutrizionali
// Metodo: GET

require_once __DIR__ . '/../../includes/cors_headers.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/auth_check.php';

setJsonHeaders();
requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Metodo non consentito', 405);
}

$pdo    = getDB();
$userId = getCurrentUserId();

// Distribuzione per categoria
$stmt = $pdo->prepare("
    SELECT COALESCE(NULLIF(category,''), 'altro') AS category,
           COUNT(*) AS count
    FROM pantry_items
    WHERE user_id = ? AND quantity > 0
    GROUP BY COALESCE(NULLIF(category,''), 'altro')
    ORDER BY count DESC
");
$stmt->execute([$userId]);
$categories = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Medie nutrizionali per 100g (solo prodotti con dati nutrizionali)
$stmt2 = $pdo->prepare("
    SELECT
        COUNT(*)                           AS items_count,
        ROUND(AVG(pr.calories_per_100g),1) AS avg_calories,
        ROUND(AVG(pr.proteins_per_100g),1) AS avg_proteins,
        ROUND(AVG(pr.carbs_per_100g),   1) AS avg_carbs,
        ROUND(AVG(pr.fats_per_100g),    1) AS avg_fats,
        ROUND(AVG(pr.fiber_per_100g),   1) AS avg_fiber,
        ROUND(AVG(pr.salt_per_100g),    1) AS avg_salt
    FROM pantry_items pi
    JOIN products pr ON pi.product_id = pr.id
    WHERE pi.user_id = ? AND pr.calories_per_100g IS NOT NULL
");
$stmt2->execute([$userId]);
$nutrition = $stmt2->fetch(PDO::FETCH_ASSOC);

foreach ($nutrition as $k => $v) {
    $nutrition[$k] = $v !== null ? (float)$v : null;
}
$nutrition['items_count'] = (int)$nutrition['items_count'];

jsonSuccess([
    'categories' => array_map(fn($c) => ['category' => $c['category'], 'count' => (int)$c['count']], $categories),
    'nutrition'  => $nutrition,
]);
