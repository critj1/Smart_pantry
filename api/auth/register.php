<?php
// Endpoint registrazione utente
// Metodo: POST
// Body JSON: { "username": "...", "email": "...", "password": "..." }

require_once __DIR__ . '/../../includes/cors_headers.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/auth_check.php';

setJsonHeaders();
startSession();

// Solo richieste POST sono accettate
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('Metodo non consentito', 405);
}

// Leggi e valida il body JSON
$body = getJsonBody();
if ($body === null) {
    jsonError('JSON non valido nel corpo della richiesta');
}

$username = trim($body['username'] ?? '');
$email    = trim($body['email']    ?? '');
$password = $body['password']      ?? '';

// Validazione campi obbligatori
if (empty($username) || empty($email) || empty($password)) {
    jsonError('Username, email e password sono obbligatori');
}

// Validazione formato email
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    jsonError('Formato email non valido');
}

// Validazione lunghezza username
if (strlen($username) < 3 || strlen($username) > 50) {
    jsonError('Username deve essere tra 3 e 50 caratteri');
}

// Validazione lunghezza password
if (strlen($password) < 6) {
    jsonError('La password deve essere di almeno 6 caratteri');
}

$pdo = getDB();

// Controlla se username o email sono già in uso
$stmt = $pdo->prepare('SELECT id FROM users WHERE email = ? OR username = ?');
$stmt->execute([$email, $username]);
$existing = $stmt->fetch();

if ($existing) {
    // Controlla quale campo è duplicato per messaggio preciso
    $stmtEmail = $pdo->prepare('SELECT id FROM users WHERE email = ?');
    $stmtEmail->execute([$email]);
    if ($stmtEmail->fetch()) {
        jsonError('Email già registrata');
    }
    jsonError('Username già in uso');
}

// Crea hash sicuro della password
$passwordHash = password_hash($password, PASSWORD_BCRYPT);

// Inserisce il nuovo utente
$stmt = $pdo->prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)');
$stmt->execute([$username, $email, $passwordHash]);
$newUserId = (int) $pdo->lastInsertId();

// Avvia la sessione automaticamente dopo la registrazione
$_SESSION['user_id']  = $newUserId;
$_SESSION['username'] = $username;

jsonSuccess([
    'message' => 'Registrazione completata con successo',
    'user' => [
        'id'       => $newUserId,
        'username' => $username,
        'email'    => $email
    ]
], 201);
