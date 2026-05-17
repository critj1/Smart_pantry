<?php
// Cambia il ruolo di un membro (solo admin)
// Metodo: POST
// Body JSON: { "group_id": 3, "user_id": 7, "role": "admin"|"member" }

require_once __DIR__ . '/../../includes/cors_headers.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/auth_check.php';
require_once __DIR__ . '/../../includes/group_check.php';

setJsonHeaders();
requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('Metodo non consentito', 405);
}

$body         = getJsonBody();
$groupId      = (int)($body['group_id'] ?? 0);
$targetUserId = (int)($body['user_id']  ?? 0);
$role         = trim($body['role']       ?? '');

if (!$groupId || !$targetUserId) jsonError('Parametri mancanti');
if (!in_array($role, ['admin', 'member'], true)) jsonError('Ruolo non valido');

$adminUserId = getCurrentUserId();
if ($adminUserId === $targetUserId) jsonError('Non puoi modificare il tuo stesso ruolo');

requireGroupAdmin($adminUserId, $groupId);

$pdo = getDB();

// Verifica che il target sia membro del gruppo
$stmtCheck = $pdo->prepare('SELECT role FROM group_members WHERE group_id = ? AND user_id = ?');
$stmtCheck->execute([$groupId, $targetUserId]);
$targetMember = $stmtCheck->fetch();
if (!$targetMember) jsonError('Utente non trovato nel gruppo', 404);

// Non declassare l'unico admin
if ($role === 'member' && $targetMember['role'] === 'admin') {
    $stmtAdmins = $pdo->prepare("SELECT COUNT(*) FROM group_members WHERE group_id = ? AND role = 'admin'");
    $stmtAdmins->execute([$groupId]);
    if ((int)$stmtAdmins->fetchColumn() <= 1) {
        jsonError('Non puoi declassare l\'unico admin del gruppo');
    }
}

$pdo->prepare('UPDATE group_members SET role = ? WHERE group_id = ? AND user_id = ?')
    ->execute([$role, $groupId, $targetUserId]);

jsonSuccess(['message' => 'Ruolo aggiornato']);
