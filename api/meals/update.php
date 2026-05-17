<?php
// Endpoint modifica pasto pianificato
// Metodo: PUT
// Body JSON: { id, title, notes?, ingredients?, recipe_id?, recipe_name? }

require_once __DIR__ . '/../../includes/cors_headers.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/auth_check.php';
require_once __DIR__ . '/../../includes/group_check.php';

setJsonHeaders();
requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
    jsonError('Metodo non consentito', 405);
}

$body = getJsonBody();
if ($body === null) {
    jsonError('JSON non valido');
}

$pdo     = getDB();
$userId  = getCurrentUserId();
$groupId = getActiveGroupId();

$id          = (int)($body['id']          ?? 0);
$title       = trim($body['title']        ?? '');
$notes       = trim($body['notes']        ?? '');
$ingredients = $body['ingredients']       ?? [];
$recipeId    = isset($body['recipe_id']) && $body['recipe_id'] ? (int)$body['recipe_id'] : null;
$recipeName  = trim($body['recipe_name']  ?? '');

if (!$id) {
    jsonError('ID non valido');
}
if (empty($title)) {
    jsonError('Il nome del pasto è obbligatorio');
}

// Verifica proprietà del pasto in base al contesto
if ($groupId !== null) {
    requireGroupAdmin($userId, $groupId);
    $check = $pdo->prepare('SELECT id FROM meal_plans WHERE id = ? AND group_id = ?');
    $check->execute([$id, $groupId]);
} else {
    $check = $pdo->prepare('SELECT id FROM meal_plans WHERE id = ? AND user_id = ? AND group_id IS NULL');
    $check->execute([$id, $userId]);
}
if (!$check->fetch()) {
    jsonError('Pasto non trovato', 404);
}

// Sanitizza ingredienti
$ingredients = array_values(array_filter(array_map('trim', (array)$ingredients)));
$ingredientsJson = !empty($ingredients) ? json_encode($ingredients, JSON_UNESCAPED_UNICODE) : null;

if ($groupId !== null) {
    $stmt = $pdo->prepare("
        UPDATE meal_plans
        SET title=?, notes=?, ingredients=?, recipe_id=?, recipe_name=?, updated_at=NOW()
        WHERE id=? AND group_id=?
    ");
    $stmt->execute([$title, $notes ?: null, $ingredientsJson, $recipeId, $recipeName ?: null, $id, $groupId]);
} else {
    $stmt = $pdo->prepare("
        UPDATE meal_plans
        SET title=?, notes=?, ingredients=?, recipe_id=?, recipe_name=?, updated_at=NOW()
        WHERE id=? AND user_id=? AND group_id IS NULL
    ");
    $stmt->execute([$title, $notes ?: null, $ingredientsJson, $recipeId, $recipeName ?: null, $id, $userId]);
}

jsonSuccess(['message' => 'Pasto aggiornato']);
