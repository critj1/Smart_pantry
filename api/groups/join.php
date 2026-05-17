<?php
// Entra in un gruppo tramite codice invito
// Metodo: POST
// Body JSON: { "invite_code": "ABCD1234" }

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

$code = strtoupper(trim($body['invite_code'] ?? ''));
if (strlen($code) < 6) {
    jsonError('Codice invito non valido');
}

$pdo    = getDB();
$userId = getCurrentUserId();

// Trova il gruppo tramite codice
$stmtGroup = $pdo->prepare('SELECT id, name FROM user_groups WHERE invite_code = ?');
$stmtGroup->execute([$code]);
$group = $stmtGroup->fetch();
if (!$group) {
    jsonError('Codice invito non trovato. Controlla e riprova.');
}

// Controlla se l'utente è già membro
$stmtCheck = $pdo->prepare('SELECT id FROM group_members WHERE group_id = ? AND user_id = ?');
$stmtCheck->execute([(int)$group['id'], $userId]);
if ($stmtCheck->fetch()) {
    jsonError('Sei già membro di questo gruppo');
}

// Massimo 5 gruppi per utente
$stmtCount = $pdo->prepare('SELECT COUNT(*) FROM group_members WHERE user_id = ?');
$stmtCount->execute([$userId]);
if ((int)$stmtCount->fetchColumn() >= 5) {
    jsonError('Puoi essere membro di massimo 5 gruppi');
}

$stmtJoin = $pdo->prepare('INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, "member")');
$stmtJoin->execute([(int)$group['id'], $userId]);

jsonSuccess([
    'message' => 'Benvenuto nel gruppo "' . $group['name'] . '"!',
    'group' => [
        'id'   => (int)$group['id'],
        'name' => $group['name'],
        'role' => 'member',
    ]
]);
