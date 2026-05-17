/**
 * scanner.js — Scanner barcode + ricerca per nome OpenFoodFacts
 */

let html5QrCode   = null;
let isScanning    = false;
let scannedProduct = null;

document.addEventListener('DOMContentLoaded', async () => {
    const user = await requireLogin();
    if (!user) return;

    document.getElementById('sidebar-username').textContent = user.username;
    document.getElementById('sidebar-avatar').textContent   = user.username[0].toUpperCase();

    initSidebar();
    initLogout();

    const readOnly = user.active_context?.type === 'group' && user.active_context?.role === 'member';
    if (readOnly) {
        const content = document.querySelector('.page-content');
        if (content) {
            content.innerHTML = `
                <div class="page-intro"><h2>Aggiungi prodotto</h2></div>
                <div class="alert alert-info" style="font-size:0.95rem; padding:1.25rem 1.5rem;">
                    <strong>👁️ Accesso in sola lettura</strong><br>
                    Stai visualizzando la dispensa del gruppo come <strong>membro</strong>.
                    Solo gli admin possono aggiungere prodotti al gruppo.<br><br>
                    <a href="pantry.html" class="btn btn-primary" style="margin-top:0.5rem;">Vai alla dispensa</a>
                </div>`;
        }
        return;
    }

    initScannerTabs();
    initBarcodeScanner();
    initManualBarcodeInput();
    initNameSearch();
});

// ============================================================
// TAB: BARCODE / CERCA PER NOME
// ============================================================

function initScannerTabs() {
    document.querySelectorAll('.scanner-tab').forEach(btn => {
        btn.addEventListener('click', async () => {
            const tab = btn.dataset.tab;
            document.querySelectorAll('.scanner-tab').forEach(b => b.classList.toggle('active', b === btn));
            document.getElementById('section-barcode').classList.toggle('hidden', tab !== 'barcode');
            document.getElementById('section-name').classList.toggle('hidden',    tab !== 'name');

            // Ferma la fotocamera se si cambia tab
            if (tab !== 'barcode' && isScanning) await stopScanning();
        });
    });
}

// ============================================================
// SCANNER BARCODE (fotocamera)
// ============================================================

function initBarcodeScanner() {
    document.getElementById('btn-start-scan')?.addEventListener('click', startScanning);
    document.getElementById('btn-stop-scan')?.addEventListener('click',  stopScanning);
}

async function startScanning() {
    setScanUiState('scanning');
    try {
        html5QrCode = new Html5Qrcode('reader');
        const config = {
            fps: 10,
            qrbox: { width: 260, height: 160 },
            aspectRatio: 1.6,
            formatsToSupport: [
                Html5QrcodeSupportedFormats.EAN_13, Html5QrcodeSupportedFormats.EAN_8,
                Html5QrcodeSupportedFormats.UPC_A,  Html5QrcodeSupportedFormats.UPC_E,
                Html5QrcodeSupportedFormats.CODE_128, Html5QrcodeSupportedFormats.CODE_39,
            ]
        };
        await html5QrCode.start({ facingMode: 'environment' }, config, onBarcodeDetected, null);
        isScanning = true;
    } catch {
        showToast('Impossibile accedere alla fotocamera. Usa il barcode manuale o la ricerca per nome.', 'warning');
        setScanUiState('idle');
    }
}

async function stopScanning() {
    if (html5QrCode && isScanning) {
        try { await html5QrCode.stop(); html5QrCode.clear(); } catch {}
        isScanning = false;
    }
    setScanUiState('idle');
}

async function onBarcodeDetected(barcode) {
    if (!isScanning) return;
    await stopScanning();
    showToast(`Barcode: ${barcode}`, 'info');
    await lookupBarcode(barcode);
}

function initManualBarcodeInput() {
    document.getElementById('form-manual-barcode')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const barcode = document.getElementById('manual-barcode')?.value?.trim();
        if (barcode) await lookupBarcode(barcode);
    });
}

async function lookupBarcode(barcode) {
    setScanUiState('loading');
    hideResultSection();

    try {
        const res = await api.get(`/barcode/lookup.php?barcode=${encodeURIComponent(barcode)}`);

        if (res.success) {
            showProductResult(res.product, barcode, 'barcode');
            setScanUiState('found');
            showToast('Prodotto trovato!', 'success');
        } else {
            showBarcodeNotFound(barcode);
            setScanUiState('not-found');
        }
    } catch {
        showToast('Errore di connessione', 'error');
        setScanUiState('idle');
    }
}

function showBarcodeNotFound(barcode) {
    const section = document.getElementById('result-section');
    section.classList.remove('hidden');
    section.innerHTML = `
        <div class="alert alert-warning">
            <span class="alert-icon">⚠️</span>
            <div>Prodotto non trovato per il barcode <code>${escapeHtml(barcode)}</code>.
            Prova a cercarlo per nome nella tab <strong>"Cerca per nome"</strong>.</div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="switchToNameTab()">🔍 Cerca per nome →</button>`;
}

function switchToNameTab() {
    document.querySelectorAll('.scanner-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === 'name'));
    document.getElementById('section-barcode').classList.add('hidden');
    document.getElementById('section-name').classList.remove('hidden');
    document.getElementById('name-search-input').focus();
}

function setScanUiState(state) {
    const startBtn     = document.getElementById('btn-start-scan');
    const stopBtn      = document.getElementById('btn-stop-scan');
    const statusEl     = document.getElementById('scan-status');
    const loadingEl    = document.getElementById('scan-loading');
    const placeholder  = document.getElementById('cam-placeholder');
    const readerEl     = document.getElementById('reader');

    stopBtn?.classList.add('hidden');
    loadingEl?.classList.add('hidden');

    switch (state) {
        case 'scanning':
            startBtn?.classList.add('hidden');
            stopBtn?.classList.remove('hidden');
            if (placeholder) placeholder.style.display = 'none';
            if (readerEl) readerEl.style.display = 'block';
            if (statusEl) statusEl.textContent = '🎥 Punta la fotocamera sul barcode…';
            break;
        case 'loading':
            startBtn?.classList.add('hidden');
            loadingEl?.classList.remove('hidden');
            if (placeholder) placeholder.style.display = 'none';
            if (readerEl) readerEl.style.display = 'none';
            if (statusEl) statusEl.textContent = '🔍 Ricerca prodotto…';
            break;
        default:
            startBtn?.classList.remove('hidden');
            if (placeholder) placeholder.style.display = 'flex';
            if (readerEl) readerEl.style.display = 'none';
            if (statusEl) statusEl.textContent = '';
    }
}

// ============================================================
// RICERCA PER NOME (OpenFoodFacts)
// ============================================================

function initNameSearch() {
    const btn   = document.getElementById('btn-name-search');
    const input = document.getElementById('name-search-input');

    btn?.addEventListener('click',   () => searchByName());
    input?.addEventListener('keydown', e => { if (e.key === 'Enter') searchByName(); });
}

async function searchByName() {
    const query = document.getElementById('name-search-input')?.value?.trim();
    if (!query) return;

    const loader  = document.getElementById('name-search-loader');
    const results = document.getElementById('name-search-results');
    const btn     = document.getElementById('btn-name-search');

    loader.classList.remove('hidden');
    results.classList.add('hidden');
    results.innerHTML = '';
    hideResultSection();
    if (btn) { btn.disabled = true; btn.textContent = '…'; }

    try {
        const res = await api.get(`/barcode/search_by_name.php?name=${encodeURIComponent(query)}`);
        loader.classList.add('hidden');

        if (res.success && res.products.length > 0) {
            renderNameResults(res.products, results);
            results.classList.remove('hidden');
        } else {
            results.innerHTML = `
                <div class="alert alert-warning" style="margin-top:0.5rem;">
                    <span class="alert-icon">⚠️</span>
                    <div>Nessun prodotto trovato per <strong>"${escapeHtml(query)}"</strong>.<br>
                    Prova con un termine diverso oppure vai alla dispensa per l'inserimento manuale.</div>
                </div>
                <a href="pantry.html" class="btn btn-secondary btn-sm" style="margin-top:0.5rem;">Vai alla dispensa</a>`;
            results.classList.remove('hidden');
        }
    } catch {
        loader.classList.add('hidden');
        showToast('Errore durante la ricerca', 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Cerca'; }
    }
}

function renderNameResults(products, container) {
    container.innerHTML = `<p style="font-size:0.82rem; color:var(--text-light); margin-bottom:0.5rem;">
        ${products.length} prodott${products.length === 1 ? 'o trovato' : 'i trovati'} — seleziona quello giusto:
    </p>`;

    products.forEach((p, idx) => {
        const item = document.createElement('div');
        item.className = 'product-result-item';
        item.innerHTML = `
            ${p.image_url
                ? `<img class="product-result-img" src="${escapeHtml(p.image_url)}" alt="" onerror="this.style.display='none'">`
                : `<div class="product-result-placeholder">🥫</div>`}
            <div class="product-result-info">
                <div class="product-result-name">${escapeHtml(p.name)}</div>
                <div class="product-result-brand">
                    ${p.brand ? escapeHtml(p.brand) : 'Marca sconosciuta'}
                    ${p.barcode ? ` · ${escapeHtml(p.barcode)}` : ''}
                    ${p.calories_per_100g ? ` · ${p.calories_per_100g} kcal/100g` : ''}
                </div>
            </div>
            <span style="color:var(--primary); font-size:1.2rem;">›</span>`;

        item.addEventListener('click', () => {
            container.querySelectorAll('.product-result-item').forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');
            showProductResult(p, p.barcode || p.name, 'name');
        });

        container.appendChild(item);
    });
}

// ============================================================
// FORM AGGIUNTA (condiviso tra barcode e ricerca per nome)
// ============================================================

function showProductResult(product, identifier, source) {
    scannedProduct = product;
    const section = document.getElementById('result-section');
    section.classList.remove('hidden');

    const imgHtml = product.image_url
        ? `<img class="product-preview-img" src="${escapeHtml(product.image_url)}" alt=""
               onerror="this.style.display='none'">`
        : `<div style="width:80px;height:80px;background:var(--green-100);border-radius:8px;
                       display:flex;align-items:center;justify-content:center;font-size:2.2rem;flex-shrink:0;">🥫</div>`;

    const nutritionHtml = buildNutritionPanel(product);

    // Opzioni categoria per il select
    const catOptions = '<option value="">— seleziona —</option>' + buildCategoryOptions(guessCategory(product));

    section.innerHTML = `
        <div class="card">
            <div class="card-header">
                <span>✅</span><span class="card-title">Prodotto trovato</span>
                <span class="badge badge-green" style="font-size:0.75rem;">${source === 'barcode' ? '📷 Barcode' : '🔍 Ricerca nome'}</span>
            </div>
            <div class="card-body">
                <div class="product-preview" style="margin-bottom:1rem;">
                    ${imgHtml}
                    <div class="product-preview-info">
                        <h3>${escapeHtml(product.name)}</h3>
                        ${product.brand ? `<div class="brand">${escapeHtml(product.brand)}</div>` : ''}
                        ${product.barcode ? `<span class="badge badge-blue" style="margin-top:0.3rem;">${escapeHtml(product.barcode)}</span>` : ''}
                    </div>
                </div>
                ${nutritionHtml}
                <hr style="margin:1rem 0;border:none;border-top:1px solid var(--border-light);">
                <h4 style="margin-bottom:1rem; font-size:0.95rem;">Aggiungi alla dispensa</h4>
                <form id="form-scan-add">
                    <div class="form-group">
                        <label class="form-label" for="scan-category">Categoria *</label>
                        <select class="form-control" id="scan-category" required>${catOptions}</select>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label" for="scan-quantity">Quantità</label>
                            <input class="form-control" type="number" id="scan-quantity" value="1" min="0.1" step="0.1" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="scan-unit">Unità</label>
                            <select class="form-control" id="scan-unit">
                                <option value="pz">pezzi</option>
                                <option value="g">grammi</option>
                                <option value="kg">kg</option>
                                <option value="ml">ml</option>
                                <option value="l">litri</option>
                                <option value="conf">confezioni</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="scan-expiry">Data scadenza</label>
                        <input class="form-control" type="date" id="scan-expiry">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="scan-location">Posizione</label>
                        <select class="form-control" id="scan-location">
                            <option value="">— seleziona —</option>
                            <option value="dispensa">Dispensa</option>
                            <option value="frigo">Frigo</option>
                            <option value="freezer">Freezer</option>
                            <option value="cantina">Cantina</option>
                        </select>
                    </div>
                    <div style="display:flex; gap:0.75rem; margin-top:0.5rem;">
                        <button type="submit" class="btn btn-primary" style="flex:1;" id="btn-scan-submit">
                            ✓ Aggiungi alla dispensa
                        </button>
                        <button type="button" class="btn btn-secondary" onclick="resetResult()">✕</button>
                    </div>
                </form>
            </div>
        </div>`;

    section.querySelector('#form-scan-add')?.addEventListener('submit', handleScanAdd);
}

/** Indovina la categoria dal campo of_category del prodotto */
function guessCategory(product) {
    if (!product) return '';
    const ofCat = (product.of_category || '').toLowerCase();
    if (!ofCat) return '';

    const map = {
        lait:'latticini', milk:'latticini', dairy:'latticini', fromage:'latticini',
        cheese:'latticini', yogurt:'latticini', cream:'latticini',
        vegetable:'verdura', salad:'verdura', legume:'verdura',
        fruit:'frutta', fruits:'frutta',
        meat:'carne', chicken:'carne', beef:'carne', poultry:'carne',
        fish:'pesce', seafood:'pesce',
        pasta:'cereali', rice:'cereali', bread:'cereali', cereal:'cereali',
        frozen:'surgelati', surgel:'surgelati',
        beverage:'bevande', drink:'bevande', juice:'bevande', water:'bevande',
        sauce:'condimenti', oil:'condimenti', spice:'condimenti', vinegar:'condimenti',
        snack:'snack', biscuit:'snack', cookie:'snack', chocolate:'snack', sweet:'snack',
        canned:'conserve', conserv:'conserve',
    };

    for (const [kw, cat] of Object.entries(map)) {
        if (ofCat.includes(kw)) return cat;
    }
    return '';
}

async function handleScanAdd(e) {
    e.preventDefault();
    if (!scannedProduct) return;

    const category = document.getElementById('scan-category').value;
    if (!category) { showToast('Seleziona una categoria', 'warning'); return; }

    const data = {
        name:               scannedProduct.name,
        brand:              scannedProduct.brand     || null,
        barcode:            scannedProduct.barcode   || null,
        image_url:          scannedProduct.image_url || null,
        category,
        quantity:           parseFloat(document.getElementById('scan-quantity').value) || 1,
        unit:               document.getElementById('scan-unit').value     || 'pz',
        expiry_date:        document.getElementById('scan-expiry').value   || null,
        location:           document.getElementById('scan-location').value || null,
        calories_per_100g:  scannedProduct.calories_per_100g ?? null,
        proteins_per_100g:  scannedProduct.proteins_per_100g ?? null,
        carbs_per_100g:     scannedProduct.carbs_per_100g    ?? null,
        fats_per_100g:      scannedProduct.fats_per_100g     ?? null,
        fiber_per_100g:     scannedProduct.fiber_per_100g    ?? null,
        salt_per_100g:      scannedProduct.salt_per_100g     ?? null,
    };

    const btn = document.getElementById('btn-scan-submit');
    if (btn) { btn.disabled = true; btn.textContent = 'Aggiungendo…'; }

    try {
        const res = await api.post('/pantry/add.php', data);
        if (res.success) {
            showToast('Prodotto aggiunto alla dispensa!', 'success');
            resetResult();
            // Torna allo stato iniziale: tab barcode, campi e risultati puliti
            document.getElementById('manual-barcode').value    = '';
            document.getElementById('name-search-input').value = '';
            const nameResults = document.getElementById('name-search-results');
            if (nameResults) { nameResults.innerHTML = ''; nameResults.classList.add('hidden'); }
            document.querySelectorAll('.scanner-tab').forEach(b =>
                b.classList.toggle('active', b.dataset.tab === 'barcode'));
            document.getElementById('section-barcode').classList.remove('hidden');
            document.getElementById('section-name').classList.add('hidden');
        } else {
            showToast(res.message || 'Errore', 'error');
            if (btn) { btn.disabled = false; btn.textContent = '✓ Aggiungi alla dispensa'; }
        }
    } catch {
        showToast('Errore di connessione', 'error');
        if (btn) { btn.disabled = false; btn.textContent = '✓ Aggiungi alla dispensa'; }
    }
}

function resetResult() {
    scannedProduct = null;
    hideResultSection();
    setScanUiState('idle');
}

function hideResultSection() {
    const section = document.getElementById('result-section');
    section.classList.add('hidden');
    section.innerHTML = '';
}

function initLogout() {
    document.getElementById('btn-logout')?.addEventListener('click', async () => {
        await api.post('/auth/logout.php');
        window.location.href = 'index.html';
    });
}
