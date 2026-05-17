<?php
// Endpoint aggiunta pasto pianificato
// Metodo: POST
// Body JSON: { date, meal_type, title, notes?, ingredients?, recipe_id?, recipe_name? }

require_once __DIR__ . '/../../includes/cors_headers.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/auth_check.php';
require_once __DIR__ . '/../../includes/group_check.php';

setJsonHeaders();
requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('Metodo non consentito', 405);
}

$body = getJsonBody();
if ($body === null) {
    jsonError('JSON non valido');
}

$pdo     = getDB();
$userId  = getCurrentUserId();
$groupId = getActiveGroupId();

if ($groupId !== null) {
    requireGroupAdmin($userId, $groupId);
}

// Validazione campi obbligatori
$date       = trim($body['date']        ?? '');
$mealType   = trim($body['meal_type']   ?? '');
$title      = trim($body['title']       ?? '');
$notes      = trim($body['notes']       ?? '');
$ingredients = $body['ingredients']     ?? [];
$recipeId   = isset($body['recipe_id']) && $body['recipe_id'] ? (int)$body['recipe_id'] : null;
$recipeName = trim($body['recipe_name'] ?? '');

if (!$date || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
    jsonError('Data non valida. Usa YYYY-MM-DD');
}
if (!in_array($mealType, ['colazione', 'pranzo', 'cena'], true)) {
    jsonError('Tipo pasto non valido. Usa: colazione, pranzo, cena');
}
if (empty($title)) {
    jsonError('Il nome del pasto è obbligatorio');
}

// Sanitizza ingredienti
$ingredients = array_values(array_filter(array_map('trim', (array)$ingredients)));
$ingredientsJson = !empty($ingredients) ? json_encode($ingredients, JSON_UNESCAPED_UNICODE) : null;

$stmt = $pdo->prepare("
    INSERT INTO meal_plans (user_id, group_id, date, meal_type, title, notes, ingredients, recipe_id, recipe_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
");
$stmt->execute([
    $userId,
    $groupId,
    $date,
    $mealType,
    $title,
    $notes      ?: null,
    $ingredientsJson,
    $recipeId,
    $recipeName ?: null,
]);

$newId = (int)$pdo->lastInsertId();

jsonSuccess([
    'message' => 'Pasto aggiunto',
    'meal' => [
        'id'          => $newId,
        'date'        => $date,
        'meal_type'   => $mealType,
        'title'       => $title,
        'notes'       => $notes,
        'ingredients' => $ingredients,
        'recipe_id'   => $recipeId,
        'recipe_name' => $recipeName,
    ]
], 201);
