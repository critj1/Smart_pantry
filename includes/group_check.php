<?php
// Helper per la gestione del contesto gruppo
// Dipende da auth_check.php (startSession, jsonError) e db.php (getDB)

/** Restituisce l'ID del gruppo attivo dalla sessione (null = contesto personale) */
function getActiveGroupId(): ?int {
    startSession();
    return isset($_SESSION['active_group_id']) ? (int)$_SESSION['active_group_id'] : null;
}

/** Imposta o rimuove il contesto gruppo nella sessione */
function setActiveGroupId(?int $groupId): void {
    startSession();
    if ($groupId === null) {
        unset($_SESSION['active_group_id']);
    } else {
        $_SESSION['active_group_id'] = $groupId;
    }
}

/** Verifica che l'utente sia membro del gruppo; restituisce la riga group_members o false */
function getGroupMembership(int $userId, int $groupId) {
    $pdo  = getDB();
    $stmt = $pdo->prepare('
        SELECT gm.role, g.name AS group_name
        FROM   group_members gm
        JOIN   user_groups g ON g.id = gm.group_id
        WHERE  gm.group_id = ? AND gm.user_id = ?
    ');
    $stmt->execute([$groupId, $userId]);
    return $stmt->fetch();
}

/** Termina con errore 403 se l'utente non è admin del gruppo */
function requireGroupAdmin(int $userId, int $groupId): void {
    $m = getGroupMembership($userId, $groupId);
    if (!$m || $m['role'] !== 'admin') {
        jsonError('Permesso negato: richiesto ruolo admin', 403);
    }
}

/** Termina con errore 403 se l'utente non è membro del gruppo; restituisce la riga */
function requireGroupMember(int $userId, int $groupId): array {
    $m = getGroupMembership($userId, $groupId);
    if (!$m) {
        jsonError('Non sei membro di questo gruppo', 403);
    }
    return $m;
}

/** Genera un codice invito univoco di 8 caratteri */
function generateUniqueInviteCode(): string {
    $pdo = getDB();
    do {
        $code = strtoupper(substr(bin2hex(random_bytes(5)), 0, 8));
        $stmt = $pdo->prepare('SELECT id FROM user_groups WHERE invite_code = ?');
        $stmt->execute([$code]);
    } while ($stmt->fetch());
    return $code;
}
