<?php
// Helper per le chiamate API Spoonacular
// Prova automaticamente la seconda chiave se la prima ha raggiunto il limite giornaliero

/**
 * Esegue una chiamata GET a Spoonacular con fallback automatico tra le chiavi API.
 *
 * @param string $path    Percorso endpoint, es. '/recipes/findByIngredients'
 * @param array  $params  Parametri query (senza apiKey)
 * @return array|null     Risposta decodificata, o null se tutte le chiavi falliscono
 */
function spoonacularGet(string $path, array $params = []): ?array {
    // Lista delle chiavi disponibili (la seconda è opzionale)
    $keys = [SPOONACULAR_API_KEY];
    if (defined('SPOONACULAR_API_KEY_2') && SPOONACULAR_API_KEY_2) {
        $keys[] = SPOONACULAR_API_KEY_2;
    }

    $ctx = stream_context_create([
        'http' => [
            'timeout'    => 15,
            'user_agent' => 'SmartPantry/1.0',
            'method'     => 'GET',
        ]
    ]);

    foreach ($keys as $key) {
        $params['apiKey'] = $key;
        $url = SPOONACULAR_URL . $path . '?' . http_build_query($params);

        $response = @file_get_contents($url, false, $ctx);
        if ($response === false) continue;

        $data = json_decode($response, true);
        if (!is_array($data)) continue;

        // Limite giornaliero raggiunto (402) → prova la chiave successiva
        if (isset($data['code']) && (int)$data['code'] === 402) continue;
        if (isset($data['status']) && $data['status'] === 'failure' &&
            str_contains(strtolower($data['message'] ?? ''), 'limit')) continue;

        return $data;
    }

    return null; // Tutte le chiavi esaurite o errore di rete
}
