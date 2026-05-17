<?php
// Connessione al database tramite PDO
// Includere questo file in ogni endpoint che necessita del database

require_once __DIR__ . '/../config.php';

/**
 * Restituisce una connessione PDO al database.
 * Lancia un'eccezione in caso di errore di connessione.
 */
function getDB(): PDO {
    static $pdo = null;

    // Riusa la connessione esistente (pattern singleton)
    if ($pdo !== null) {
        return $pdo;
    }

    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';

    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];

    try {
        $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
    } catch (PDOException $e) {
        // Rispondi con errore JSON invece di esporre il messaggio PHP
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Errore di connessione al database'
        ]);
        exit;
    }

    return $pdo;
}
