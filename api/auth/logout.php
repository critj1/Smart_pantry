<?php
// Endpoint logout
// Metodo: POST
// Distrugge la sessione corrente

require_once __DIR__ . '/../../includes/cors_headers.php';
require_once __DIR__ . '/../../includes/auth_check.php';

setJsonHeaders();
startSession();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('Metodo non consentito', 405);
}

// Svuota i dati di sessione
$_SESSION = [];

// Elimina il cookie di sessione dal browser
if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    setcookie(
        session_name(),
        '',
        time() - 42000,
        $params['path'],
        $params['domain'],
        $params['secure'],
        $params['httponly']
    );
}

// Distrugge la sessione lato server
session_destroy();

jsonSuccess(['message' => 'Logout effettuato con successo']);
