<?php
// Endpoint ricerca prodotto per nome su OpenFoodFacts
// Metodo: GET
// Parametri:
//   ?name=latte granarolo    — termine di ricerca (obbligatorio)
//   ?page_size=8             — numero risultati (default 8, max 15)
//
// Chiama la search API di OpenFoodFacts e restituisce una lista
// di prodotti tra cui l'utente può scegliere quello giusto.

require_once __DIR__ . '/../../includes/cors_headers.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/auth_check.php';

setJsonHeaders();
requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Metodo non consentito', 405);
}

$name     = trim($_GET['name'] ?? '');
$pageSize = min(15, max(1, (int) ($_GET['page_size'] ?? 8)));

if (empty($name)) {
    jsonError('Parametro name obbligatorio');
}

if (strlen($name) > 100) {
    jsonError('Termine di ricerca troppo lungo (max 100 caratteri)');
}

// Costruisci URL per la search API di OpenFoodFacts
// Chiede solo i campi che ci servono per ridurre il payload
$fields = 'product_name,product_name_it,brands,image_url,image_front_url,code,categories_tags,nutriments,ingredients_text_it,ingredients_text';

$url = 'https://world.openfoodfacts.org/cgi/search.pl?' . http_build_query([
    'search_terms'  => $name,
    'json'          => '1',
    'page_size'     => $pageSize,
    'page'          => '1',
    'action'        => 'process',
    'fields'        => $fields,
    'sort_by'       => 'unique_scans_n', // ordina per popolarità
    'lc'            => 'it',             // preferenza lingua italiana
]);

$context = stream_context_create([
    'http' => [
        'timeout'    => 12,
        'user_agent' => 'SmartPantry/1.0 (progetto scolastico)',
        'method'     => 'GET'
    ]
]);

$response = @file_get_contents($url, false, $context);

if ($response === false) {
    jsonError('Impossibile contattare OpenFoodFacts. Controlla la connessione.', 503);
}

$data = json_decode($response, true);

if (!isset($data['products'])) {
    jsonError('Risposta non valida da OpenFoodFacts', 502);
}

$rawProducts = $data['products'];

if (empty($rawProducts)) {
    jsonSuccess([
        'products' => [],
        'query'    => $name,
        'message'  => "Nessun prodotto trovato per \"$name\""
    ]);
}

// Normalizza i prodotti restituiti
$products = [];
foreach ($rawProducts as $p) {
    $productName = $p['product_name_it'] ?? $p['product_name'] ?? '';
    if (empty(trim($productName))) {
        continue; // Salta prodotti senza nome
    }

    $barcode  = $p['code']             ?? null;
    $brand    = $p['brands']           ?? null;
    $image    = $p['image_url']        ?? $p['image_front_url'] ?? null;
    $cats     = $p['categories_tags']  ?? [];

    // Prendi la prima categoria normalizzata (rimuovi prefisso lingua)
    $category = null;
    if (!empty($cats)) {
        $firstCat = end($cats); // l'ultima è spesso la più specifica
        $category = preg_replace('/^[a-z]{2}:/', '', $firstCat);
        $category = str_replace('-', ' ', $category);
    }

    $nutriments       = $p['nutriments']      ?? [];
    $calories         = $nutriments['energy-kcal_100g'] ?? null;
    $proteins         = $nutriments['proteins_100g']    ?? null;
    $carbs            = $nutriments['carbohydrates_100g'] ?? null;
    $fats             = $nutriments['fat_100g']          ?? null;
    $fiber            = $nutriments['fiber_100g']        ?? null;
    $salt             = $nutriments['salt_100g']         ?? null;
    $ingredients      = $p['ingredients_text_it'] ?? $p['ingredients_text'] ?? null;

    $products[] = [
        'barcode'           => $barcode,
        'name'              => trim($productName),
        'brand'             => $brand    ? trim($brand)    : null,
        'image_url'         => $image,
        'of_category'       => $category,
        'ingredients'       => $ingredients ? mb_substr($ingredients, 0, 400) : null,
        'calories_per_100g' => $calories !== null ? round((float) $calories, 1) : null,
        'proteins_per_100g' => $proteins !== null ? round((float) $proteins, 1) : null,
        'carbs_per_100g'    => $carbs    !== null ? round((float) $carbs,    1) : null,
        'fats_per_100g'     => $fats     !== null ? round((float) $fats,     1) : null,
        'fiber_per_100g'    => $fiber    !== null ? round((float) $fiber,    1) : null,
        'salt_per_100g'     => $salt     !== null ? round((float) $salt,     1) : null,
    ];
}

// Rimuovi duplicati per nome+marca
$seen     = [];
$unique   = [];
foreach ($products as $prod) {
    $key = strtolower(trim($prod['name'] . '|' . ($prod['brand'] ?? '')));
    if (!isset($seen[$key])) {
        $seen[$key] = true;
        $unique[]   = $prod;
    }
}

jsonSuccess([
    'products' => $unique,
    'query'    => $name,
    'total'    => count($unique)
]);
