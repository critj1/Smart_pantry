<?php
// Rimuovi un membro dal gruppo (solo admin)
// Metodo: POST
// Body JSON: { "group_id": 3, "user_id": 7 }

require_once __DIR__ . '/../../includes/cors_headers.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/auth_check.php';
require_once __DIR__ . '/../../includes/group_check.php';

setJsonHeaders();
requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('Metodo non consentito', 405);
}

$body         = getJsonBody();
$groupId      = (int)($body['group_id'] ?? 0);
$targetUserId = (int)($body['user_id']  ?? 0);

if (!$groupId || !$targetUserId) jsonError('Parametri mancanti');

$adminUserId = getCurrentUserId();
if ($adminUserId === $targetUserId) {
    jsonError('Non puoi rimuovere te stesso. Usa "abbandona gruppo".');
}

requireGroupAdmin($adminUserId, $groupId);

$pdo = getDB();

$stmtCheck = $pdo->prepare('SELECT id FROM group_members WHERE group_id = ? AND user_id = ?');
$stmtCheck->execute([$groupId, $targetUserId]);
if (!$stmtCheck->fetch()) jsonError('Utente non trovato nel gruppo', 404);

$pdo->prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?')
    ->execute([$groupId, $targetUserId]);

jsonSuccess(['message' => 'Membro rimosso dal gruppo']);
