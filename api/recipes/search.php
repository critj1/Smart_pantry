<?php
// Endpoint ricerca ricette per nome
// Metodo: GET
// Parametri:
//   ?query=pizza         — termine di ricerca (obbligatorio)
//   ?number=8            — numero risultati (default 8, max 16)
//   ?intolerances=gluten,dairy — intolleranze da escludere (opzionale, virgola-separato)
//
// Flusso:
// 1. Recupera gli ingredienti della dispensa dell'utente
// 2. Chiama Spoonacular complexSearch con query + intolleranze
// 3. Per ogni ricetta calcola ingredienti disponibili e mancanti
// 4. Restituisce risultati ordinati per compatibilità

require_once __DIR__ . '/../../includes/cors_headers.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/auth_check.php';
require_once __DIR__ . '/../../includes/spoonacular.php';

setJsonHeaders();
requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Metodo non consentito', 405);
}

$query  = trim($_GET['query'] ?? '');
$number = min(16, max(1, (int) ($_GET['number'] ?? 8)));

if (empty($query)) {
    jsonError('Parametro query obbligatorio');
}

if (strlen($query) > 100) {
    jsonError('Termine di ricerca troppo lungo (max 100 caratteri)');
}

// Validazione e sanificazione delle intolleranze
$allowedIntolerances = [
    'dairy', 'egg', 'gluten', 'grain', 'peanut',
    'seafood', 'sesame', 'shellfish', 'soy', 'sulfite', 'tree nut', 'wheat',
];
$intolerances = '';
if (!empty($_GET['intolerances'])) {
    $requested = array_map('trim', explode(',', strtolower($_GET['intolerances'])));
    $valid      = array_filter($requested, fn($i) => in_array($i, $allowedIntolerances));
    $intolerances = implode(',', $valid);
}

$pdo    = getDB();
$userId = getCurrentUserId();

// Recupera gli ingredienti della dispensa per il confronto
$stmt = $pdo->prepare('SELECT DISTINCT LOWER(TRIM(name)) AS name FROM pantry_items WHERE user_id = ? AND quantity > 0');
$stmt->execute([$userId]);
$pantryIngredients = $stmt->fetchAll(PDO::FETCH_COLUMN);

// Parametri per Spoonacular complexSearch
$searchParams = [
    'query'                => $query,
    'number'               => $number,
    'instructionsRequired' => 'true',
    'addRecipeInformation' => 'false',
];

// Aggiunge il filtro intolleranze solo se presente
if ($intolerances !== '') {
    $searchParams['intolerances'] = $intolerances;
}

$data = spoonacularGet('/recipes/complexSearch', $searchParams);

if ($data === null || !isset($data['results'])) {
    jsonError('Impossibile contattare Spoonacular. Controlla la connessione o le chiavi API.', 503);
}

$results = $data['results'];

if (empty($results)) {
    jsonSuccess([
        'recipes'      => [],
        'query'        => $query,
        'intolerances' => $intolerances,
        'total_found'  => 0,
        'pantry_items' => $pantryIngredients,
        'message'      => "Nessuna ricetta trovata per \"$query\""
            . ($intolerances ? " con i filtri selezionati" : "")
    ]);
}

// Passo 2: recupera gli ingredienti completi per ogni ricetta (bulk)
$recipeIds = array_column($results, 'id');

$bulkData = spoonacularGet('/recipes/informationBulk', [
    'ids'              => implode(',', $recipeIds),
    'includeNutrition' => 'true',
]);

$detailedRecipes = [];
if (is_array($bulkData)) {
    foreach ($bulkData as $recipe) {
        $detailedRecipes[$recipe['id']] = $recipe;
    }
}

// Passo 3: confronta ingredienti con dispensa
$formattedRecipes = [];

foreach ($results as $recipe) {
    $recipeId   = $recipe['id'];
    $detailed   = $detailedRecipes[$recipeId] ?? null;

    $allIngredients = [];

    if ($detailed && !empty($detailed['extendedIngredients'])) {
        foreach ($detailed['extendedIngredients'] as $ing) {
            $allIngredients[] = [
                'name'   => $ing['name'] ?? $ing['originalName'] ?? '',
                'amount' => $ing['amount'] ?? '',
                'unit'   => $ing['unit'] ?? '',
            ];
        }
    } else {
        foreach ($recipe['usedIngredients'] ?? [] as $ing) {
            $allIngredients[] = ['name' => $ing['name'], 'amount' => $ing['amount'], 'unit' => $ing['unit']];
        }
        foreach ($recipe['missedIngredients'] ?? [] as $ing) {
            $allIngredients[] = ['name' => $ing['name'], 'amount' => $ing['amount'], 'unit' => $ing['unit']];
        }
    }

    // Confronta ogni ingrediente con la dispensa
    $usedIngredients   = [];
    $missedIngredients = [];

    foreach ($allIngredients as $ing) {
        $ingName      = strtolower(trim($ing['name']));
        $isAvailable  = false;

        foreach ($pantryIngredients as $pantryItem) {
            if (
                str_contains($pantryItem, $ingName) ||
                str_contains($ingName, $pantryItem) ||
                similar_text($pantryItem, $ingName) / max(strlen($pantryItem), strlen($ingName), 1) > 0.75
            ) {
                $isAvailable = true;
                break;
            }
        }

        if ($isAvailable) {
            $usedIngredients[] = $ing;
        } else {
            $missedIngredients[] = $ing;
        }
    }

    $totalIngredients = count($allIngredients);
    $compatibility    = $totalIngredients > 0
        ? round(count($usedIngredients) / $totalIngredients * 100)
        : 0;

    // Estrai dati nutrizionali dalla chiamata bulk
    $nutrition = null;
    if (isset($detailed['nutrition']['nutrients'])) {
        $lookup = [];
        foreach ($detailed['nutrition']['nutrients'] as $n) {
            $lookup[$n['name']] = round((float)$n['amount'], 1);
        }
        $nutrition = [
            'calories' => $lookup['Calories']      ?? null,
            'proteins' => $lookup['Protein']       ?? null,
            'carbs'    => $lookup['Carbohydrates'] ?? null,
            'fats'     => $lookup['Fat']           ?? null,
            'fiber'    => $lookup['Fiber']         ?? null,
            'sodium'   => $lookup['Sodium']        ?? null,
            'servings' => $detailed['servings']    ?? null,
        ];
    }

    $formattedRecipes[] = [
        'id'                      => $recipeId,
        'title'                   => $recipe['title'],
        'image'                   => $recipe['image']  ?? null,
        'ready_in_minutes'        => $detailed['readyInMinutes'] ?? null,
        'servings'                => $detailed['servings'] ?? null,
        'used_ingredients'        => $usedIngredients,
        'missed_ingredients'      => $missedIngredients,
        'used_ingredient_count'   => count($usedIngredients),
        'missed_ingredient_count' => count($missedIngredients),
        'compatibility'           => $compatibility,
        'can_make_now'            => count($missedIngredients) === 0,
        'nutrition'               => $nutrition,
    ];
}

// Ordina per compatibilità decrescente
usort($formattedRecipes, fn($a, $b) => $b['compatibility'] <=> $a['compatibility']);

jsonSuccess([
    'recipes'      => $formattedRecipes,
    'query'        => $query,
    'intolerances' => $intolerances,
    'total_found'  => count($formattedRecipes),
    'pantry_items' => $pantryIngredients,
    'can_make_now' => count(array_filter($formattedRecipes, fn($r) => $r['can_make_now']))
]);
