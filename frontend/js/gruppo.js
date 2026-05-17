/**
 * gruppo.js — Gestione gruppi condivisi
 */

let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    currentUser = await requireLogin();
    if (!currentUser) return;

    const usernameEl = document.getElementById('sidebar-username');
    if (usernameEl) usernameEl.textContent = currentUser.username;
    const avatarEl = document.getElementById('sidebar-avatar');
    if (avatarEl) avatarEl.textContent = currentUser.username[0].toUpperCase();

    initSidebar();
    initLogout();
    initTabs();
    initForms();
    renderActiveContextBar();
    await loadGroups();
});

// ============================================================
// TABS
// ============================================================

function initTabs() {
    document.querySelectorAll('.gruppo-tab').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
}

function switchTab(tabId) {
    document.querySelectorAll('.gruppo-tab').forEach(b =>
        b.classList.toggle('active', b.dataset.tab === tabId)
    );
    document.getElementById('section-my-groups').classList.toggle('hidden', tabId !== 'my-groups');
    document.getElementById('section-create').classList.toggle('hidden',    tabId !== 'create');
    document.getElementById('section-join').classList.toggle('hidden',      tabId !== 'join');

    if (tabId === 'create') {
        setTimeout(() => document.getElementById('new-group-name')?.focus(), 80);
    }
    if (tabId === 'join') {
        setTimeout(() => document.getElementById('join-code')?.focus(), 80);
    }
}

// ============================================================
// CARICAMENTO GRUPPI
// ============================================================

async function loadGroups() {
    document.getElementById('groups-loader').style.display = 'flex';
    document.getElementById('groups-list').style.display   = 'none';

    try {
        const res = await api.get('/groups/my_groups.php');
        document.getElementById('groups-loader').style.display = 'none';
        document.getElementById('groups-list').style.display   = 'block';

        if (res.success) {
            renderGroups(res.groups);
        } else {
            document.getElementById('groups-list').innerHTML =
                `<div class="alert alert-warning">${escapeHtml(res.message || 'Errore nel caricamento')}</div>`;
        }
    } catch {
        document.getElementById('groups-loader').style.display = 'none';
        document.getElementById('groups-list').style.display   = 'block';
        document.getElementById('groups-list').innerHTML =
            '<div class="alert alert-warning">Errore di connessione. Ricarica la pagina.</div>';
    }
}

function renderGroups(groups) {
    const container = document.getElementById('groups-list');

    if (!groups.length) {
        container.innerHTML = `
            <div class="no-groups-state">
                <div class="big-icon">👥</div>
                <p>Non fai ancora parte di nessun gruppo.</p>
                <div style="display:flex; gap:0.75rem; justify-content:center; flex-wrap:wrap;">
                    <button class="btn btn-primary" onclick="switchTab('create')">➕ Crea un gruppo</button>
                    <button class="btn btn-outline"  onclick="switchTab('join')">🔑 Entra con codice</button>
                </div>
            </div>`;
        return;
    }

    container.innerHTML = groups.map(g => buildGroupCard(g)).join('');
}

function buildGroupCard(g) {
    const ctx      = currentUser.active_context;
    const isActive = ctx && ctx.type === 'group' && ctx.group_id === g.id;
    const isAdmin  = g.role === 'admin';

    const inviteHtml = isAdmin && g.invite_code ? `
        <div class="invite-code-box">
            <span class="invite-code-label">Codice invito:</span>
            <span class="invite-code" id="code-${g.id}">${escapeHtml(g.invite_code)}</span>
            <div class="invite-code-actions">
                <button class="btn btn-outline btn-sm" onclick="copyCode(document.getElementById('code-${g.id}').textContent.trim())" title="Copia codice">
                    📋 Copia
                </button>
                <button class="btn btn-ghost btn-sm" onclick="regenerateCode(${g.id})" title="Rigenera codice">
                    🔄
                </button>
            </div>
        </div>` : '';

    const switchBtn = isActive
        ? `<button class="btn btn-outline" onclick="switchContext('personal')">↩ Torna al personale</button>`
        : `<button class="btn btn-primary" onclick="switchContext('group', ${g.id})">✓ Attiva contesto</button>`;

    const activeBadge = isActive
        ? `<span style="display:inline-block; margin-top:0.3rem; font-size:0.8rem; color:var(--primary); font-weight:700;">● Contesto attivo</span>`
        : '';

    return `
        <div class="group-card" id="group-card-${g.id}">
            <div class="group-card-header">
                <div>
                    <div class="group-name">${escapeHtml(g.name)}</div>
                    ${activeBadge}
                </div>
                <span class="role-badge ${g.role}">${g.role === 'admin' ? '👑 Admin' : '👤 Membro'}</span>
            </div>

            <div class="group-meta">
                <span>👥 ${g.member_count} membro${g.member_count !== 1 ? 'i' : ''}</span>
                <span>📅 Creato il ${formatDate(g.created_at?.split(' ')[0] || '')}</span>
            </div>

            ${inviteHtml}

            <!-- Lista membri (espandibile) -->
            <div id="members-${g.id}" class="hidden"></div>

            <div class="group-actions">
                ${switchBtn}
                <button class="btn btn-outline" onclick="toggleMembers(${g.id})">
                    👥 Membri
                </button>
                <button class="btn btn-ghost" style="color:var(--danger);" onclick="confirmLeave(${g.id}, '${escapeHtml(g.name)}')">
                    Abbandona
                </button>
            </div>
        </div>`;
}

// ============================================================
// AZIONI GRUPPO
// ============================================================

async function toggleMembers(groupId) {
    const el = document.getElementById(`members-${groupId}`);
    if (!el.classList.contains('hidden')) {
        el.classList.add('hidden');
        return;
    }

    el.classList.remove('hidden');
    el.innerHTML = '<div class="loading" style="padding:1rem;"><div class="spinner"></div><span>Caricamento…</span></div>';

    try {
        const res = await api.get(`/groups/info.php?group_id=${groupId}`);
        if (res.success) {
            renderMembersList(el, res.members, res.my_role, groupId);
        } else {
            el.innerHTML = `<div class="alert alert-warning">${escapeHtml(res.message || 'Errore')}</div>`;
        }
    } catch {
        el.innerHTML = '<div class="alert alert-warning">Errore nel caricamento membri.</div>';
    }
}

function renderMembersList(container, members, myRole, groupId) {
    const rows = members.map(m => {
        const isMe = m.id === currentUser.id;
        const adminActions = (myRole === 'admin' && !isMe) ? `
            <div class="member-actions">
                ${m.role === 'member'
                    ? `<button class="btn btn-ghost btn-sm" onclick="updateRole(${groupId}, ${m.id}, 'admin')" title="Promuovi ad admin">👑</button>`
                    : `<button class="btn btn-ghost btn-sm" onclick="updateRole(${groupId}, ${m.id}, 'member')" title="Declassa a membro">⬇</button>`
                }
                <button class="btn btn-ghost btn-sm" style="color:var(--danger);"
                    onclick="removeMember(${groupId}, ${m.id}, '${escapeHtml(m.username)}')" title="Rimuovi">✕</button>
            </div>` : '';

        return `
            <div class="member-row">
                <div class="member-avatar">${escapeHtml(m.username[0].toUpperCase())}</div>
                <span class="member-name">
                    ${escapeHtml(m.username)}
                    ${isMe ? '<span style="font-size:0.8rem; color:var(--text-muted); font-weight:400;"> (tu)</span>' : ''}
                </span>
                <span class="role-badge ${m.role}">${m.role === 'admin' ? '👑 Admin' : '👤 Membro'}</span>
                ${adminActions}
            </div>`;
    }).join('');

    container.innerHTML = `
        <div class="members-section">
            <div class="members-section-title">Membri del gruppo</div>
            ${rows}
        </div>`;
}

async function switchContext(type, groupId = null) {
    const body = type === 'personal' ? { context: 'personal' } : { context: 'group', group_id: groupId };
    try {
        const res = await api.post('/groups/switch.php', body);
        if (res.success) {
            window.location.reload();
        } else {
            showToast(res.message || 'Errore nel cambio contesto', 'error');
        }
    } catch {
        showToast('Errore di connessione', 'error');
    }
}

async function regenerateCode(groupId) {
    if (!confirm('Vuoi rigenerare il codice invito? Il vecchio codice non sarà più valido.')) return;
    try {
        const res = await api.post('/groups/regenerate_code.php', { group_id: groupId });
        if (res.success) {
            const el = document.getElementById(`code-${groupId}`);
            if (el) el.textContent = res.invite_code;
            showToast('Nuovo codice invito generato', 'success');
        } else {
            showToast(res.message || 'Errore', 'error');
        }
    } catch {
        showToast('Errore di connessione', 'error');
    }
}

function copyCode(code) {
    navigator.clipboard.writeText(code).then(() => {
        showToast('Codice copiato negli appunti!', 'success');
    }).catch(() => {
        showToast('Codice: ' + code, 'info', 6000);
    });
}

async function updateRole(groupId, userId, role) {
    try {
        const res = await api.post('/groups/update_member.php', { group_id: groupId, user_id: userId, role });
        if (res.success) {
            showToast('Ruolo aggiornato', 'success');
            const el = document.getElementById(`members-${groupId}`);
            el.classList.add('hidden');
            await toggleMembers(groupId);
        } else {
            showToast(res.message || 'Errore', 'error');
        }
    } catch {
        showToast('Errore di connessione', 'error');
    }
}

async function removeMember(groupId, userId, username) {
    if (!confirm(`Rimuovere ${username} dal gruppo?`)) return;
    try {
        const res = await api.post('/groups/remove_member.php', { group_id: groupId, user_id: userId });
        if (res.success) {
            showToast('Membro rimosso', 'success');
            await loadGroups();
        } else {
            showToast(res.message || 'Errore', 'error');
        }
    } catch {
        showToast('Errore di connessione', 'error');
    }
}

async function confirmLeave(groupId, groupName) {
    if (!confirm(`Sei sicuro di voler abbandonare il gruppo "${groupName}"?`)) return;
    try {
        const res = await api.post('/groups/leave.php', { group_id: groupId });
        if (res.success) {
            showToast(res.message, 'success');
            await loadGroups();
            renderActiveContextBar();
        } else {
            showToast(res.message || 'Errore', 'error');
        }
    } catch {
        showToast('Errore di connessione', 'error');
    }
}

// ============================================================
// FORM: CREA + ENTRA
// ============================================================

function initForms() {
    document.getElementById('btn-create-group')?.addEventListener('click', handleCreate);
    document.getElementById('new-group-name')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') handleCreate();
    });

    document.getElementById('btn-join-group')?.addEventListener('click', handleJoin);
    document.getElementById('join-code')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') handleJoin();
    });
    document.getElementById('join-code')?.addEventListener('input', e => {
        e.target.value = e.target.value.toUpperCase();
    });
}

async function handleCreate() {
    const input = document.getElementById('new-group-name');
    const name  = input?.value?.trim();
    if (!name) { input?.focus(); showToast('Inserisci un nome per il gruppo', 'warning'); return; }

    const btn = document.getElementById('btn-create-group');
    btn.disabled = true; btn.textContent = 'Creazione…';

    try {
        const res = await api.post('/groups/create.php', { name });
        if (res.success) {
            showToast(res.message, 'success');
            input.value = '';
            switchTab('my-groups');
            await loadGroups();
        } else {
            showToast(res.message || 'Errore nella creazione', 'error');
        }
    } catch {
        showToast('Errore di connessione', 'error');
    } finally {
        btn.disabled = false; btn.textContent = 'Crea gruppo';
    }
}

async function handleJoin() {
    const input = document.getElementById('join-code');
    const code  = input?.value?.trim().toUpperCase();
    if (!code) { input?.focus(); showToast('Inserisci il codice invito', 'warning'); return; }

    const btn = document.getElementById('btn-join-group');
    btn.disabled = true; btn.textContent = 'Entrata…';

    try {
        const res = await api.post('/groups/join.php', { invite_code: code });
        if (res.success) {
            showToast(res.message, 'success');
            input.value = '';
            switchTab('my-groups');
            await loadGroups();
        } else {
            showToast(res.message || 'Errore', 'error');
        }
    } catch {
        showToast('Errore di connessione', 'error');
    } finally {
        btn.disabled = false; btn.textContent = 'Entra nel gruppo';
    }
}

// ============================================================
// UTILITY
// ============================================================

function renderActiveContextBar() {
    const ctx = currentUser?.active_context;
    const bar = document.getElementById('active-context-bar');
    if (!bar) return;

    if (ctx && ctx.type === 'group') {
        bar.innerHTML = `
            <div class="context-bar">
                <span>Stai visualizzando: <strong>👥 ${escapeHtml(ctx.group_name)}</strong></span>
                <button class="btn btn-outline btn-sm" onclick="switchContext('personal')">↩ Torna al personale</button>
            </div>`;
    } else {
        bar.innerHTML = `
            <div class="context-bar">
                <span>Stai visualizzando: <strong>👤 Dispensa personale</strong></span>
            </div>`;
    }
}

function initLogout() {
    document.getElementById('btn-logout')?.addEventListener('click', async () => {
        await api.post('/auth/logout.php');
        window.location.href = 'index.html';
    });
}
