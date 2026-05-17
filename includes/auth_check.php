<?php
// Middleware di autenticazione — verifica che l'utente sia loggato
// Includere in tutti gli endpoint che richiedono autenticazione

require_once __DIR__ . '/../config.php';

/**
 * Avvia la sessione se non già avviata e controlla l'autenticazione.
 * Se l'utente non è loggato risponde 401 e termina l'esecuzione.
 */
function requireAuth(): void {
    if (session_status() === PHP_SESSION_NONE) {
        session_name(SESSION_NAME);
        session_start();
    }

    if (empty($_SESSION['user_id'])) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'message' => 'Non autenticato. Effettua il login.'
        ]);
        exit;
    }
}

/**
 * Restituisce l'ID dell'utente corrente dalla sessione.
 * Presuppone che requireAuth() sia già stato chiamato.
 */
function getCurrentUserId(): int {
    return (int) $_SESSION['user_id'];
}

/**
 * Avvia la sessione senza richiedere autenticazione.
 * Usato negli endpoint di login/register.
 */
function startSession(): void {
    if (session_status() === PHP_SESSION_NONE) {
        session_name(SESSION_NAME);
        session_start();
    }
}
