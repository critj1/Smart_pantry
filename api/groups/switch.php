<?php
// Cambia il contesto attivo tra personale e gruppo
// Metodo: POST
// Body JSON: { "context": "personal" } oppure { "context": "group", "group_id": 3 }

require_once __DIR__ . '/../../includes/cors_headers.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/auth_check.php';
require_once __DIR__ . '/../../includes/group_check.php';

setJsonHeaders();
requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('Metodo non consentito', 405);
}

$body    = getJsonBody();
$context = trim($body['context'] ?? '');
$userId  = getCurrentUserId();

if ($context === 'personal') {
    setActiveGroupId(null);
    jsonSuccess(['message' => 'Contesto cambiato a personale', 'context' => 'personal']);
}

if ($context === 'group') {
    $groupId = isset($body['group_id']) ? (int)$body['group_id'] : 0;
    if (!$groupId) jsonError('group_id mancante');

    requireGroupMember($userId, $groupId);
    setActiveGroupId($groupId);

    $pdo = getDB();
    $stmtName = $pdo->prepare('SELECT name FROM user_groups WHERE id = ?');
    $stmtName->execute([$groupId]);
    $groupName = $stmtName->fetchColumn();

    jsonSuccess([
        'message'    => 'Contesto cambiato al gruppo',
        'context'    => 'group',
        'group_id'   => $groupId,
        'group_name' => $groupName,
    ]);
}

jsonError('Contesto non valido. Usa "personal" o "group"');
