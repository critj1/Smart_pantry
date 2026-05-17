<?php
// Endpoint modifica prodotto in dispensa
// Metodo: PUT
// Body JSON: stessi campi di add.php + "id" obbligatorio
// Aggiorna solo i campi forniti (patch parziale)

require_once __DIR__ . '/../../includes/cors_headers.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/auth_check.php';
require_once __DIR__ . '/../../includes/group_check.php';

setJsonHeaders();
requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
    jsonError('Metodo non consentito', 405);
}

$body = getJsonBody();
if ($body === null) {
    jsonError('JSON non valido nel corpo della richiesta');
}

$itemId = (int) ($body['id'] ?? 0);
if ($itemId <= 0) {
    jsonError('ID prodotto non valido o mancante');
}

$pdo     = getDB();
$userId  = getCurrentUserId();
$groupId = getActiveGroupId();

// Verifica che il prodotto appartenga al contesto corrente
if ($groupId !== null) {
    requireGroupAdmin($userId, $groupId);
    $stmtCheck = $pdo->prepare('SELECT id FROM pantry_items WHERE id = ? AND group_id = ?');
    $stmtCheck->execute([$itemId, $groupId]);
} else {
    $stmtCheck = $pdo->prepare('SELECT id FROM pantry_items WHERE id = ? AND user_id = ? AND group_id IS NULL');
    $stmtCheck->execute([$itemId, $userId]);
}
if (!$stmtCheck->fetch()) {
    jsonError('Prodotto non trovato', 404);
}

// Costruisci l'UPDATE dinamicamente con solo i campi forniti
$updateFields = [];
$params       = [];

// Mappa campi body => colonne database
$allowedFields = [
    'name'        => 'name',
    'brand'       => 'brand',
    'category'    => 'category',
    'quantity'    => 'quantity',
    'unit'        => 'unit',
    'expiry_date' => 'expiry_date',
    'location'    => 'location',
    'notes'       => 'notes'
];

foreach ($allowedFields as $bodyField => $dbColumn) {
    if (!array_key_exists($bodyField, $body)) {
        continue; // Campo non fornito — lascia invariato
    }

    $value = $body[$bodyField];

    // Validazioni specifiche per campo
    if ($bodyField === 'name') {
        $value = trim($value);
        if (empty($value)) {
            jsonError('Il nome del prodotto non può essere vuoto');
        }
    }

    if ($bodyField === 'quantity') {
        if (!is_numeric($value) || (float) $value <= 0) {
            jsonError('La quantità deve essere un numero positivo');
        }
        $value = (float) $value;
    }

    if ($bodyField === 'expiry_date' && $value !== '' && $value !== null) {
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
            jsonError('Formato data non valido. Usa YYYY-MM-DD');
        }
    }

    $updateFields[] = "$dbColumn = ?";
    $params[]       = ($value === '' || $value === null) ? null : $value;
}

if (empty($updateFields)) {
    jsonError('Nessun campo da aggiornare fornito');
}

// Aggiungi id e il parametro WHERE contestuale
$params[] = $itemId;
$params[] = $groupId !== null ? $groupId : $userId;

$sql = $groupId !== null
    ? 'UPDATE pantry_items SET ' . implode(', ', $updateFields) . ' WHERE id = ? AND group_id = ?'
    : 'UPDATE pantry_items SET ' . implode(', ', $updateFields) . ' WHERE id = ? AND user_id = ? AND group_id IS NULL';
$stmt = $pdo->prepare($sql);
$stmt->execute($params);

// Recupera il prodotto aggiornato
$stmtGet = $pdo->prepare(
    'SELECT pi.*, p.barcode, p.image_url, p.calories_per_100g
     FROM pantry_items pi
     LEFT JOIN products p ON pi.product_id = p.id
     WHERE pi.id = ?'
);
$stmtGet->execute([$itemId]);
$updatedItem = $stmtGet->fetch();

jsonSuccess([
    'message' => 'Prodotto aggiornato con successo',
    'item'    => $updatedItem
]);
