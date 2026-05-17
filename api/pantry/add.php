<?php
// Endpoint aggiunta prodotto alla dispensa
// Metodo: POST
// Body JSON:
// {
//   "name": "Latte",                (obbligatorio)
//   "brand": "Granarolo",           (opzionale)
//   "barcode": "8001234567890",     (opzionale — collega al catalogo prodotti)
//   "image_url": "https://...",     (opzionale)
//   "category": "latticini",        (opzionale)
//   "quantity": 2,                  (default 1)
//   "unit": "l",                    (default "pz")
//   "expiry_date": "2025-12-31",    (opzionale, YYYY-MM-DD)
//   "location": "frigo",            (opzionale)
//   "notes": "...",                 (opzionale)
//   "calories_per_100g": 52.0,      (opzionale — valori nutrizionali da OpenFoodFacts)
//   "proteins_per_100g": 3.5,
//   "carbs_per_100g": 5.0,
//   "fats_per_100g": 1.8,
//   "fiber_per_100g": 0.0,
//   "salt_per_100g": 0.1
// }

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
if ($body === null) {
    jsonError('JSON non valido nel corpo della richiesta');
}

// Estrai e valida i campi base
$name       = trim($body['name']        ?? '');
$brand      = trim($body['brand']       ?? '');
$category   = trim($body['category']    ?? '');
$quantity   = $body['quantity']         ?? 1;
$unit       = trim($body['unit']        ?? 'pz');
$expiryDate = trim($body['expiry_date'] ?? '');
$location   = trim($body['location']    ?? '');
$notes      = trim($body['notes']       ?? '');
$barcode    = trim($body['barcode']     ?? '');

// Campi nutrizionali opzionali (inviati dallo scanner / ricerca per nome)
$imageUrl    = trim($body['image_url'] ?? '');
$caloriesPer = array_key_exists('calories_per_100g', $body) && $body['calories_per_100g'] !== null ? (float) $body['calories_per_100g'] : null;
$proteinsPer = array_key_exists('proteins_per_100g', $body) && $body['proteins_per_100g'] !== null ? (float) $body['proteins_per_100g'] : null;
$carbsPer    = array_key_exists('carbs_per_100g',    $body) && $body['carbs_per_100g']    !== null ? (float) $body['carbs_per_100g']    : null;
$fatsPer     = array_key_exists('fats_per_100g',     $body) && $body['fats_per_100g']     !== null ? (float) $body['fats_per_100g']     : null;
$fiberPer    = array_key_exists('fiber_per_100g',    $body) && $body['fiber_per_100g']    !== null ? (float) $body['fiber_per_100g']    : null;
$saltPer     = array_key_exists('salt_per_100g',     $body) && $body['salt_per_100g']     !== null ? (float) $body['salt_per_100g']     : null;

if (empty($name)) {
    jsonError('Il nome del prodotto è obbligatorio');
}

if (!is_numeric($quantity) || (float) $quantity <= 0) {
    jsonError('La quantità deve essere un numero positivo');
}

// Validazione formato data scadenza
if ($expiryDate !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $expiryDate)) {
    jsonError('Formato data non valido. Usa YYYY-MM-DD');
}

$pdo     = getDB();
$userId  = getCurrentUserId();
$groupId = getActiveGroupId();

if ($groupId !== null) {
    requireGroupAdmin($userId, $groupId);
}

// Cerca o crea il prodotto nel catalogo tramite barcode (se fornito)
$productId = null;
if ($barcode !== '') {
    $stmtProd = $pdo->prepare('SELECT id FROM products WHERE barcode = ?');
    $stmtProd->execute([$barcode]);
    $existing = $stmtProd->fetch();

    if ($existing) {
        // Prodotto già nel catalogo: aggiorna solo i campi ancora NULL
        $productId = (int) $existing['id'];
        $pdo->prepare(
            'UPDATE products SET
                image_url         = COALESCE(image_url,         NULLIF(?, "")),
                calories_per_100g = COALESCE(calories_per_100g, ?),
                proteins_per_100g = COALESCE(proteins_per_100g, ?),
                carbs_per_100g    = COALESCE(carbs_per_100g,    ?),
                fats_per_100g     = COALESCE(fats_per_100g,     ?),
                fiber_per_100g    = COALESCE(fiber_per_100g,    ?),
                salt_per_100g     = COALESCE(salt_per_100g,     ?)
             WHERE id = ?'
        )->execute([
            $imageUrl ?: null,
            $caloriesPer, $proteinsPer, $carbsPer, $fatsPer, $fiberPer, $saltPer,
            $productId
        ]);
    } else {
        // Nuovo prodotto: inseriscilo nel catalogo globale
        $stmtIns = $pdo->prepare(
            'INSERT INTO products
                (barcode, name, brand, image_url, calories_per_100g, proteins_per_100g, carbs_per_100g, fats_per_100g, fiber_per_100g, salt_per_100g)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $stmtIns->execute([
            $barcode, $name, $brand ?: null, $imageUrl ?: null,
            $caloriesPer, $proteinsPer, $carbsPer, $fatsPer, $fiberPer, $saltPer
        ]);
        $productId = (int) $pdo->lastInsertId();
    }
}

// Inserisci il prodotto nella dispensa
$stmt = $pdo->prepare(
    'INSERT INTO pantry_items (user_id, group_id, product_id, name, brand, category, quantity, unit, expiry_date, location, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
);

$stmt->execute([
    $userId,
    $groupId,
    $productId,
    $name,
    $brand    ?: null,
    $category ?: null,
    (float) $quantity,
    $unit,
    $expiryDate ?: null,
    $location   ?: null,
    $notes      ?: null
]);

$newId = (int) $pdo->lastInsertId();

// Recupera il prodotto appena inserito per restituirlo completo
$stmtGet = $pdo->prepare(
    'SELECT pi.*, p.barcode, p.image_url,
            p.calories_per_100g, p.proteins_per_100g, p.carbs_per_100g,
            p.fats_per_100g, p.fiber_per_100g, p.salt_per_100g
     FROM pantry_items pi
     LEFT JOIN products p ON pi.product_id = p.id
     WHERE pi.id = ?'
);
$stmtGet->execute([$newId]);
$newItem = $stmtGet->fetch();

jsonSuccess([
    'message' => 'Prodotto aggiunto alla dispensa',
    'item'    => $newItem
], 201);
