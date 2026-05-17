<?php
// Header comuni per tutte le risposte API
// Includere come PRIMO file in ogni endpoint PHP

/**
 * Imposta gli header JSON e gestisce le richieste OPTIONS (preflight CORS).
 * In ambiente XAMPP locale non ci sono problemi CORS tra frontend e backend
 * poiché servono dalla stessa origine; i header sono comunque corretti.
 */
function setJsonHeaders(): void {
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');

    // Gestione preflight CORS (utile per sviluppo con porte diverse)
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Access-Control-Allow-Credentials: true');

    // Risposta vuota immediata per richieste preflight
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

/**
 * Legge il corpo della richiesta come JSON e lo decodifica.
 * Restituisce un array o null se il parsing fallisce.
 */
function getJsonBody(): ?array {
    $raw = file_get_contents('php://input');
    if (empty($raw)) {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : null;
}

/**
 * Invia una risposta JSON di successo con dati opzionali.
 */
function jsonSuccess(array $data = [], int $code = 200): void {
    http_response_code($code);
    echo json_encode(array_merge(['success' => true], $data));
    exit;
}

/**
 * Invia una risposta JSON di errore con messaggio.
 */
function jsonError(string $message, int $code = 400): void {
    http_response_code($code);
    echo json_encode(['success' => false, 'message' => $message]);
    exit;
}
