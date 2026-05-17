<?php
// Endpoint suggerimento ricette
// Metodo: GET
// Parametri opzionali:
//   ?pantry_only=1   — usa solo ingredienti presenti in dispensa
//   ?number=10       — numero di ricette (default 10, max 20)
//
// Flusso:
// 1. Recupera i prodotti della dispensa dell'utente
// 2. Chiama Spoonacular findByIngredients
// 3. Per ogni ricetta recupera gli ingredienti completi
// 4. Calcola ingredienti disponibili e mancanti
// 5. Ordina per ingredienti disponibili (prima quelli fattibili)

require_once __DIR__ . '/../../includes/cors_headers.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/auth_check.php';
require_once __DIR__ . '/../../includes/spoonacular.php';

setJsonHeaders();
requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Metodo non consentito', 405);
}

$pdo        = getDB();
$userId     = getCurrentUserId();
$pantryOnly = !empty($_GET['pantry_only']);
$number     = min(20, max(1, (int) ($_GET['number'] ?? 10)));

// Passo 1: recupera i nomi dei prodotti della dispensa
$stmt = $pdo->prepare('SELECT DISTINCT name FROM pantry_items WHERE user_id = ? AND quantity > 0');
$stmt->execute([$userId]);
$pantryItems = $stmt->fetchAll(PDO::FETCH_COLUMN);

if (empty($pantryItems)) {
    jsonError('La dispensa è vuota. Aggiungi prodotti per ricevere suggerimenti.', 400);
}

// Normalizza i nomi per l'API (rimuovi spazi extra, converti in minuscolo)
$ingredients = array_map('strtolower', $pantryItems);
$ingredients = array_map('trim', $ingredients);

// Passo 2: chiama Spoonacular findByIngredients (con fallback automatico tra le chiavi)
$ranking = $pantryOnly ? 2 : 1; // 2 = massimizza ingredienti usati, 1 = minimizza ingredienti mancanti

$recipes = spoonacularGet('/recipes/findByIngredients', [
    'ingredients'  => implode(',', $ingredients),
    'number'       => $number,
    'ranking'      => $ranking,
    'ignorePantry' => 'false',
]);

if ($recipes === null) {
    jsonError('Impossibile contattare Spoonacular. Controlla la connessione o le chiavi API.', 503);
}

if (empty($recipes)) {
    jsonSuccess([
        'recipes'          => [],
        'pantry_items'     => $pantryItems,
        'message'          => 'Nessuna ricetta trovata con questi ingredienti'
    ]);
}

// Passo 3: recupera dettagli completi (tempo, porzioni, nutrizione)
$recipeIds   = array_column($recipes, 'id');
$detailsData = spoonacularGet('/recipes/informationBulk', [
    'ids'              => implode(',', $recipeIds),
    'includeNutrition' => 'true',
]);

$details = [];
if (is_array($detailsData)) {
    foreach ($detailsData as $d) {
        $details[$d['id']] = $d;
    }
}

// Passo 4: costruisci le ricette con ingredienti disponibili/mancanti
$pantryNormalized = array_map('strtolower', array_map('trim', $pantryItems));

$formattedRecipes = [];

foreach ($recipes as $recipe) {
    $detail = $details[$recipe['id']] ?? null;

    // Ingredienti usati dalla dispensa
    $usedIngredients = [];
    foreach ($recipe['usedIngredients'] ?? [] as $ing) {
        $usedIngredients[] = [
            'name'   => $ing['name'],
            'amount' => $ing['amount'],
            'unit'   => $ing['unit'],
        ];
    }

    // Ingredienti mancanti
    $missedIngredients = [];
    foreach ($recipe['missedIngredients'] ?? [] as $ing) {
        $missedIngredients[] = [
            'name'   => $ing['name'],
            'amount' => $ing['amount'],
            'unit'   => $ing['unit'],
        ];
    }

    // Calcola percentuale di compatibilità
    $totalIngredients = count($usedIngredients) + count($missedIngredients);
    $compatibility    = $totalIngredients > 0
        ? round(count($usedIngredients) / $totalIngredients * 100)
        : 0;

    // Estrai dati nutrizionali
    $nutrition = null;
    if (isset($detail['nutrition']['nutrients'])) {
        $lookup = [];
        foreach ($detail['nutrition']['nutrients'] as $n) {
            $lookup[$n['name']] = round((float)$n['amount'], 1);
        }
        $nutrition = [
            'calories' => $lookup['Calories']      ?? null,
            'proteins' => $lookup['Protein']       ?? null,
            'carbs'    => $lookup['Carbohydrates'] ?? null,
            'fats'     => $lookup['Fat']           ?? null,
            'fiber'    => $lookup['Fiber']         ?? null,
            'sodium'   => $lookup['Sodium']        ?? null,
            'servings' => $detail['servings']      ?? null,
        ];
    }

    $formattedRecipes[] = [
        'id'                      => $recipe['id'],
        'title'                   => $recipe['title'],
        'image'                   => $recipe['image']                ?? null,
        'ready_in_minutes'        => $detail['readyInMinutes']       ?? null,
        'servings'                => $detail['servings']             ?? null,
        'used_ingredient_count'   => (int) ($recipe['usedIngredientCount']   ?? 0),
        'missed_ingredient_count' => (int) ($recipe['missedIngredientCount'] ?? 0),
        'used_ingredients'        => $usedIngredients,
        'missed_ingredients'      => $missedIngredients,
        'compatibility'           => $compatibility,
        'can_make_now'            => count($missedIngredients) === 0,
        'nutrition'               => $nutrition,
    ];
}

// Passo 5: ordina per fattibilità e compatibilità
// Prima quelle realizzabili subito, poi per compatibilità decrescente
usort($formattedRecipes, function ($a, $b) {
    // Prima le ricette fattibili subito
    if ($a['can_make_now'] !== $b['can_make_now']) {
        return $b['can_make_now'] <=> $a['can_make_now'];
    }
    // Poi per compatibilità decrescente
    return $b['compatibility'] <=> $a['compatibility'];
});

jsonSuccess([
    'recipes'       => $formattedRecipes,
    'pantry_items'  => $pantryItems,
    'total_found'   => count($formattedRecipes),
    'can_make_now'  => count(array_filter($formattedRecipes, fn($r) => $r['can_make_now']))
]);
