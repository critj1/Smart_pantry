<?php
// Rigenera il codice invito del gruppo (solo admin)
// Metodo: POST
// Body JSON: { "group_id": 3 }

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
$groupId = (int)($body['group_id'] ?? 0);
if (!$groupId) jsonError('group_id mancante');

$userId = getCurrentUserId();
requireGroupAdmin($userId, $groupId);

$newCode = generateUniqueInviteCode();
$pdo = getDB();
$pdo->prepare('UPDATE user_groups SET invite_code = ? WHERE id = ?')->execute([$newCode, $groupId]);

jsonSuccess(['invite_code' => $newCode, 'message' => 'Codice invito rigenerato']);
