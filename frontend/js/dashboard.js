/**
 * dashboard.js — Home: statistiche, ingredienti, scadenze, anteprima ricette
 */

document.addEventListener('DOMContentLoaded', async () => {
    const user = await requireLogin();
    if (!user) return;

    // Popola il nome utente nella sidebar
    const usernameEl = document.getElementById('sidebar-username');
    if (usernameEl) usernameEl.textContent = user.username;
    const avatarEl = document.getElementById('sidebar-avatar');
    if (avatarEl) avatarEl.textContent = user.username[0].toUpperCase();

    // Mostra il nome di benvenuto e la data corrente
    const welcomeEl = document.getElementById('welcome-name');
    if (welcomeEl) welcomeEl.textContent = user.username;

    const dateEl = document.getElementById('dashboard-date');
    if (dateEl) {
        dateEl.textContent = new Date().toLocaleDateString('it-IT', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    }

    initSidebar();
    initLogout();

    // Carica dispensa, ricette e statistiche in parallelo
    const [pantryRes] = await Promise.all([
        api.get('/pantry/list.php'),
        loadRecipesPreview(),
        loadCharts()
    ]);

    if (pantryRes.success) {
        renderStats(pantryRes.stats);
        renderIngredients(pantryRes.items);
        renderExpiringList(pantryRes.items);
    } else {
        showToast('Errore nel caricamento della dispensa', 'error');
        hideLoader('ingredients-loading');
        hideLoader('expiring-loading');
    }
});

/** Aggiorna i contatori statistici */
function renderStats(stats) {
    setEl('stat-total',    stats.total    ?? 0);
    setEl('stat-ok',       stats.ok       ?? 0);
    setEl('stat-expiring', stats.expiring ?? 0);
    setEl('stat-expired',  stats.expired  ?? 0);
}

/** Renderizza i chip degli ingredienti presenti in dispensa */
function renderIngredients(items) {
    hideLoader('ingredients-loading');
    const wrap = document.getElementById('ingredients-wrap');
    if (!wrap) return;

    wrap.style.display = 'block';

    if (items.length === 0) {
        wrap.innerHTML = `
            <div class="empty-state" style="padding: 1rem 0;">
                <div class="empty-icon" style="font-size: 2rem;">📦</div>
                <p>La dispensa è vuota.</p>
                <a href="scanner.html" class="btn btn-primary btn-sm" style="margin-top:0.5rem;">Aggiungi prodotti</a>
            </div>`;
        return;
    }

    const VISIBLE = 20; // Chip mostrati prima di "Mostra tutti"
    const chipsEl = document.getElementById('ingredients-chips');
    const moreBtn = document.getElementById('btn-more-chips');
    if (!chipsEl) return;

    // Costruisce i chip in base allo stato di scadenza
    chipsEl.innerHTML = items.map(item => {
        const cls = item.expiry_status === 'expired'  ? 'ingredient-chip expired'
                  : item.expiry_status === 'expiring' ? 'ingredient-chip expiring'
                  : 'ingredient-chip';
        const icon = item.expiry_status === 'expired'  ? '❌'
                   : item.expiry_status === 'expiring' ? '⚠️'
                   : '✓';
        return `<span class="${cls}" title="${escapeHtml(item.brand ?? '')}">
                    <span>${icon}</span>
                    ${escapeHtml(item.name)}
                    <small style="opacity:0.7">${item.quantity} ${escapeHtml(item.unit)}</small>
                </span>`;
    }).join('');

    // Bottone "Mostra tutti" se i chip superano il limite visivo
    if (items.length > VISIBLE && moreBtn) {
        moreBtn.style.display = 'inline-block';
        moreBtn.addEventListener('click', () => {
            chipsEl.classList.add('expanded');
            moreBtn.style.display = 'none';
        });
    }
}

/** Renderizza la lista prodotti in scadenza/scaduti */
function renderExpiringList(items) {
    hideLoader('expiring-loading');
    const list = document.getElementById('expiring-list');
    if (!list) return;

    // Prendi scaduti + in scadenza, max 7 elementi
    const critical = items
        .filter(i => i.expiry_status === 'expired' || i.expiry_status === 'expiring')
        .slice(0, 7);

    if (critical.length === 0) {
        list.innerHTML = `
            <div style="text-align:center; padding: 1.5rem 0; color: var(--text-light);">
                <div style="font-size:2rem;">✅</div>
                <p style="font-size:0.88rem; margin-top:0.5rem;">Nessun prodotto in scadenza imminente.</p>
            </div>`;
        return;
    }

    list.innerHTML = critical.map(item => {
        const badge = item.expiry_status === 'expired'
            ? `<span class="badge badge-expired">Scaduto</span>`
            : `<span class="badge badge-expiring">${item.days_to_expiry}gg</span>`;

        const emoji = item.expiry_status === 'expired' ? '❌' : '⚠️';

        return `
            <div class="expiry-row">
                <span class="expiry-emoji">${emoji}</span>
                <div class="expiry-info">
                    <div class="expiry-name">${escapeHtml(item.name)}</div>
                    <div class="expiry-date">${formatDate(item.expiry_date)} · ${item.quantity} ${escapeHtml(item.unit)}</div>
                </div>
                <div class="expiry-badge">${badge}</div>
            </div>`;
    }).join('');
}

/** Carica e renderizza le prime ricette suggerite (anteprima) */
async function loadRecipesPreview() {
    try {
        const res = await api.get('/recipes/suggest.php?number=4');

        hideLoader('recipes-loading');
        const preview = document.getElementById('recipes-preview');
        const moreDiv = document.getElementById('recipes-preview-more');
        if (!preview) return;

        if (!res.success || !res.recipes?.length) {
            preview.innerHTML = `
                <div style="text-align:center; padding:1rem 0; color:var(--text-light);">
                    <div style="font-size:2rem;">🍽️</div>
                    <p style="font-size:0.88rem; margin-top:0.5rem;">
                        ${res.message || 'Aggiungi prodotti per ricevere ricette.'}
                    </p>
                </div>`;
            return;
        }

        preview.innerHTML = res.recipes.slice(0, 4).map(recipe => {
            const compatClass = recipe.compatibility >= 80 ? 'badge-green'
                              : recipe.compatibility >= 50 ? 'badge-expiring'
                              : 'badge-expired';

            const imgHtml = recipe.image
                ? `<img class="recipe-mini-img" src="${escapeHtml(recipe.image)}" alt="${escapeHtml(recipe.title)}" loading="lazy" onerror="this.style.display='none'">`
                : `<div class="recipe-mini-placeholder">🍽️</div>`;

            const canMake = recipe.can_make_now
                ? `<span class="badge badge-green" style="font-size:0.7rem;">✓ Subito</span>`
                : '';

            return `
                <div class="recipe-mini">
                    ${imgHtml}
                    <div class="recipe-mini-info">
                        <div class="recipe-mini-title">${escapeHtml(recipe.title)}</div>
                        <div class="recipe-mini-meta">
                            <span class="badge ${compatClass}" style="font-size:0.7rem;">${recipe.compatibility}% compat.</span>
                            ${canMake}
                            <span style="font-size:0.75rem; color:var(--text-light);">
                                🔴 ${recipe.missed_ingredient_count} mancanti
                            </span>
                        </div>
                    </div>
                </div>`;
        }).join('');

        // Mostra il bottone "Vedi tutte" se ci sono più di 4 ricette
        if (res.total_found > 4 && moreDiv) {
            moreDiv.style.display = 'block';
        }
    } catch {
        hideLoader('recipes-loading');
        const preview = document.getElementById('recipes-preview');
        if (preview) {
            preview.innerHTML = `<p style="color:var(--text-light); font-size:0.88rem; text-align:center; padding:1rem 0;">
                Impossibile caricare le ricette.</p>`;
        }
    }
}

// ---- Grafici statistiche ----

async function loadCharts() {
    try {
        const res = await api.get('/pantry/stats.php');
        if (!res.success) return;
        renderCategoryChart(res.categories);
        renderNutritionChart(res.nutrition);
    } catch {
        hideLoader('chart-cat-loading');
        hideLoader('chart-nut-loading');
    }
}

function renderCategoryChart(categories) {
    hideLoader('chart-cat-loading');
    if (!categories?.length) return;

    const catColors = {
        latticini: '#ffe082', verdura: '#a5d6a7', frutta: '#f48fb1',
        carne: '#ffab91', pesce: '#90caf9', cereali: '#ffcc80',
        surgelati: '#9fa8da', bevande: '#81d4fa', condimenti: '#ce93d8',
        snack: '#ef9a9a', conserve: '#c5e1a5', altro: '#e0e0e0',
    };
    const catLabels = {
        latticini: 'Latticini', verdura: 'Verdura', frutta: 'Frutta',
        carne: 'Carne', pesce: 'Pesce', cereali: 'Cereali & Pasta',
        surgelati: 'Surgelati', bevande: 'Bevande', condimenti: 'Condimenti',
        snack: 'Snack & Dolci', conserve: 'Conserve', altro: 'Altro',
    };

    const canvas = document.getElementById('chart-categories');
    canvas.style.display = 'block';

    new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: categories.map(c => catLabels[c.category] || c.category),
            datasets: [{
                data: categories.map(c => c.count),
                backgroundColor: categories.map(c => catColors[c.category] || '#e0e0e0'),
                borderWidth: 2,
                borderColor: '#fff',
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { position: 'right', labels: { font: { size: 11 }, boxWidth: 14, padding: 8 } },
                tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw} prodott${ctx.raw === 1 ? 'o' : 'i'}` } }
            },
            cutout: '60%',
        }
    });
}

function renderNutritionChart(nutrition) {
    hideLoader('chart-nut-loading');
    if (!nutrition?.avg_calories) {
        document.getElementById('chart-nut-empty').style.display = 'block';
        return;
    }

    const canvas = document.getElementById('chart-nutrition');
    canvas.style.display = 'block';

    const labels  = ['Calorie (kcal)', 'Proteine (g)', 'Carboidrati (g)', 'Grassi (g)', 'Fibre (g)', 'Sale (g)'];
    const values  = [
        nutrition.avg_calories, nutrition.avg_proteins,
        nutrition.avg_carbs,    nutrition.avg_fats,
        nutrition.avg_fiber,    nutrition.avg_salt,
    ].map(v => v ?? 0);
    const colors  = ['#f59e0b', '#3b82f6', '#8b5cf6', '#ef4444', '#10b981', '#6b7280'];

    new Chart(canvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Media per 100g',
                data: values,
                backgroundColor: colors.map(c => c + 'cc'),
                borderColor: colors,
                borderWidth: 1,
                borderRadius: 6,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: ctx => ` ${ctx.raw}` } },
            },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.06)' }, ticks: { font: { size: 10 } } },
                x: { grid: { display: false }, ticks: { font: { size: 10 } } }
            }
        }
    });
}

// ---- Utility ----

function setEl(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function hideLoader(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
}

function initLogout() {
    document.getElementById('btn-logout')?.addEventListener('click', async () => {
        await api.post('/auth/logout.php');
        window.location.href = 'index.html';
    });
}
