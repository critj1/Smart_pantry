<?php
// Lista dei gruppi dell'utente corrente con ruolo e numero membri
// Metodo: GET

require_once __DIR__ . '/../../includes/cors_headers.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/auth_check.php';
require_once __DIR__ . '/../../includes/group_check.php';

setJsonHeaders();
requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Metodo non consentito', 405);
}

$pdo    = getDB();
$userId = getCurrentUserId();

$stmt = $pdo->prepare("
    SELECT g.id, g.name, gm.role, g.created_at,
           CASE WHEN gm.role = 'admin' THEN g.invite_code ELSE NULL END AS invite_code,
           (SELECT COUNT(*) FROM group_members gm2 WHERE gm2.group_id = g.id) AS member_count
    FROM   group_members gm
    JOIN   user_groups g ON g.id = gm.group_id
    WHERE  gm.user_id = ?
    ORDER  BY g.created_at ASC
");
$stmt->execute([$userId]);
$groups = $stmt->fetchAll();

foreach ($groups as &$g) {
    $g['id']           = (int)$g['id'];
    $g['member_count'] = (int)$g['member_count'];
}
unset($g);

jsonSuccess(['groups' => $groups]);
