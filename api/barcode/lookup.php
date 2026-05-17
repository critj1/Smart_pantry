<?php
// Endpoint ricerca prodotto tramite barcode
// Metodo: GET
// Parametro: ?barcode=8001234567890
//
// Flusso:
// 1. Cerca il barcode nel catalogo locale (products)
// 2. Se non trovato, chiama OpenFoodFacts API
// 3. Salva il prodotto nel catalogo locale per uso futuro
// 4. Restituisce nome, marca, ingredienti, valori nutrizionali

require_once __DIR__ . '/../../includes/cors_headers.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/auth_check.php';

setJsonHeaders();
requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Metodo non consentito', 405);
}

$barcode = trim($_GET['barcode'] ?? '');

if (empty($barcode)) {
    jsonError('Parametro barcode obbligatorio');
}

// Sanifica il barcode (solo cifre e lettere)
if (!preg_match('/^[0-9A-Za-z\-]{4,20}$/', $barcode)) {
    jsonError('Formato barcode non valido');
}

$pdo = getDB();

// Passo 1: cerca prima nel catalogo locale per evitare chiamate API inutili
$stmt = $pdo->prepare('SELECT * FROM products WHERE barcode = ?');
$stmt->execute([$barcode]);
$localProduct = $stmt->fetch();

if ($localProduct) {
    jsonSuccess(['product' => $localProduct, 'source' => 'cache']);
}

// Passo 2: chiama OpenFoodFacts
$url      = OPENFOODFACTS_URL . urlencode($barcode) . '.json';
$context  = stream_context_create([
    'http' => [
        'timeout'    => 10,
        'user_agent' => 'SmartPantry/1.0 (progetto scolastico)',
        'method'     => 'GET'
    ]
]);

$response = @file_get_contents($url, false, $context);

if ($response === false) {
    jsonError('Impossibile contattare OpenFoodFacts. Controlla la connessione.', 503);
}

$data = json_decode($response, true);

// Controlla se il prodotto è stato trovato
if (!isset($data['status']) || $data['status'] !== 1 || empty($data['product'])) {
    jsonError('Prodotto non trovato per questo barcode', 404);
}

$p = $data['product'];

// Estrai i dati rilevanti dal JSON di OpenFoodFacts
$name        = $p['product_name']         ?? $p['product_name_it'] ?? $p['product_name_en'] ?? '';
$brand       = $p['brands']               ?? '';
$category    = $p['categories']           ?? '';
$imageUrl    = $p['image_url']            ?? $p['image_front_url'] ?? '';
$ingredients = $p['ingredients_text_it']  ?? $p['ingredients_text'] ?? '';

// Valori nutrizionali per 100g (da nutriments)
$nutriments      = $p['nutriments']       ?? [];
$calories        = $nutriments['energy-kcal_100g'] ?? $nutriments['energy_100g'] ?? null;
$proteins        = $nutriments['proteins_100g']     ?? null;
$carbs           = $nutriments['carbohydrates_100g'] ?? null;
$fats            = $nutriments['fat_100g']          ?? null;
$fiber           = $nutriments['fiber_100g']         ?? null;
$salt            = $nutriments['salt_100g']          ?? null;

// Se l'energia è in kJ, converti in kcal (1 kcal = 4.184 kJ)
if ($calories !== null && isset($nutriments['energy-kj_100g']) && !isset($nutriments['energy-kcal_100g'])) {
    $calories = round((float) $nutriments['energy-kj_100g'] / 4.184, 1);
}

if (empty($name)) {
    jsonError('Prodotto trovato ma senza nome. Inserisci manualmente.', 404);
}

// Passo 3: salva il prodotto nel catalogo locale
try {
    $stmtInsert = $pdo->prepare(
        'INSERT INTO products (barcode, name, brand, category, image_url, ingredients,
                               calories_per_100g, proteins_per_100g, carbs_per_100g,
                               fats_per_100g, fiber_per_100g, salt_per_100g)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
             name         = VALUES(name),
             brand        = VALUES(brand),
             image_url    = VALUES(image_url),
             ingredients  = VALUES(ingredients)'
    );

    $stmtInsert->execute([
        $barcode,
        $name,
        $brand        ?: null,
        $category     ?: null,
        $imageUrl     ?: null,
        $ingredients  ?: null,
        $calories     !== null ? round((float) $calories, 2) : null,
        $proteins     !== null ? round((float) $proteins, 2) : null,
        $carbs        !== null ? round((float) $carbs,    2) : null,
        $fats         !== null ? round((float) $fats,     2) : null,
        $fiber        !== null ? round((float) $fiber,    2) : null,
        $salt         !== null ? round((float) $salt,     2) : null,
    ]);
} catch (Exception $e) {
    // Errore di salvataggio non critico — il prodotto viene restituito ugualmente
}

// Recupera il prodotto appena salvato (con ID assegnato)
$stmt = $pdo->prepare('SELECT * FROM products WHERE barcode = ?');
$stmt->execute([$barcode]);
$savedProduct = $stmt->fetch();

jsonSuccess([
    'product' => $savedProduct ?? [
        'barcode'     => $barcode,
        'name'        => $name,
        'brand'       => $brand,
        'image_url'   => $imageUrl,
        'ingredients' => $ingredients,
        'calories_per_100g' => $calories,
        'proteins_per_100g' => $proteins,
        'carbs_per_100g'    => $carbs,
        'fats_per_100g'     => $fats,
    ],
    'source' => 'openfoodfacts'
]);
