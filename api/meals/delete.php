<?php
// Endpoint eliminazione pasto pianificato
// Metodo: DELETE
// Body JSON: { id }

require_once __DIR__ . '/../../includes/cors_headers.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/auth_check.php';
require_once __DIR__ . '/../../includes/group_check.php';

setJsonHeaders();
requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') {
    jsonError('Metodo non consentito', 405);
}

$body = getJsonBody();
$id   = (int)($body['id'] ?? 0);

if (!$id) {
    jsonError('ID non valido');
}

$pdo     = getDB();
$userId  = getCurrentUserId();
$groupId = getActiveGroupId();

if ($groupId !== null) {
    requireGroupAdmin($userId, $groupId);
    $stmt = $pdo->prepare('DELETE FROM meal_plans WHERE id = ? AND group_id = ?');
    $stmt->execute([$id, $groupId]);
} else {
    $stmt = $pdo->prepare('DELETE FROM meal_plans WHERE id = ? AND user_id = ? AND group_id IS NULL');
    $stmt->execute([$id, $userId]);
}

if ($stmt->rowCount() === 0) {
    jsonError('Pasto non trovato', 404);
}

jsonSuccess(['message' => 'Pasto eliminato']);
