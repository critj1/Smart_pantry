<?php
// Endpoint dati utente corrente
// Metodo: GET
// Richiede autenticazione — usato per verificare la sessione attiva

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

// Recupera i dati dell'utente corrente
$stmt = $pdo->prepare('SELECT id, username, email, created_at FROM users WHERE id = ?');
$stmt->execute([$userId]);
$user = $stmt->fetch();

if (!$user) {
    // Sessione orfana — utente eliminato dal DB
    session_destroy();
    jsonError('Utente non trovato', 404);
}

// Conta i prodotti personali in dispensa
$stmtCount = $pdo->prepare('SELECT COUNT(*) AS total FROM pantry_items WHERE user_id = ? AND group_id IS NULL');
$stmtCount->execute([$userId]);
$countData = $stmtCount->fetch();

// Conta i prodotti in scadenza entro 7 giorni
$stmtExpiry = $pdo->prepare(
    'SELECT COUNT(*) AS expiring
     FROM pantry_items
     WHERE user_id = ?
       AND group_id IS NULL
       AND expiry_date IS NOT NULL
       AND expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY)'
);
$stmtExpiry->execute([$userId, EXPIRY_WARNING_DAYS]);
$expiryData = $stmtExpiry->fetch();

// Gruppi dell'utente con ruolo e numero membri
$stmtGroups = $pdo->prepare("
    SELECT g.id, g.name, gm.role,
           CASE WHEN gm.role = 'admin' THEN g.invite_code ELSE NULL END AS invite_code,
           (SELECT COUNT(*) FROM group_members gm2 WHERE gm2.group_id = g.id) AS member_count
    FROM   group_members gm
    JOIN   user_groups g ON g.id = gm.group_id
    WHERE  gm.user_id = ?
    ORDER  BY g.created_at ASC
");
$stmtGroups->execute([$userId]);
$groups = $stmtGroups->fetchAll();
foreach ($groups as &$g) {
    $g['id']           = (int)$g['id'];
    $g['member_count'] = (int)$g['member_count'];
}
unset($g);

// Contesto attivo dalla sessione
$activeGroupId = getActiveGroupId();
$activeContext = ['type' => 'personal', 'group_id' => null, 'group_name' => null, 'role' => null];

if ($activeGroupId !== null) {
    foreach ($groups as $g) {
        if ($g['id'] === $activeGroupId) {
            $activeContext = [
                'type'       => 'group',
                'group_id'   => $g['id'],
                'group_name' => $g['name'],
                'role'       => $g['role'],
            ];
            break;
        }
    }
    // Utente rimosso dal gruppo: reset al personale
    if ($activeContext['type'] === 'personal') {
        setActiveGroupId(null);
    }
}

jsonSuccess([
    'user' => [
        'id'             => $user['id'],
        'username'       => $user['username'],
        'email'          => $user['email'],
        'created_at'     => $user['created_at'],
        'stats' => [
            'total_items'    => (int) $countData['total'],
            'expiring_items' => (int) $expiryData['expiring']
        ],
        'active_context' => $activeContext,
        'groups'         => $groups,
    ]
]);
