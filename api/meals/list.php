<?php
// Endpoint lista pasti pianificati
// Metodo: GET
// Parametri opzionali:
//   ?start=YYYY-MM-DD  (default: primo giorno del mese corrente)
//   ?end=YYYY-MM-DD    (default: ultimo giorno del mese corrente)

require_once __DIR__ . '/../../includes/cors_headers.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/auth_check.php';
require_once __DIR__ . '/../../includes/group_check.php';

setJsonHeaders();
requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Metodo non consentito', 405);
}

$pdo     = getDB();
$userId  = getCurrentUserId();
$groupId = getActiveGroupId();

// Intervallo di date (default: mese corrente)
$start = trim($_GET['start'] ?? date('Y-m-01'));
$end   = trim($_GET['end']   ?? date('Y-m-t'));

if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $start) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $end)) {
    jsonError('Formato data non valido. Usa YYYY-MM-DD');
}

if ($groupId !== null) {
    requireGroupMember($userId, $groupId);
    $stmt = $pdo->prepare("
        SELECT id, date, meal_type, title, notes, ingredients, recipe_id, recipe_name, created_at
        FROM meal_plans
        WHERE group_id = ? AND date BETWEEN ? AND ?
        ORDER BY date ASC, FIELD(meal_type, 'colazione', 'pranzo', 'cena')
    ");
    $stmt->execute([$groupId, $start, $end]);
} else {
    $stmt = $pdo->prepare("
        SELECT id, date, meal_type, title, notes, ingredients, recipe_id, recipe_name, created_at
        FROM meal_plans
        WHERE user_id = ? AND group_id IS NULL AND date BETWEEN ? AND ?
        ORDER BY date ASC, FIELD(meal_type, 'colazione', 'pranzo', 'cena')
    ");
    $stmt->execute([$userId, $start, $end]);
}
$meals = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Decodifica il JSON degli ingredienti
foreach ($meals as &$meal) {
    $meal['ingredients'] = $meal['ingredients'] ? json_decode($meal['ingredients'], true) : [];
    $meal['id']          = (int)$meal['id'];
    $meal['recipe_id']   = $meal['recipe_id'] ? (int)$meal['recipe_id'] : null;
}
unset($meal);

jsonSuccess(['meals' => $meals]);
