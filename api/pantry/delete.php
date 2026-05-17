<?php
// Endpoint eliminazione prodotto dalla dispensa
// Metodo: DELETE
// Body JSON: { "id": 42 }
// Oppure query string: ?id=42

require_once __DIR__ . '/../../includes/cors_headers.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/auth_check.php';
require_once __DIR__ . '/../../includes/group_check.php';

setJsonHeaders();
requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') {
    jsonError('Metodo non consentito', 405);
}

// Accetta l'ID sia dal body JSON che dalla query string
$body   = getJsonBody() ?? [];
$itemId = (int) ($body['id'] ?? $_GET['id'] ?? 0);

if ($itemId <= 0) {
    jsonError('ID prodotto non valido o mancante');
}

$pdo     = getDB();
$userId  = getCurrentUserId();
$groupId = getActiveGroupId();

// Elimina in base al contesto (personale o gruppo)
if ($groupId !== null) {
    requireGroupAdmin($userId, $groupId);
    $stmt = $pdo->prepare('DELETE FROM pantry_items WHERE id = ? AND group_id = ?');
    $stmt->execute([$itemId, $groupId]);
} else {
    $stmt = $pdo->prepare('DELETE FROM pantry_items WHERE id = ? AND user_id = ? AND group_id IS NULL');
    $stmt->execute([$itemId, $userId]);
}

if ($stmt->rowCount() === 0) {
    jsonError('Prodotto non trovato', 404);
}

jsonSuccess(['message' => 'Prodotto eliminato dalla dispensa']);
