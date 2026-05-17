/**
 * pantry.js — Gestione dispensa: due viste, categorie, modal modifica
 */

let allItems      = [];    // Cache locale prodotti
let editingItem   = null;  // Prodotto in modifica
let currentFilter = 'all'; // Filtro scadenza
let currentView   = 'expiry'; // 'expiry' | 'category'
let readOnly      = false;  // true se membro (non admin) in contesto gruppo

document.addEventListener('DOMContentLoaded', async () => {
    const user = await requireLogin();
    if (!user) return;

    document.getElementById('sidebar-username').textContent = user.username;
    document.getElementById('sidebar-avatar').textContent   = user.username[0].toUpperCase();

    readOnly = user.active_context?.type === 'group' && user.active_context?.role === 'member';

    initSidebar();
    initLogout();
    initViewToggle();
    initSearchBar();
    initFilters();
    initEditForm();
    populateCategorySelects();

    if (readOnly) {
        document.querySelector('.topbar-end .btn-primary')?.remove();
        const banner = document.createElement('div');
        banner.className = 'alert alert-info';
        banner.style.cssText = 'margin-bottom:1rem; font-size:0.88rem;';
        banner.innerHTML = '👁️ Stai visualizzando la dispensa del gruppo come <strong>membro</strong>. Solo gli admin possono aggiungere o modificare prodotti.';
        document.querySelector('.page-content')?.prepend(banner);
    }

    await loadPantry();
});

// ============================================================
// CARICAMENTO DATI
// ============================================================

async function loadPantry() {
    showLoader(true);
    try {
        const res = await api.get('/pantry/list.php');
        if (res.success) {
            allItems = res.items;
            updateStats(res.stats);
            renderCurrentView();
        } else {
            showToast(res.message || 'Errore nel caricamento', 'error');
        }
    } catch {
        showToast('Errore di connessione', 'error');
    } finally {
        showLoader(false);
    }
}

function updateStats(stats) {
    setEl('stat-total',    stats.total    ?? 0);
    setEl('stat-expiring', stats.expiring ?? 0);
    setEl('stat-expired',  stats.expired  ?? 0);
}

// ============================================================
// VISTE: PER SCADENZA / PER CATEGORIA
// ============================================================

function initViewToggle() {
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentView = btn.dataset.view;

            const filters = document.getElementById('expiry-filters');
            if (filters) filters.style.display = currentView === 'expiry' ? 'flex' : 'none';

            renderCurrentView();
        });
    });
}

function renderCurrentView() {
    if (currentView === 'category') {
        renderByCategory();
    } else {
        renderByExpiry();
    }
}

// ---- Vista per scadenza ----

function renderByExpiry() {
    document.getElementById('pantry-grid').style.display   = 'grid';
    document.getElementById('category-view').style.display = 'none';

    let filtered = applyFilterAndSearch(allItems);

    const grid = document.getElementById('pantry-grid');
    if (!grid) return;

    if (filtered.length === 0) {
        grid.innerHTML = buildEmptyState();
        return;
    }

    grid.innerHTML = filtered.map(buildProductCard).join('');
    attachCardEvents(grid);
}

// ---- Vista per categoria ----

function renderByCategory() {
    document.getElementById('pantry-grid').style.display   = 'none';
    document.getElementById('category-view').style.display = 'block';

    const catView = document.getElementById('category-view');
    let items     = applySearchOnly(allItems);

    if (items.length === 0) {
        catView.innerHTML = buildEmptyState();
        return;
    }

    const groups = {};
    for (const item of items) {
        const key = item.category || 'altro';
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
    }

    const order = ['latticini','verdura','frutta','carne','pesce','cereali','surgelati','bevande','condimenti','snack','conserve','altro'];
    const sortedKeys = [
        ...order.filter(k => groups[k]),
        ...Object.keys(groups).filter(k => !order.includes(k))
    ];

    catView.innerHTML = sortedKeys.map(key => {
        const cat   = getCategoryData(key);
        const items = groups[key];
        return `
            <div class="category-section">
                <div class="category-header cat-${key}"
                     style="background:${cat.bg}; color:${cat.text}; border-left-color:${cat.text};">
                    <span class="cat-icon">${cat.icon}</span>
                    <span>${cat.label}</span>
                    <span class="cat-count">${items.length} prodott${items.length === 1 ? 'o' : 'i'}</span>
                </div>
                <div class="pantry-grid">
                    ${items.map(buildProductCard).join('')}
                </div>
            </div>`;
    }).join('');

    attachCardEvents(catView);
}

// ---- Filtro + ricerca ----

function applyFilterAndSearch(items) {
    let filtered = applySearchOnly(items);

    if (currentFilter === 'expiring') filtered = filtered.filter(i => i.expiry_status === 'expiring');
    else if (currentFilter === 'expired') filtered = filtered.filter(i => i.expiry_status === 'expired');
    else if (currentFilter === 'ok') filtered = filtered.filter(i => i.expiry_status === 'ok');

    return filtered;
}

function applySearchOnly(items) {
    const q = document.getElementById('search-input')?.value?.toLowerCase() ?? '';
    if (!q) return items;
    return items.filter(i =>
        i.name.toLowerCase().includes(q) ||
        (i.brand ?? '').toLowerCase().includes(q) ||
        (i.category ?? '').toLowerCase().includes(q)
    );
}

// ============================================================
// CARD PRODOTTO
// ============================================================

function buildProductCard(item) {
    const expiryBadge = getExpiryBadge(item.expiry_status, item.days_to_expiry, item.expiry_date);
    const catBadge    = buildCategoryBadge(item.category);
    const cat         = getCategoryData(item.category || 'altro');

    const cardClass = item.expiry_status === 'expired'  ? 'product-card expired'
                    : item.expiry_status === 'expiring' ? 'product-card expiring'
                    : 'product-card';

    const imageHtml = item.image_url
        ? `<img class="product-image" src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.name)}"
               loading="lazy" onerror="this.parentNode.innerHTML='<div class=\\'product-image-placeholder\\' style=\\'background:${cat.bg}\\'>'+\\'${cat.icon}\\'+'</div>'">`
        : `<div class="product-image-placeholder" style="background:${cat.bg}; font-size:3rem;">${cat.icon}</div>`;

    const nutritionHtml = buildNutritionPanel(item);

    return `
        <div class="${cardClass}">
            <div class="product-card-stripe" style="background:${cat.text};"></div>
            ${imageHtml}
            <div class="product-body">
                <div class="product-name">${escapeHtml(item.name)}</div>
                ${item.brand ? `<div class="product-brand">${escapeHtml(item.brand)}</div>` : ''}
                <div class="product-meta">
                    <span class="product-qty">${item.quantity} ${escapeHtml(item.unit)}</span>
                    ${catBadge}
                    ${item.location ? `<span class="badge badge-blue">${escapeHtml(item.location)}</span>` : ''}
                    ${expiryBadge}
                </div>
                ${nutritionHtml}
                ${!readOnly ? `
                <div class="product-actions">
                    <button class="btn btn-outline btn-sm btn-edit" data-id="${item.id}">✏️ Modifica</button>
                    <button class="btn btn-danger btn-sm btn-delete" data-id="${item.id}" data-name="${escapeHtml(item.name)}">🗑️</button>
                </div>` : ''}
            </div>
        </div>`;
}

function attachCardEvents(container) {
    container.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', () => openEditModal(parseInt(btn.dataset.id)));
    });
    container.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', () => confirmDelete(parseInt(btn.dataset.id), btn.dataset.name));
    });
}

function buildEmptyState() {
    return `<div class="empty-state" style="grid-column:1/-1;">
                <div class="empty-icon">📦</div>
                <h3>${allItems.length === 0 ? 'La dispensa è vuota' : 'Nessun risultato'}</h3>
                <p>${allItems.length === 0 ? 'Aggiungi il primo prodotto!' : 'Prova a modificare ricerca o filtri.'}</p>
                ${allItems.length === 0 && !readOnly
                    ? '<a href="scanner.html" class="btn btn-primary" style="margin-top:0.5rem;">+ Aggiungi prodotto</a>'
                    : ''}
            </div>`;
}

// ============================================================
// MODAL EDIT
// ============================================================

function openEditModal(itemId) {
    editingItem = allItems.find(i => i.id === itemId);
    if (!editingItem) return;

    const form = document.getElementById('form-edit');
    form.querySelector('#edit-name').value     = editingItem.name         || '';
    form.querySelector('#edit-brand').value    = editingItem.brand        || '';
    form.querySelector('#edit-category').value = editingItem.category     || '';
    form.querySelector('#edit-quantity').value = editingItem.quantity     || 1;
    form.querySelector('#edit-unit').value     = editingItem.unit         || 'pz';
    form.querySelector('#edit-expiry').value   = editingItem.expiry_date  || '';
    form.querySelector('#edit-location').value = editingItem.location     || '';
    form.querySelector('#edit-notes').value    = editingItem.notes        || '';

    openModal('modal-edit');
}

function initEditForm() {
    document.getElementById('form-edit')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!editingItem) return;

        const form = document.getElementById('form-edit');
        const category = form.querySelector('#edit-category').value;
        if (!category) { showToast('Seleziona una categoria', 'warning'); return; }

        const data = {
            id:          editingItem.id,
            name:        form.querySelector('#edit-name').value.trim(),
            brand:       form.querySelector('#edit-brand').value.trim() || null,
            category,
            quantity:    parseFloat(form.querySelector('#edit-quantity').value) || 1,
            unit:        form.querySelector('#edit-unit').value,
            expiry_date: form.querySelector('#edit-expiry').value || null,
            location:    form.querySelector('#edit-location').value || null,
            notes:       form.querySelector('#edit-notes').value.trim() || null,
        };

        const btn = form.querySelector('button[type="submit"]');
        if (btn) { btn.disabled = true; btn.textContent = 'Salvando…'; }

        try {
            const res = await api.put('/pantry/update.php', data);
            if (res.success) {
                showToast('Prodotto aggiornato!', 'success');
                closeModal('modal-edit');
                editingItem = null;
                await loadPantry();
            } else {
                showToast(res.message || 'Errore', 'error');
            }
        } catch {
            showToast('Errore di connessione', 'error');
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = '💾 Salva modifiche'; }
        }
    });
}

// ============================================================
// ELIMINA
// ============================================================

function confirmDelete(itemId, itemName) {
    if (!confirm(`Eliminare "${itemName}" dalla dispensa?`)) return;
    deleteItem(itemId);
}

async function deleteItem(itemId) {
    try {
        const res = await api.delete('/pantry/delete.php', { id: itemId });
        if (res.success) {
            showToast('Prodotto eliminato', 'success');
            await loadPantry();
        } else {
            showToast(res.message || 'Errore', 'error');
        }
    } catch {
        showToast('Errore di connessione', 'error');
    }
}

// ============================================================
// UTILITY
// ============================================================

function initSearchBar() {
    let timeout;
    document.getElementById('search-input')?.addEventListener('input', () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => renderCurrentView(), 200);
    });
}

function initFilters() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderCurrentView();
        });
    });
}

function populateCategorySelects() {
    const options = buildCategoryOptions();
    document.getElementById('edit-category').innerHTML = '<option value="">— seleziona categoria —</option>' + options;
}

function showLoader(visible) {
    document.getElementById('list-loader').style.display  = visible ? 'flex'  : 'none';
    document.getElementById('pantry-grid').style.display  = visible ? 'none'  : (currentView === 'expiry' ? 'grid' : 'none');
    document.getElementById('category-view').style.display = visible ? 'none' : (currentView === 'category' ? 'block' : 'none');
}

function setEl(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function initLogout() {
    document.getElementById('btn-logout')?.addEventListener('click', async () => {
        await api.post('/auth/logout.php');
        window.location.href = 'index.html';
    });
}
