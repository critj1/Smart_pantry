/**
 * meals.js — Piano pasti: calendario mensile + CRUD pasti + lista spesa
 */

// ---- Stato ----
let currentYear  = new Date().getFullYear();
let currentMonth = new Date().getMonth(); // 0-indexed
let selectedDate = null;
let mealsMap     = {}; // { "2026-04-10": [{ id, meal_type, title, ... }, ...] }
let editingMealId = null;
let readOnly      = false; // true se membro (non admin) in contesto gruppo

// ---- Costanti ----
const MONTHS = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const DAYS_SHORT = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];
const MONTH_NAMES_IT = ['gennaio','febbraio','marzo','aprile','maggio','giugno',
                        'luglio','agosto','settembre','ottobre','novembre','dicembre'];
const DAY_NAMES_IT   = ['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'];

const MEAL_TYPES = {
    colazione: { label: 'Colazione', color: '#d97706' },
    pranzo:    { label: 'Pranzo',    color: '#16a34a' },
    cena:      { label: 'Cena',      color: '#2563eb' },
};

// ---- Init ----
document.addEventListener('DOMContentLoaded', async () => {
    const user = await requireLogin();
    if (!user) return;

    // Popola sidebar
    const avatarEl   = document.getElementById('sidebar-avatar');
    const usernameEl = document.getElementById('sidebar-username');
    if (avatarEl)   avatarEl.textContent   = user.username[0].toUpperCase();
    if (usernameEl) usernameEl.textContent = user.username;

    readOnly = user.active_context?.type === 'group' && user.active_context?.role === 'member';

    initDrawer();
    initLogout();

    if (readOnly) {
        const banner = document.createElement('div');
        banner.className = 'alert alert-info';
        banner.style.cssText = 'margin-bottom:1rem; font-size:0.88rem;';
        banner.innerHTML = '👁️ Stai visualizzando il piano pasti del gruppo come <strong>membro</strong>. Solo gli admin possono aggiungere o modificare pasti.';
        document.querySelector('.page-content')?.prepend(banner);
    }

    // Carica pasti del mese corrente e renderizza il calendario
    await loadMonthMeals();
    renderCalendar();

    // Seleziona oggi di default
    selectDate(formatDateLocal(new Date()));

    // Navigazione mese
    document.getElementById('prev-month').addEventListener('click', async () => {
        currentMonth--;
        if (currentMonth < 0) { currentMonth = 11; currentYear--; }
        await loadMonthMeals();
        renderCalendar();
    });
    document.getElementById('next-month').addEventListener('click', async () => {
        currentMonth++;
        if (currentMonth > 11) { currentMonth = 0; currentYear++; }
        await loadMonthMeals();
        renderCalendar();
    });

    // Pulsante "Oggi"
    document.getElementById('btn-today').addEventListener('click', async () => {
        const today = new Date();
        currentYear  = today.getFullYear();
        currentMonth = today.getMonth();
        await loadMonthMeals();
        renderCalendar();
        selectDate(formatDateLocal(today));
    });

    // Form salva pasto
    document.getElementById('form-meal').addEventListener('submit', saveMeal);

    // Aggiungi ingrediente
    document.getElementById('btn-ingredient-add').addEventListener('click', () => addIngredientField());

    // Tab del modal (scrivi / cerca ricetta)
    document.querySelectorAll('.modal-tab').forEach(btn => {
        btn.addEventListener('click', () => switchModalTab(btn.dataset.mtab));
    });

    // Ricerca ricette nel modal
    document.getElementById('recipe-search-input').addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); searchRecipesInModal(); }
    });
    document.getElementById('btn-recipe-search-modal').addEventListener('click', searchRecipesInModal);

    // Lista spesa
    const today = new Date();
    document.getElementById('shop-start').value = formatDateLocal(today);
    document.getElementById('shop-end').value   = formatDateLocal(new Date(today.getTime() + 6 * 86400000));
    document.getElementById('btn-generate-shopping').addEventListener('click', generateShoppingList);
});

// ---- Utility date ----
function formatDateLocal(d) {
    const y  = d.getFullYear();
    const m  = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
}

// ---- Caricamento pasti ----
async function loadMonthMeals() {
    const m     = String(currentMonth + 1).padStart(2, '0');
    const start = `${currentYear}-${m}-01`;
    const last  = new Date(currentYear, currentMonth + 1, 0).getDate();
    const end   = `${currentYear}-${m}-${String(last).padStart(2, '0')}`;

    try {
        const res = await api.get(`/meals/list.php?start=${start}&end=${end}`);
        mealsMap = {};
        if (res.success) {
            for (const meal of res.meals) {
                if (!mealsMap[meal.date]) mealsMap[meal.date] = [];
                mealsMap[meal.date].push(meal);
            }
        }
    } catch(e) {
        console.error('Errore caricamento pasti', e);
    }
}

// ---- Render calendario ----
function renderCalendar() {
    document.getElementById('month-label').textContent = `${MONTHS[currentMonth]} ${currentYear}`;

    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';

    // Intestazioni giorni settimana
    DAYS_SHORT.forEach(d => {
        const el = document.createElement('div');
        el.className = 'cal-header';
        el.textContent = d;
        grid.appendChild(el);
    });

    // Offset: lunedì = 0 (il calendario JS è domenica = 0)
    const firstDow = new Date(currentYear, currentMonth, 1).getDay();
    const offset   = (firstDow === 0) ? 6 : firstDow - 1;

    for (let i = 0; i < offset; i++) {
        const el = document.createElement('div');
        el.className = 'cal-day cal-empty';
        grid.appendChild(el);
    }

    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const todayStr    = formatDateLocal(new Date());

    for (let d = 1; d <= daysInMonth; d++) {
        const m       = String(currentMonth + 1).padStart(2, '0');
        const dateStr = `${currentYear}-${m}-${String(d).padStart(2, '0')}`;

        const cell = document.createElement('div');
        cell.className = 'cal-day';
        if (dateStr === todayStr)    cell.classList.add('today');
        if (dateStr === selectedDate) cell.classList.add('selected');

        const numEl = document.createElement('span');
        numEl.className = 'cal-day-num';
        numEl.textContent = d;
        cell.appendChild(numEl);

        // Pallini pasti
        const dayMeals = mealsMap[dateStr];
        if (dayMeals && dayMeals.length > 0) {
            const dotsEl = document.createElement('div');
            dotsEl.className = 'cal-dots';
            ['colazione','pranzo','cena'].forEach(type => {
                if (dayMeals.some(m => m.meal_type === type)) {
                    const dot = document.createElement('span');
                    dot.className = `cal-dot cal-dot-${type}`;
                    dotsEl.appendChild(dot);
                }
            });
            cell.appendChild(dotsEl);
        }

        cell.addEventListener('click', () => selectDate(dateStr));
        grid.appendChild(cell);
    }
}

// ---- Selezione giorno ----
function selectDate(dateStr) {
    selectedDate = dateStr;

    // Aggiorna visuale selezione
    document.querySelectorAll('.cal-day.selected').forEach(el => el.classList.remove('selected'));
    const [y, m, d] = dateStr.split('-').map(Number);
    if (y === currentYear && m === currentMonth + 1) {
        document.querySelectorAll('.cal-day:not(.cal-empty)').forEach(cell => {
            if (Number(cell.querySelector('.cal-day-num')?.textContent) === d) {
                cell.classList.add('selected');
            }
        });
    }

    renderDayPanel();
}

// ---- Pannello giorno ----
function renderDayPanel() {
    const panel = document.getElementById('day-panel-content');
    if (!selectedDate) {
        panel.innerHTML = '<p style="padding:2rem; text-align:center; color:var(--text-muted);">Seleziona un giorno dal calendario.</p>';
        return;
    }

    const [y, m, d] = selectedDate.split('-').map(Number);
    const dow   = new Date(y, m - 1, d).getDay();
    const label = `${DAY_NAMES_IT[dow]}, ${d} ${MONTH_NAMES_IT[m - 1]} ${y}`;
    const dayMeals = mealsMap[selectedDate] || [];

    let html = `<div class="day-panel-header"><h3>${escapeHtml(label)}</h3></div>`;

    ['colazione','pranzo','cena'].forEach(type => {
        const meal     = dayMeals.find(m => m.meal_type === type);
        const typeInfo = MEAL_TYPES[type];

        html += `<div class="meal-slot">
            <div class="meal-slot-header">
                <span class="meal-type-label" style="color:${typeInfo.color}">${typeInfo.label}</span>
                ${!readOnly ? `<button class="btn btn-primary btn-sm"
                        onclick="openMealModal('${selectedDate}','${type}',${meal ? meal.id : 'null'})">
                    ${meal ? 'Modifica' : '+ Aggiungi'}
                </button>` : ''}
            </div>`;

        if (meal) {
            const chips = (meal.ingredients || [])
                .map(i => `<span class="ingredient-chip">${escapeHtml(i)}</span>`).join('');
            html += `<div class="meal-info">
                <div class="meal-title">${escapeHtml(meal.title)}</div>
                ${meal.recipe_name ? `<div class="meal-recipe">Ricetta: ${escapeHtml(meal.recipe_name)}</div>` : ''}
                ${chips ? `<div class="meal-ingredients"><span class="meal-ing-label">Ingredienti:</span>${chips}</div>` : ''}
                ${meal.notes ? `<div class="meal-notes">${escapeHtml(meal.notes)}</div>` : ''}
                ${!readOnly ? `<button class="btn btn-danger btn-sm" style="margin-top:0.6rem;"
                        onclick="deleteMeal(${meal.id})">Elimina</button>` : ''}
            </div>`;
        } else {
            html += `<p class="meal-empty">Nessun pasto pianificato</p>`;
        }

        html += `</div>`;
    });

    panel.innerHTML = html;
}

// ---- Modal pasto ----
function openMealModal(dateStr, mealType, mealId) {
    editingMealId = mealId;

    const [y, m, d] = dateStr.split('-').map(Number);
    const typeInfo  = MEAL_TYPES[mealType];
    const label     = mealId ? 'Modifica' : 'Aggiungi';

    document.getElementById('modal-meal-title').textContent =
        `${label} — ${typeInfo.label}, ${d} ${MONTH_NAMES_IT[m - 1]}`;
    document.getElementById('meal-date').value        = dateStr;
    document.getElementById('meal-type').value        = mealType;
    document.getElementById('meal-title-input').value = '';
    document.getElementById('meal-notes-input').value = '';
    document.getElementById('ingredients-list').innerHTML = '';
    document.getElementById('recipe-search-results-modal').innerHTML = '';
    document.getElementById('recipe-search-input').value = '';
    switchModalTab('manual');

    // Precompila in caso di modifica
    if (mealId) {
        const meal = (mealsMap[dateStr] || []).find(m => m.id == mealId);
        if (meal) {
            document.getElementById('meal-title-input').value = meal.title;
            document.getElementById('meal-notes-input').value = meal.notes || '';
            (meal.ingredients || []).forEach(ing => addIngredientField(ing));
        }
    }

    openModal('modal-meal');
}

function switchModalTab(tab) {
    document.querySelectorAll('.modal-tab').forEach(b => b.classList.toggle('active', b.dataset.mtab === tab));
    document.getElementById('mtab-manual').classList.toggle('hidden', tab !== 'manual');
    document.getElementById('mtab-recipe').classList.toggle('hidden', tab !== 'recipe');
}

function addIngredientField(value = '') {
    const list = document.getElementById('ingredients-list');
    const row  = document.createElement('div');
    row.className = 'ingredient-row';
    row.innerHTML = `
        <input class="form-control ingredient-input" type="text"
               placeholder="es. pasta, pomodoro, basilico…"
               value="${escapeHtml(String(value))}">
        <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove()">×</button>`;
    list.appendChild(row);
    row.querySelector('input').focus();
}

async function saveMeal(e) {
    e.preventDefault();

    const date     = document.getElementById('meal-date').value;
    const mealType = document.getElementById('meal-type').value;
    const title    = document.getElementById('meal-title-input').value.trim();
    const notes    = document.getElementById('meal-notes-input').value.trim();
    const ingredients = Array.from(document.querySelectorAll('.ingredient-input'))
                             .map(i => i.value.trim()).filter(Boolean);

    if (!title) { showToast('Inserisci il nome del pasto', 'warning'); return; }

    const btn = document.getElementById('btn-meal-save');
    btn.disabled = true;
    btn.textContent = 'Salvataggio…';

    try {
        const res = editingMealId
            ? await api.put('/meals/update.php', { id: editingMealId, title, notes, ingredients })
            : await api.post('/meals/add.php', { date, meal_type: mealType, title, notes, ingredients });

        if (res.success) {
            closeModal('modal-meal');
            showToast(editingMealId ? 'Pasto aggiornato' : 'Pasto aggiunto', 'success');
            await loadMonthMeals();
            renderCalendar();
            renderDayPanel();
        } else {
            showToast(res.message || 'Errore nel salvataggio', 'error');
        }
    } catch {
        showToast('Errore di rete', 'error');
    }

    btn.disabled = false;
    btn.textContent = 'Salva pasto';
}

async function deleteMeal(id) {
    if (!confirm('Eliminare questo pasto?')) return;
    const res = await api.delete('/meals/delete.php', { id });
    if (res.success) {
        showToast('Pasto eliminato', 'success');
        await loadMonthMeals();
        renderCalendar();
        renderDayPanel();
    } else {
        showToast(res.message || 'Errore', 'error');
    }
}

// ---- Ricerca ricette nel modal ----
async function searchRecipesInModal() {
    const query = document.getElementById('recipe-search-input').value.trim();
    if (!query) return;

    const resultsDiv = document.getElementById('recipe-search-results-modal');
    resultsDiv.innerHTML = '<div class="loading"><div class="spinner"></div><span>Ricerca…</span></div>';

    try {
        const res = await api.get(`/recipes/search.php?query=${encodeURIComponent(query)}&number=6`);
        if (!res.success || !res.recipes?.length) {
            resultsDiv.innerHTML = '<p style="color:var(--text-muted); font-size:0.85rem; padding:0.5rem 0;">Nessuna ricetta trovata.</p>';
            return;
        }
        resultsDiv.innerHTML = res.recipes.map(r => `
            <div class="recipe-search-item"
                 data-recipe-id="${r.id}"
                 data-recipe-title="${escapeHtml(r.title)}">
                <img src="${escapeHtml(r.image || '')}" onerror="this.style.display='none'" alt="">
                <span>${escapeHtml(r.title)}</span>
            </div>`).join('');

        resultsDiv.querySelectorAll('.recipe-search-item').forEach(el => {
            el.addEventListener('click', () => {
                selectRecipeForMeal(parseInt(el.dataset.recipeId), el.dataset.recipeTitle);
            });
        });
    } catch {
        resultsDiv.innerHTML = '<p style="color:var(--danger); font-size:0.85rem;">Errore nella ricerca.</p>';
    }
}

async function selectRecipeForMeal(recipeId, recipeTitle) {
    document.getElementById('meal-title-input').value = recipeTitle;
    document.getElementById('recipe-search-results-modal').innerHTML = '';
    document.getElementById('recipe-search-input').value = '';

    // Carica ingredienti dalla ricetta tramite Spoonacular
    try {
        const res = await api.get(`/recipes/ingredients.php?recipe_id=${recipeId}`);
        if (res.success && res.ingredients?.length) {
            document.getElementById('ingredients-list').innerHTML = '';
            res.ingredients.forEach(ing => addIngredientField(ing));
            switchModalTab('manual');
            showToast('Ingredienti caricati dalla ricetta', 'success');
        }
    } catch {
        switchModalTab('manual');
    }
}

// ---- Lista spesa ----
async function generateShoppingList() {
    const start = document.getElementById('shop-start').value;
    const end   = document.getElementById('shop-end').value;

    if (!start || !end) {
        showToast('Seleziona le date di inizio e fine', 'warning');
        return;
    }

    const panel = document.getElementById('shopping-panel');
    panel.classList.remove('hidden');
    panel.innerHTML = '<div class="loading" style="padding:1.5rem;"><div class="spinner"></div><span>Generazione lista…</span></div>';

    try {
        const res = await api.get(`/shopping/generate.php?start=${start}&end=${end}`);

        if (!res.success) {
            panel.innerHTML = `<div class="alert alert-warning">${escapeHtml(res.message || 'Errore')}</div>`;
            return;
        }

        if (!res.missing.length && !res.available.length) {
            panel.innerHTML = `<div class="alert alert-info">${escapeHtml(res.message || 'Nessun ingrediente trovato per il periodo selezionato.')}</div>`;
            return;
        }

        const label = `Periodo: ${formatDate(start)} — ${formatDate(end)}`;

        panel.innerHTML = `
            <div class="shopping-list-header">
                <h3>Lista della spesa</h3>
                <p style="font-size:0.85rem; color:var(--text-light);">${label}</p>
                <div class="shopping-export-actions">
                    <button class="btn btn-outline btn-sm" id="btn-download-shopping">Scarica .txt</button>
                    <button class="btn btn-outline btn-sm" id="btn-print-shopping">Stampa</button>
                </div>
            </div>
            ${res.missing.length ? `
            <div class="shopping-section">
                <div class="shopping-section-title missing">Da comprare (${res.missing.length})</div>
                <ul class="shopping-ul">
                    ${res.missing.map(i => `<li class="shopping-item missing">${escapeHtml(i)}</li>`).join('')}
                </ul>
            </div>` : ''}
            ${res.available.length ? `
            <div class="shopping-section">
                <div class="shopping-section-title available">Già in dispensa (${res.available.length})</div>
                <ul class="shopping-ul">
                    ${res.available.map(i => `<li class="shopping-item available">${escapeHtml(i)}</li>`).join('')}
                </ul>
            </div>` : ''}`;

        document.getElementById('btn-download-shopping')
            .addEventListener('click', () => downloadShoppingList(res.missing, res.available, label));
        document.getElementById('btn-print-shopping')
            .addEventListener('click', () => printShoppingList(res.missing, res.available, label));
    } catch {
        panel.innerHTML = '<div class="alert alert-warning">Errore nella generazione della lista.</div>';
    }
}

function initLogout() {
    document.getElementById('btn-logout')?.addEventListener('click', async () => {
        await api.post('/auth/logout.php');
        window.location.href = 'index.html';
    });
}
