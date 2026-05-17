<?php
// Abbandona un gruppo
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

$pdo    = getDB();
$userId = getCurrentUserId();

$membership = requireGroupMember($userId, $groupId);

// L'unico admin non può abbandonare se ci sono altri membri
if ($membership['role'] === 'admin') {
    $stmtAdmins = $pdo->prepare("SELECT COUNT(*) FROM group_members WHERE group_id = ? AND role = 'admin'");
    $stmtAdmins->execute([$groupId]);
    $adminCount = (int)$stmtAdmins->fetchColumn();

    if ($adminCount <= 1) {
        $stmtTotal = $pdo->prepare('SELECT COUNT(*) FROM group_members WHERE group_id = ?');
        $stmtTotal->execute([$groupId]);
        $totalMembers = (int)$stmtTotal->fetchColumn();

        if ($totalMembers > 1) {
            jsonError('Sei l\'unico admin. Promuovi un altro membro ad admin prima di abbandonare il gruppo.');
        }

        // Solo tu nel gruppo: elimina il gruppo
        $pdo->prepare('DELETE FROM user_groups WHERE id = ?')->execute([$groupId]);
        if (getActiveGroupId() === $groupId) {
            setActiveGroupId(null);
        }
        jsonSuccess(['message' => 'Gruppo eliminato (eri l\'unico membro)']);
    }
}

$pdo->prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?')->execute([$groupId, $userId]);

if (getActiveGroupId() === $groupId) {
    setActiveGroupId(null);
}

jsonSuccess(['message' => 'Hai abbandonato il gruppo']);
