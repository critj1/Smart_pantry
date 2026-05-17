<?php
// Crea un nuovo gruppo — il creatore diventa admin automaticamente
// Metodo: POST
// Body JSON: { "name": "Nome gruppo" }

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
if ($body === null) jsonError('JSON non valido');

$name = trim($body['name'] ?? '');
if (strlen($name) < 2 || strlen($name) > 100) {
    jsonError('Il nome del gruppo deve avere tra 2 e 100 caratteri');
}

$pdo    = getDB();
$userId = getCurrentUserId();

// Massimo 5 gruppi per utente
$stmtCount = $pdo->prepare('SELECT COUNT(*) FROM group_members WHERE user_id = ?');
$stmtCount->execute([$userId]);
if ((int)$stmtCount->fetchColumn() >= 5) {
    jsonError('Puoi essere membro di massimo 5 gruppi');
}

$inviteCode = generateUniqueInviteCode();

$pdo->beginTransaction();
try {
    $stmtGroup = $pdo->prepare('INSERT INTO user_groups (name, invite_code) VALUES (?, ?)');
    $stmtGroup->execute([$name, $inviteCode]);
    $groupId = (int)$pdo->lastInsertId();

    $stmtMember = $pdo->prepare('INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, "admin")');
    $stmtMember->execute([$groupId, $userId]);

    $pdo->commit();
} catch (\Exception $e) {
    $pdo->rollBack();
    jsonError('Errore durante la creazione del gruppo');
}

jsonSuccess([
    'message' => 'Gruppo creato con successo',
    'group' => [
        'id'          => $groupId,
        'name'        => $name,
        'invite_code' => $inviteCode,
        'role'        => 'admin',
        'member_count' => 1,
    ]
], 201);
