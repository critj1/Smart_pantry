<?php
// Endpoint lista prodotti dispensa
// Metodo: GET
// Parametri query opzionali:
//   ?search=testo      — filtra per nome
//   ?expiring=1        — solo prodotti in scadenza
//   ?expired=1         — solo prodotti scaduti
//   ?location=frigo    — filtra per posizione

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
$groupId = getActiveGroupId();

// Costruisci la query dinamicamente in base al contesto (personale o gruppo)
if ($groupId !== null) {
    requireGroupMember($userId, $groupId);
    $where  = ['pi.group_id = ?'];
    $params = [$groupId];
} else {
    $where  = ['pi.user_id = ?', 'pi.group_id IS NULL'];
    $params = [$userId];
}

// Filtro ricerca per nome
$search = trim($_GET['search'] ?? '');
if ($search !== '') {
    $where[]  = 'pi.name LIKE ?';
    $params[] = '%' . $search . '%';
}

// Filtro per posizione
$location = trim($_GET['location'] ?? '');
if ($location !== '') {
    $where[]  = 'pi.location = ?';
    $params[] = $location;
}

// Filtro prodotti in scadenza entro 7 giorni
if (!empty($_GET['expiring'])) {
    $where[]  = 'pi.expiry_date IS NOT NULL';
    $where[]  = 'pi.expiry_date >= CURDATE()';
    $where[]  = 'pi.expiry_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)';
    $params[] = EXPIRY_WARNING_DAYS;
}

// Filtro prodotti già scaduti
if (!empty($_GET['expired'])) {
    $where[]  = 'pi.expiry_date IS NOT NULL';
    $where[]  = 'pi.expiry_date < CURDATE()';
}

$whereClause = 'WHERE ' . implode(' AND ', $where);

// Query principale con JOIN al catalogo prodotti per i dati nutrizionali
$sql = "SELECT
            pi.id,
            pi.name,
            pi.brand,
            pi.category,
            pi.quantity,
            pi.unit,
            pi.expiry_date,
            pi.location,
            pi.notes,
            pi.added_at,
            p.barcode,
            p.image_url,
            p.calories_per_100g,
            p.proteins_per_100g,
            p.carbs_per_100g,
            p.fats_per_100g,
            p.fiber_per_100g,
            p.salt_per_100g,
            -- Calcola lo stato di scadenza
            CASE
                WHEN pi.expiry_date IS NULL THEN 'ok'
                WHEN pi.expiry_date < CURDATE() THEN 'expired'
                WHEN pi.expiry_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY) THEN 'expiring'
                ELSE 'ok'
            END AS expiry_status,
            -- Giorni alla scadenza (negativo se già scaduto)
            DATEDIFF(pi.expiry_date, CURDATE()) AS days_to_expiry
        FROM pantry_items pi
        LEFT JOIN products p ON pi.product_id = p.id
        $whereClause
        ORDER BY
            CASE WHEN pi.expiry_date IS NULL THEN 1 ELSE 0 END,
            pi.expiry_date ASC,
            pi.name ASC";

// Aggiungi il parametro per il CASE WHEN (EXPIRY_WARNING_DAYS)
array_unshift($params, EXPIRY_WARNING_DAYS);

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$items = $stmt->fetchAll();

// Converti i tipi numerici
foreach ($items as &$item) {
    $item['quantity']          = (float)  $item['quantity'];
    $item['calories_per_100g'] = $item['calories_per_100g'] !== null ? (float) $item['calories_per_100g'] : null;
    $item['proteins_per_100g'] = $item['proteins_per_100g'] !== null ? (float) $item['proteins_per_100g'] : null;
    $item['carbs_per_100g']    = $item['carbs_per_100g']    !== null ? (float) $item['carbs_per_100g']    : null;
    $item['fats_per_100g']     = $item['fats_per_100g']     !== null ? (float) $item['fats_per_100g']     : null;
    $item['fiber_per_100g']    = $item['fiber_per_100g']    !== null ? (float) $item['fiber_per_100g']    : null;
    $item['salt_per_100g']     = $item['salt_per_100g']     !== null ? (float) $item['salt_per_100g']     : null;
    $item['days_to_expiry']    = $item['days_to_expiry']    !== null ? (int)   $item['days_to_expiry']    : null;
}
unset($item);

// Conta i prodotti per stato per le statistiche
$expired  = count(array_filter($items, fn($i) => $i['expiry_status'] === 'expired'));
$expiring = count(array_filter($items, fn($i) => $i['expiry_status'] === 'expiring'));

jsonSuccess([
    'items' => $items,
    'stats' => [
        'total'    => count($items),
        'expired'  => $expired,
        'expiring' => $expiring,
        'ok'       => count($items) - $expired - $expiring
    ]
]);
