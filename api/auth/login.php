<?php
// Endpoint login utente
// Metodo: POST
// Body JSON: { "email": "...", "password": "..." }
// Accetta anche "username" al posto di "email"

require_once __DIR__ . '/../../includes/cors_headers.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/auth_check.php';

setJsonHeaders();
startSession();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('Metodo non consentito', 405);
}

$body = getJsonBody();
if ($body === null) {
    jsonError('JSON non valido nel corpo della richiesta');
}

// Accetta sia email che username come identificatore
$identifier = trim($body['email'] ?? $body['username'] ?? '');
$password   = $body['password'] ?? '';

if (empty($identifier) || empty($password)) {
    jsonError('Email/username e password sono obbligatori');
}

$pdo = getDB();

// Cerca l'utente per email o username
$stmt = $pdo->prepare('SELECT id, username, email, password_hash FROM users WHERE email = ? OR username = ?');
$stmt->execute([$identifier, $identifier]);
$user = $stmt->fetch();

// Verifica credenziali (timing-safe tramite password_verify)
if (!$user || !password_verify($password, $user['password_hash'])) {
    jsonError('Credenziali non valide', 401);
}

// Salva i dati utente nella sessione
$_SESSION['user_id']  = $user['id'];
$_SESSION['username'] = $user['username'];

jsonSuccess([
    'message' => 'Login effettuato con successo',
    'user' => [
        'id'       => $user['id'],
        'username' => $user['username'],
        'email'    => $user['email']
    ]
]);
