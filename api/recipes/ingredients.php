<?php
// Endpoint recupero ingredienti di una ricetta Spoonacular
// Metodo: GET
// Parametri: ?recipe_id=XXXX

require_once __DIR__ . '/../../includes/cors_headers.php';
require_once __DIR__ . '/../../includes/auth_check.php';
require_once __DIR__ . '/../../includes/spoonacular.php';

setJsonHeaders();
requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Metodo non consentito', 405);
}

$recipeId = (int)($_GET['recipe_id'] ?? 0);
if (!$recipeId) {
    jsonError('ID ricetta non valido');
}

$data = spoonacularGet("/recipes/{$recipeId}/information", [
    'includeNutrition' => 'false',
]);

if (!$data || (isset($data['status']) && $data['status'] === 'failure')) {
    jsonError('Ricetta non trovata o chiavi API esaurite');
}

// Estrai i nomi degli ingredienti
$ingredients = [];
foreach ($data['extendedIngredients'] ?? [] as $ing) {
    $name = trim($ing['name'] ?? '');
    if ($name) {
        $ingredients[] = $name;
    }
}

jsonSuccess([
    'ingredients' => $ingredients,
    'title'       => $data['title'] ?? '',
]);
