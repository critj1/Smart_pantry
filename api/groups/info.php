<?php
// Dettagli gruppo + lista membri
// Metodo: GET
// Parametri: ?group_id=N

require_once __DIR__ . '/../../includes/cors_headers.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/auth_check.php';
require_once __DIR__ . '/../../includes/group_check.php';

setJsonHeaders();
requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Metodo non consentito', 405);
}

$pdo     = getDB();
$userId  = getCurrentUserId();
$groupId = isset($_GET['group_id']) ? (int)$_GET['group_id'] : getActiveGroupId();

if (!$groupId) {
    jsonError('Nessun gruppo specificato');
}

// Verifica membership e ottieni ruolo
$membership = requireGroupMember($userId, $groupId);

// Info gruppo
$stmtGroup = $pdo->prepare('SELECT id, name, invite_code, created_at FROM user_groups WHERE id = ?');
$stmtGroup->execute([$groupId]);
$group = $stmtGroup->fetch();
if (!$group) jsonError('Gruppo non trovato', 404);

// Lista membri con username
$stmtMembers = $pdo->prepare("
    SELECT u.id, u.username, gm.role, gm.joined_at
    FROM   group_members gm
    JOIN   users u ON u.id = gm.user_id
    WHERE  gm.group_id = ?
    ORDER  BY FIELD(gm.role, 'admin', 'member'), gm.joined_at ASC
");
$stmtMembers->execute([$groupId]);
$members = $stmtMembers->fetchAll();

foreach ($members as &$m) {
    $m['id'] = (int)$m['id'];
}
unset($m);

// Nasconde codice invito ai membri non-admin
if ($membership['role'] !== 'admin') {
    unset($group['invite_code']);
}

jsonSuccess([
    'group'   => $group,
    'members' => $members,
    'my_role' => $membership['role'],
]);
