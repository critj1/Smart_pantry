/**
 * recipes.js — Ricette consigliate + ricerca per nome + filtro intolleranze
 */

let recipeCache        = {}; // cache ricette per ID (usata dal popup dettagli)
let selectedIntolerances = new Set(); // intolleranze selezionate

// Mappa intolleranza → etichetta italiana + emoji
const INTOLERANCES = [
    { key: 'gluten',    label: 'Glutine',        icon: '🌾' },
    { key: 'dairy',     label: 'Lattosio',        icon: '🥛' },
    { key: 'egg',       label: 'Uova',            icon: '🥚' },
    { key: 'peanut',    label: 'Arachidi',        icon: '🥜' },
    { key: 'tree nut',  label: 'Frutta a guscio', icon: '🌰' },
    { key: 'soy',       label: 'Soia',            icon: '🫘' },
    { key: 'seafood',   label: 'Pesce',           icon: '🐟' },
    { key: 'shellfish', label: 'Crostacei',       icon: '🦐' },
    { key: 'sesame',    label: 'Sesamo',          icon: '🌿' },
    { key: 'wheat',     label: 'Frumento',        icon: '🌾' },
    { key: 'sulfite',   label: 'Solfiti',         icon: '🍷' },
    { key: 'grain',     label: 'Cereali',         icon: '🌽' },
];

document.addEventListener('DOMContentLoaded', async () => {
    const user = await requireLogin();
    if (!user) return;

    const usernameEl = document.getElementById('sidebar-username');
    if (usernameEl) usernameEl.textContent = user.username;
    const avatarEl = document.getElementById('sidebar-avatar');
    if (avatarEl) avatarEl.textContent = user.username[0].toUpperCase();

    initSidebar();
    initLogout();
    initTabs();
    initControls();
    initSearchForm();
    initIntoleranceFilter();
    await loadRecipes();
});

// ============================================================
// TAB
// ============================================================

function initTabs() {
    document.querySelectorAll('.pill-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            document.querySelectorAll('.pill-tab').forEach(b => b.classList.toggle('active', b === btn));
            document.getElementById('section-suggested').classList.toggle('hidden', tab !== 'suggested');
            document.getElementById('section-search').classList.toggle('hidden',    tab !== 'search');
        });
    });
}

// ============================================================
// RICETTE CONSIGLIATE
// ============================================================

async function loadRecipes(pantryOnly = false) {
    showGrid(false);
    document.getElementById('recipes-stats').style.display = 'none';

    try {
        const params = `?pantry_only=${pantryOnly ? 1 : 0}&number=12`;
        const res    = await api.get('/recipes/suggest.php' + params);

        if (res.success) {
            renderRecipes(res.recipes, 'recipes-grid');
            showStats(res);
        } else {
            showGridError('recipes-grid', res.message || 'Errore nel caricamento ricette');
        }
    } catch {
        showGridError('recipes-grid', 'Errore di connessione. Verifica che il server sia attivo.');
    } finally {
        showGrid(true);
    }
}

function showStats(data) {
    const statsEl = document.getElementById('recipes-stats');
    if (!statsEl) return;
    statsEl.style.display = 'flex';
    statsEl.innerHTML = `
        <div class="stat-card">
            <div class="stat-icon green">🍽️</div>
            <div class="stat-info">
                <div class="stat-value">${data.total_found}</div>
                <div class="stat-label">Ricette trovate</div>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon blue">✓</div>
            <div class="stat-info">
                <div class="stat-value">${data.can_make_now}</div>
                <div class="stat-label">Puoi fare subito</div>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon yellow">🥕</div>
            <div class="stat-info">
                <div class="stat-value">${data.pantry_items?.length ?? 0}</div>
                <div class="stat-label">Ingredienti usati</div>
            </div>
        </div>`;
}

function showGrid(visible) {
    const loader = document.getElementById('recipes-loader');
    const grid   = document.getElementById('recipes-grid');
    if (loader) loader.style.display = visible ? 'none' : 'block';
    if (grid)   grid.style.display   = visible ? 'grid' : 'none';
}

function initControls() {
    document.getElementById('toggle-pantry-only')?.addEventListener('change', e => {
        loadRecipes(e.target.checked);
    });
    document.getElementById('btn-reload')?.addEventListener('click', () => {
        const toggle = document.getElementById('toggle-pantry-only');
        loadRecipes(toggle?.checked ?? false);
    });
}

// ============================================================
// FILTRO INTOLLERANZE
// ============================================================

function initIntoleranceFilter() {
    const toggleBtn = document.getElementById('btn-intol-toggle');
    const pillsWrap = document.getElementById('intol-pills-wrap');
    if (!toggleBtn || !pillsWrap) return;

    // Genera pillole
    pillsWrap.innerHTML = INTOLERANCES.map(i => `
        <button type="button"
                class="intol-pill"
                data-key="${escapeHtml(i.key)}"
                title="${escapeHtml(i.label)}">
            <span class="intol-icon">${i.icon}</span>
            ${escapeHtml(i.label)}
        </button>`).join('') +
        `<span class="intolerance-hint">Le ricette che contengono questi ingredienti verranno escluse</span>`;

    // Click su singola pillola
    pillsWrap.querySelectorAll('.intol-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            const key = pill.dataset.key;
            if (selectedIntolerances.has(key)) {
                selectedIntolerances.delete(key);
                pill.classList.remove('selected');
            } else {
                selectedIntolerances.add(key);
                pill.classList.add('selected');
            }
            updateIntoleranceBadge();
            updateActiveIntolerancesBar();
        });
    });

    // Toggle pannello apri/chiudi
    toggleBtn.addEventListener('click', () => {
        const isOpen = toggleBtn.classList.toggle('open');
        pillsWrap.classList.toggle('hidden', !isOpen);
    });

    // Pulsante "Rimuovi filtri"
    document.getElementById('btn-clear-intol')?.addEventListener('click', () => {
        clearIntolerances();
    });
}

function clearIntolerances() {
    selectedIntolerances.clear();
    document.querySelectorAll('.intol-pill.selected').forEach(p => p.classList.remove('selected'));
    updateIntoleranceBadge();
    updateActiveIntolerancesBar();
}

/** Aggiorna il badge numerico sul pulsante toggle */
function updateIntoleranceBadge() {
    const badge = document.getElementById('intol-count-badge');
    if (!badge) return;
    const count = selectedIntolerances.size;
    badge.textContent = count;
    badge.style.display = count > 0 ? 'inline-flex' : 'none';
}

/** Aggiorna la barra "Escluso: …" sopra i risultati */
function updateActiveIntolerancesBar() {
    const bar      = document.getElementById('active-intolerances-bar');
    const tagsWrap = document.getElementById('active-intol-tags');
    if (!bar || !tagsWrap) return;

    if (selectedIntolerances.size === 0) {
        bar.style.display = 'none';
        return;
    }

    bar.style.display = 'flex';
    tagsWrap.innerHTML = [...selectedIntolerances].map(key => {
        const info = INTOLERANCES.find(i => i.key === key);
        return `<span class="intol-tag">${info ? info.icon + ' ' + info.label : key}</span>`;
    }).join('');
}

/** Restituisce la stringa di intolleranze per l'API (virgola-separato) */
function getIntolerancesParam() {
    return [...selectedIntolerances].join(',');
}

// ============================================================
// RICERCA RICETTE PER NOME
// ============================================================

function initSearchForm() {
    document.getElementById('btn-search')?.addEventListener('click', handleSearch);

    document.getElementById('search-query')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') handleSearch();
    });
}

async function handleSearch() {
    const input = document.getElementById('search-query');
    const query = input?.value?.trim();
    if (!query) {
        input?.focus();
        showToast('Inserisci un termine di ricerca', 'warning');
        return;
    }
    await searchRecipes(query);
}

function quickSearch(query) {
    const input = document.getElementById('search-query');
    if (input) input.value = query;
    searchRecipes(query);
}

async function searchRecipes(query) {
    document.querySelectorAll('.pill-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === 'search'));
    document.getElementById('section-suggested').classList.add('hidden');
    document.getElementById('section-search').classList.remove('hidden');

    document.getElementById('search-suggestions').style.display = 'none';
    document.getElementById('search-info').style.display        = 'none';
    document.getElementById('search-loader').style.display      = 'flex';
    document.getElementById('search-grid').innerHTML             = '';

    const btn = document.getElementById('btn-search');
    if (btn) { btn.disabled = true; btn.textContent = 'Ricerca…'; }

    // Costruisci URL con intolleranze se presenti
    const intolerancesParam = getIntolerancesParam();
    let endpoint = `/recipes/search.php?query=${encodeURIComponent(query)}&number=12`;
    if (intolerancesParam) {
        endpoint += `&intolerances=${encodeURIComponent(intolerancesParam)}`;
    }

    // Aggiorna la barra delle intolleranze attive
    updateActiveIntolerancesBar();

    try {
        const res = await api.get(endpoint);

        document.getElementById('search-loader').style.display = 'none';

        if (res.success) {
            renderRecipes(res.recipes, 'search-grid');
            showSearchInfo(query, res.total_found, res.can_make_now, intolerancesParam);
        } else {
            showGridError('search-grid', res.message || 'Nessun risultato');
        }
    } catch {
        document.getElementById('search-loader').style.display = 'none';
        showGridError('search-grid', 'Errore di connessione. Controlla che il server sia attivo.');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Cerca'; }
    }
}

function showSearchInfo(query, total, canMakeNow, intolerances) {
    const infoEl  = document.getElementById('search-info');
    const labelEl = document.getElementById('search-query-label');
    const countEl = document.getElementById('search-count');

    if (infoEl && labelEl && countEl) {
        infoEl.style.display = 'flex';
        labelEl.textContent  = `"${query}"`;

        let countHtml = `— ${total} risultat${total === 1 ? 'o' : 'i'}`;
        if (canMakeNow > 0) {
            countHtml += ` · <span style="color:var(--success)">✓ ${canMakeNow} fattibil${canMakeNow === 1 ? 'e' : 'i'} subito</span>`;
        }
        if (intolerances) {
            const count = intolerances.split(',').length;
            countHtml += ` · <span style="color:var(--warning)">⚠️ ${count} intolleranz${count === 1 ? 'a' : 'e'} esclus${count === 1 ? 'a' : 'e'}</span>`;
        }
        countEl.innerHTML = countHtml;
    }
}

// ============================================================
// RENDERING CARD RICETTE
// ============================================================

function renderRecipes(recipes, gridId) {
    const grid = document.getElementById(gridId);
    if (!grid) return;

    if (!recipes || recipes.length === 0) {
        const hasFilters = selectedIntolerances.size > 0;
        grid.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1;">
                <div class="empty-icon">🍽️</div>
                <h3>Nessuna ricetta trovata</h3>
                <p>${hasFilters
                    ? 'Nessuna ricetta corrisponde ai criteri di ricerca con i filtri intolleranze attivi. Prova a rimuovere qualche filtro.'
                    : 'Prova con un termine diverso o aggiungi più prodotti alla dispensa.'}</p>
                ${hasFilters
                    ? `<button class="btn btn-outline" style="margin-top:0.75rem;" onclick="clearIntolerances(); handleSearch()">Rimuovi filtri intolleranze</button>`
                    : `<a href="pantry.html" class="btn btn-primary" style="margin-top:0.5rem;">Vai alla dispensa</a>`}
            </div>`;
        return;
    }

    // Popola la cache per il popup dettagli
    recipes.forEach(r => { recipeCache[r.id] = r; });

    grid.innerHTML = recipes.map(buildRecipeCard).join('');
}

function buildRecipeCard(recipe) {
    const compatClass = recipe.compatibility >= 80 ? 'high'
                      : recipe.compatibility >= 50 ? 'medium'
                      : 'low';

    const imageHtml = recipe.image
        ? `<img class="recipe-image" src="${escapeHtml(recipe.image)}" alt="${escapeHtml(recipe.title)}" loading="lazy"
               onerror="this.parentNode.innerHTML='<div class=\\'recipe-image-placeholder\\'>🍽️</div>'">`
        : `<div class="recipe-image-placeholder">🍽️</div>`;

    const canMakeBadge = recipe.can_make_now
        ? `<span class="badge badge-green">✓ Puoi farlo subito</span>`
        : '';

    const timeBadge = recipe.ready_in_minutes
        ? `<span class="time-badge">⏱ ${recipe.ready_in_minutes} min</span>`
        : '';

    // Ingredienti disponibili (preview, max 5)
    const availableHtml = recipe.used_ingredients?.length > 0
        ? `<h4 class="available">✓ Hai già (${recipe.used_ingredients.length})</h4>
           <ul class="ingredient-list">
               ${recipe.used_ingredients.slice(0, 5).map(i =>
                   `<li class="ingredient-tag available" title="${escapeHtml(`${i.amount} ${i.unit}`)}">
                        ${escapeHtml(i.name)}
                    </li>`
               ).join('')}
               ${recipe.used_ingredients.length > 5
                   ? `<li class="ingredient-tag">+${recipe.used_ingredients.length - 5} altri</li>`
                   : ''}
           </ul>`
        : '';

    // Ingredienti mancanti (preview, max 4)
    const missingHtml = recipe.missed_ingredients?.length > 0
        ? `<h4 class="missing">✕ Mancano (${recipe.missed_ingredients.length})</h4>
           <ul class="ingredient-list">
               ${recipe.missed_ingredients.slice(0, 4).map(i =>
                   `<li class="ingredient-tag missing" title="${escapeHtml(`${i.amount} ${i.unit}`)}">
                        ${escapeHtml(i.name)}
                    </li>`
               ).join('')}
               ${recipe.missed_ingredients.length > 4
                   ? `<li class="ingredient-tag">+${recipe.missed_ingredients.length - 4} altri</li>`
                   : ''}
           </ul>`
        : '';

    const noIngredients = !recipe.used_ingredients?.length && !recipe.missed_ingredients?.length
        ? `<p style="font-size:0.82rem; color:var(--text-muted); padding:0.5rem 0;">
               Ingredienti non disponibili per questa ricetta.
           </p>`
        : '';

    return `
        <div class="recipe-card ${recipe.can_make_now ? 'border-success' : ''}">
            ${imageHtml}
            <div class="recipe-body">
                <div class="recipe-title">${escapeHtml(recipe.title)}</div>
                <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.5rem; flex-wrap:wrap;">
                    ${canMakeBadge}
                    ${timeBadge}
                </div>
                <div class="recipe-compatibility">
                    <div class="compatibility-bar">
                        <div class="compatibility-fill ${compatClass}" style="width:${recipe.compatibility}%"></div>
                    </div>
                    <span class="compatibility-pct">${recipe.compatibility}%</span>
                </div>
                <div class="ingredients-section">
                    ${availableHtml}
                    ${missingHtml}
                    ${noIngredients}
                </div>
            </div>
            <div class="recipe-footer">
                <a href="https://spoonacular.com/recipes/-${recipe.id}"
                   target="_blank" rel="noopener noreferrer"
                   class="btn btn-primary btn-sm">🔗 Ricetta completa</a>
                <button class="btn btn-secondary btn-sm" onclick="openRecipeDetail(${recipe.id})">📋 Ingredienti</button>
            </div>
        </div>`;
}

// ============================================================
// POPUP DETTAGLI RICETTA
// ============================================================

function openRecipeDetail(id) {
    const recipe = recipeCache[id];
    if (!recipe) return;

    document.getElementById('recipe-detail-title').textContent = recipe.title;
    document.getElementById('recipe-detail-body').innerHTML    = buildRecipeDetailHtml(recipe);

    const missingNames   = (recipe.missed_ingredients || []).map(i =>
        `${i.amount} ${i.unit} ${i.name}`.trim().replace(/\s+/g, ' '));
    const availableNames = (recipe.used_ingredients || []).map(i =>
        `${i.amount} ${i.unit} ${i.name}`.trim().replace(/\s+/g, ' '));
    const label = recipe.title;

    document.getElementById('btn-dl-recipe-shop')?.addEventListener('click', () =>
        downloadShoppingList(missingNames, availableNames, label));
    document.getElementById('btn-print-recipe-shop')?.addEventListener('click', () =>
        printShoppingList(missingNames, availableNames, label));

    openModal('modal-recipe-detail');
}

function buildRecipeDetailHtml(recipe) {
    const metaParts = [];
    if (recipe.ready_in_minutes) metaParts.push(`⏱ ${recipe.ready_in_minutes} min`);
    if (recipe.servings)         metaParts.push(`🍽️ ${recipe.servings} porzioni`);
    const metaHtml = metaParts.length
        ? `<div style="display:flex; gap:1.25rem; margin-bottom:1rem; font-size:0.9rem; color:var(--text-muted);">
               ${metaParts.map(m => `<span>${m}</span>`).join('')}
           </div>`
        : '';

    const compatClass = recipe.compatibility >= 80 ? 'high' : recipe.compatibility >= 50 ? 'medium' : 'low';
    const compatHtml = `
        <div class="recipe-compatibility" style="margin-bottom:1.25rem;">
            <div class="compatibility-bar">
                <div class="compatibility-fill ${compatClass}" style="width:${recipe.compatibility}%"></div>
            </div>
            <span class="compatibility-pct">${recipe.compatibility}% ingredienti disponibili</span>
        </div>`;

    const usedHtml = recipe.used_ingredients?.length
        ? `<div style="margin-bottom:1rem;">
               <h4 style="color:var(--success); margin-bottom:0.5rem; font-size:0.9rem; font-weight:600;">
                   ✓ Hai già (${recipe.used_ingredients.length})
               </h4>
               <ul class="ingredient-detail-list">
                   ${recipe.used_ingredients.map(i => `
                       <li class="ing-detail-item available">
                           <span class="ing-detail-name">${escapeHtml(i.name)}</span>
                           <span class="ing-detail-amount">${escapeHtml((`${i.amount} ${i.unit}`).trim())}</span>
                       </li>`).join('')}
               </ul>
           </div>`
        : '';

    const missedHtml = recipe.missed_ingredients?.length
        ? `<div style="margin-bottom:1rem;">
               <h4 style="color:var(--danger); margin-bottom:0.5rem; font-size:0.9rem; font-weight:600;">
                   ✕ Mancano (${recipe.missed_ingredients.length})
               </h4>
               <ul class="ingredient-detail-list">
                   ${recipe.missed_ingredients.map(i => `
                       <li class="ing-detail-item missing">
                           <span class="ing-detail-name">${escapeHtml(i.name)}</span>
                           <span class="ing-detail-amount">${escapeHtml((`${i.amount} ${i.unit}`).trim())}</span>
                       </li>`).join('')}
               </ul>
           </div>`
        : '';

    let nutritionHtml = '';
    if (recipe.nutrition) {
        const n = recipe.nutrition;
        const srv = n.servings ? `per porzione (${n.servings} porz.)` : 'per porzione';
        const nutrients = [
            { label: 'Calorie',     value: n.calories, unit: 'kcal', daily: 2000, color: '#f59e0b' },
            { label: 'Proteine',    value: n.proteins, unit: 'g',    daily: 50,   color: '#3b82f6' },
            { label: 'Carboidrati', value: n.carbs,    unit: 'g',    daily: 260,  color: '#8b5cf6' },
            { label: 'Grassi',      value: n.fats,     unit: 'g',    daily: 70,   color: '#ef4444' },
            { label: 'Fibre',       value: n.fiber,    unit: 'g',    daily: 25,   color: '#10b981' },
            { label: 'Sodio',       value: n.sodium,   unit: 'mg',   daily: 2300, color: '#6b7280' },
        ].filter(item => item.value != null);

        if (nutrients.length) {
            const rows = nutrients.map(item => {
                const pct = Math.min(100, Math.round(item.value / item.daily * 100));
                return `
                    <div class="nutrient-row">
                        <span class="nutrient-name">${item.label}</span>
                        <div class="nutrient-bar-wrap">
                            <div class="nutrient-bar" style="width:${pct}%; background:${item.color};"></div>
                        </div>
                        <span class="nutrient-val">${item.value} ${item.unit}</span>
                        <span class="nutrient-pct">${pct}%</span>
                    </div>`;
            }).join('');

            nutritionHtml = `
                <div class="nutrition-panel" style="margin-bottom:1rem;">
                    <div class="nutrition-panel-title">
                        Valori nutrizionali
                        <small style="font-weight:400; color:var(--text-light);">${srv}</small>
                    </div>
                    ${rows}
                    <div class="nutrition-footnote">* % rispetto al fabbisogno giornaliero di riferimento</div>
                </div>`;
        }
    }

    const hasMissing = (recipe.missed_ingredients?.length ?? 0) > 0;
    const shoppingActionsHtml = hasMissing
        ? `<div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-bottom:0.75rem;">
               <button class="btn btn-outline btn-sm" id="btn-dl-recipe-shop">📥 Scarica lista spesa</button>
               <button class="btn btn-outline btn-sm" id="btn-print-recipe-shop">🖨️ Stampa lista spesa</button>
           </div>`
        : '';

    const recipeLinkHtml = `
        <div style="padding-top:0.75rem; border-top:1px solid var(--border-light);">
            <a href="https://spoonacular.com/recipes/-${recipe.id}"
               target="_blank" rel="noopener noreferrer"
               class="btn btn-primary btn-sm">🔗 Vai alla ricetta completa</a>
        </div>`;

    return metaHtml + compatHtml + usedHtml + missedHtml + nutritionHtml + shoppingActionsHtml + recipeLinkHtml;
}

// ---- Utility ----

function showGridError(gridId, message) {
    const grid = document.getElementById(gridId);
    if (grid) {
        grid.innerHTML = `
            <div class="alert alert-danger" style="grid-column:1/-1;">
                <span class="alert-icon">❌</span>
                <div>${escapeHtml(message)}</div>
            </div>`;
    }
}

function initLogout() {
    document.getElementById('btn-logout')?.addEventListener('click', async () => {
        await api.post('/auth/logout.php');
        window.location.href = 'index.html';
    });
}
