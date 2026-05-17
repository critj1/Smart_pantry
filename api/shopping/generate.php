<?php
// Endpoint generazione lista della spesa
// Metodo: GET
// Parametri:
//   ?start=YYYY-MM-DD  (default: oggi)
//   ?end=YYYY-MM-DD    (default: tra 6 giorni)
//
// Logica:
// 1. Prende tutti i pasti pianificati nel periodo
// 2. Estrae e de-duplica gli ingredienti
// 3. Confronta con la dispensa (ricerca substring)
// 4. Restituisce: available (in dispensa) e missing (da comprare)

require_once __DIR__ . '/../../includes/cors_headers.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/auth_check.php';

setJsonHeaders();
requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Metodo non consentito', 405);
}

$pdo    = getDB();
$userId = getCurrentUserId();

$start = trim($_GET['start'] ?? date('Y-m-d'));
$end   = trim($_GET['end']   ?? date('Y-m-d', strtotime('+6 days')));

if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $start) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $end)) {
    jsonError('Formato data non valido. Usa YYYY-MM-DD');
}

// 1. Ingredienti dai pasti pianificati nel periodo
$stmt = $pdo->prepare("
    SELECT ingredients
    FROM meal_plans
    WHERE user_id = ? AND date BETWEEN ? AND ? AND ingredients IS NOT NULL
");
$stmt->execute([$userId, $start, $end]);
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

// 2. Estrai e de-duplica (case-insensitive)
$ingredientsMap = []; // lowercase => original
foreach ($rows as $row) {
    $list = json_decode($row['ingredients'], true);
    if (!is_array($list)) continue;
    foreach ($list as $item) {
        $item = trim($item);
        if ($item === '') continue;
        $key = mb_strtolower($item);
        if (!isset($ingredientsMap[$key])) {
            $ingredientsMap[$key] = $item;
        }
    }
}

if (empty($ingredientsMap)) {
    jsonSuccess([
        'available' => [],
        'missing'   => [],
        'message'   => 'Nessun ingrediente trovato nei pasti del periodo. Aggiungi pasti con ingredienti.',
    ]);
}

// 3. Dispensa utente
$pantryStmt = $pdo->prepare("SELECT LOWER(name) as name FROM pantry_items WHERE user_id = ? AND quantity > 0");
$pantryStmt->execute([$userId]);
$pantryNames = $pantryStmt->fetchAll(PDO::FETCH_COLUMN); // array di nomi lowercase

// 4. Confronto con substring matching
$available = [];
$missing   = [];

foreach ($ingredientsMap as $key => $original) {
    $found = false;
    foreach ($pantryNames as $pantryName) {
        // Controlla se l'ingrediente è contenuto nel nome del prodotto o viceversa
        if (strpos($pantryName, $key) !== false || strpos($key, $pantryName) !== false) {
            $found = true;
            break;
        }
    }
    if ($found) {
        $available[] = $original;
    } else {
        $missing[] = $original;
    }
}

jsonSuccess([
    'available' => $available,
    'missing'   => $missing,
    'period'    => ['start' => $start, 'end' => $end],
    'total'     => count($available) + count($missing),
]);
