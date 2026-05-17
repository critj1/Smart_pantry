/**
 * supermercati.js — Mappa negozi vicini con Leaflet + Overpass API
 */

let map            = null;
let userMarker     = null;
let storeMarkers   = [];
let userPos        = null;
let currentRadius  = 1500; // metri
let mapInitialized = false;

document.addEventListener('DOMContentLoaded', async () => {
    const user = await requireLogin();
    if (!user) return;

    const usernameEl = document.getElementById('sidebar-username');
    if (usernameEl) usernameEl.textContent = user.username;
    const avatarEl = document.getElementById('sidebar-avatar');
    if (avatarEl) avatarEl.textContent = user.username[0].toUpperCase();

    initSidebar();
    initLogout();
    initRadiusButtons();
    requestLocation();
});

// ============================================================
// GEOLOCALIZZAZIONE
// ============================================================

function requestLocation() {
    if (!navigator.geolocation) {
        setStatus('❌', 'Il tuo browser non supporta la geolocalizzazione.', 'error');
        showMapError('Geolocalizzazione non supportata dal browser.');
        return;
    }

    setStatus('⏳', 'Richiesta posizione in corso…');

    navigator.geolocation.getCurrentPosition(
        onLocationSuccess,
        onLocationError,
        { timeout: 12000, maximumAge: 120000, enableHighAccuracy: false }
    );
}

function onLocationSuccess(position) {
    userPos = {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
    };

    setStatus('📍', 'Posizione trovata — inizializzazione mappa…');
    initLeafletMap();
}

function onLocationError(err) {
    let msg = 'Impossibile ottenere la posizione.';
    if (err.code === 1) msg = 'Permesso negato. Attiva la geolocalizzazione nel browser e ricarica.';
    if (err.code === 3) msg = 'Timeout — la posizione non è stata trovata in tempo.';
    setStatus('❌', msg, 'error');
    showMapError(msg);
}

// ============================================================
// LEAFLET MAP
// ============================================================

function initLeafletMap() {
    // Svuota il div dal loader
    const container = document.getElementById('map-container');
    container.innerHTML = '';

    map = L.map('map-container', {
        center: [userPos.lat, userPos.lon],
        zoom: 15,
        zoomControl: true,
        attributionControl: true,
    });

    // Tile layer CartoDB Voyager (moderno, ottimo su tutti i dispositivi)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
    }).addTo(map);

    // Marker utente (punto verde pulsante)
    const userIcon = L.divIcon({
        className: '',
        html: '<div class="user-marker-pulse"><div class="user-marker-dot"></div></div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
    });

    userMarker = L.marker([userPos.lat, userPos.lon], { icon: userIcon, zIndexOffset: 1000 })
        .addTo(map)
        .bindPopup('<strong style="font-size:0.92rem;">📍 Sei qui</strong>');

    // Cerchio raggio visivo
    L.circle([userPos.lat, userPos.lon], {
        radius: currentRadius,
        color: '#16a34a',
        fillColor: '#16a34a',
        fillOpacity: 0.04,
        weight: 1.5,
        dashArray: '5,6',
    }).addTo(map);

    mapInitialized = true;

    setStatus('🔍', 'Ricerca supermercati in corso…');
    loadNearbyStores();
}

// ============================================================
// OVERPASS API — Cerca negozi alimentari
// ============================================================

async function loadNearbyStores() {
    clearStoreMarkers();

    // Query Overpass: supermercati, minimarket, negozi alimentari
    const query = `
[out:json][timeout:18];
(
  node["shop"~"supermarket|grocery|convenience|department_store|wholesale|food"](around:${currentRadius},${userPos.lat},${userPos.lon});
  way["shop"~"supermarket|grocery|convenience|department_store|wholesale|food"](around:${currentRadius},${userPos.lat},${userPos.lon});
);
out center body;
    `.trim();

    try {
        const response = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'data=' + encodeURIComponent(query),
        });

        if (!response.ok) throw new Error('Overpass API error ' + response.status);
        const data = await response.json();
        renderStores(data.elements || []);

    } catch (err) {
        setStatus('❌', 'Errore nel caricamento dei negozi. Riprova.', 'error');
        showToast('Impossibile contattare Overpass API', 'error');
        const list = document.getElementById('stores-list');
        if (list) list.innerHTML = `<p style="color:var(--text-light); text-align:center; padding:2rem 1rem;">Errore nel caricamento. <button class="btn btn-primary btn-sm" style="margin-left:0.5rem;" onclick="loadNearbyStores()">Riprova</button></p>`;
    }
}

// ============================================================
// RENDERING MARKERS + LISTA
// ============================================================

function renderStores(elements) {
    const list   = document.getElementById('stores-list');
    const panel  = document.getElementById('stores-panel');
    const countEl = document.getElementById('stores-count');

    if (!elements.length) {
        setStatus('⚠️', `Nessun negozio trovato entro ${formatRadius(currentRadius)}.`);
        panel.style.display = 'block';
        list.innerHTML = `
            <div style="text-align:center; padding:2.5rem 1rem; color:var(--text-light);">
                <div style="font-size:2.5rem;">🏪</div>
                <p style="margin-top:0.75rem;">Nessun negozio trovato in questo raggio.<br>
                <button class="btn btn-outline btn-sm" style="margin-top:0.75rem;"
                    onclick="changeRadius(5000)">Prova con 5 km</button></p>
            </div>`;
        return;
    }

    // Normalizza e calcola distanze
    const stores = elements
        .map(el => {
            const lat  = el.lat  ?? el.center?.lat;
            const lon  = el.lon  ?? el.center?.lon;
            if (!lat || !lon) return null;

            const name = el.tags?.name || el.tags?.brand || labelByType(el.tags?.shop);
            const addr = buildAddress(el.tags);
            const dist = haversine(userPos.lat, userPos.lon, lat, lon);
            const type = el.tags?.shop || 'store';

            return { name, addr, lat, lon, dist, type };
        })
        .filter(Boolean)
        .sort((a, b) => a.dist - b.dist);

    setStatus('✅', `${stores.length} negoz${stores.length === 1 ? 'io trovato' : 'i trovati'} entro ${formatRadius(currentRadius)}.`);

    if (countEl) countEl.textContent = `${stores.length} negoz${stores.length === 1 ? 'io' : 'i'} trovati`;
    panel.style.display = 'block';

    // ---- Markers sulla mappa ----
    stores.forEach((s, idx) => {
        const icon = L.divIcon({
            className: '',
            html: `<div class="store-marker" title="${escapeHtml(s.name)}">${emojiByType(s.type)}</div>`,
            iconSize: [34, 34],
            iconAnchor: [17, 17],
        });

        const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.name + ' ' + s.addr)}&ll=${s.lat},${s.lon}`;
        const osmUrl   = `https://www.openstreetmap.org/?mlat=${s.lat}&mlon=${s.lon}&zoom=18`;

        const marker = L.marker([s.lat, s.lon], { icon })
            .addTo(map)
            .bindPopup(buildPopupHtml(s, gmapsUrl, osmUrl), { maxWidth: 240 });

        storeMarkers.push(marker);
    });

    // ---- Lista ----
    list.innerHTML = stores.slice(0, 25).map((s, idx) => {
        const distLabel = formatDist(s.dist);
        const gmapsUrl  = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.name + ' ' + s.addr)}&ll=${s.lat},${s.lon}`;

        return `
            <div class="store-row" onclick="flyTo(${s.lat}, ${s.lon})">
                <div class="store-emoji">${emojiByType(s.type)}</div>
                <div class="store-info">
                    <div class="store-name">${escapeHtml(s.name)}</div>
                    ${s.addr ? `<div class="store-addr">${escapeHtml(s.addr)}</div>` : ''}
                    <div class="store-type">${labelByType(s.type)}</div>
                </div>
                <div class="store-right">
                    <span class="store-dist">${distLabel}</span>
                    <a href="${gmapsUrl}" target="_blank" rel="noopener noreferrer"
                       class="btn btn-primary btn-sm"
                       onclick="event.stopPropagation()">Apri →</a>
                </div>
            </div>`;
    }).join('');
}

function buildPopupHtml(s, gmapsUrl, osmUrl) {
    return `
        <div style="font-family:system-ui,sans-serif; min-width:180px; max-width:220px;">
            <div style="font-weight:700; font-size:0.95rem; margin-bottom:0.2rem;">${escapeHtml(s.name)}</div>
            ${s.addr ? `<div style="font-size:0.80rem; color:#555; margin-bottom:0.2rem;">${escapeHtml(s.addr)}</div>` : ''}
            <div style="font-size:0.75rem; color:#888; margin-bottom:0.55rem;">${formatDist(s.dist)} · ${labelByType(s.type)}</div>
            <div style="display:flex; gap:0.4rem;">
                <a href="${gmapsUrl}" target="_blank" rel="noopener noreferrer"
                   style="flex:1; text-align:center; background:#16a34a; color:#fff; padding:0.35rem 0; border-radius:20px; font-size:0.78rem; font-weight:700; text-decoration:none;">
                   Google Maps
                </a>
                <a href="${osmUrl}" target="_blank" rel="noopener noreferrer"
                   style="flex:1; text-align:center; background:#3b82f6; color:#fff; padding:0.35rem 0; border-radius:20px; font-size:0.78rem; font-weight:700; text-decoration:none;">
                   OSM
                </a>
            </div>
        </div>`;
}

// ============================================================
// RAGGIO — Aggiorna ricerca
// ============================================================

function initRadiusButtons() {
    document.querySelectorAll('.radius-controls .filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const r = parseInt(btn.dataset.radius);
            changeRadius(r);
        });
    });
}

function changeRadius(r) {
    currentRadius = r;

    // Aggiorna pulsanti
    document.querySelectorAll('.radius-controls .filter-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.radius) === r);
    });

    if (!mapInitialized || !userPos) return;

    // Rimuovi cerchio precedente e ricrea
    map.eachLayer(layer => {
        if (layer instanceof L.Circle) map.removeLayer(layer);
    });

    L.circle([userPos.lat, userPos.lon], {
        radius: currentRadius,
        color: '#16a34a',
        fillColor: '#16a34a',
        fillOpacity: 0.04,
        weight: 1.5,
        dashArray: '5,6',
    }).addTo(map);

    // Adatta zoom al raggio
    const corner1 = L.latLng(userPos.lat - r / 111320, userPos.lon - r / (111320 * Math.cos(userPos.lat * Math.PI / 180)));
    const corner2 = L.latLng(userPos.lat + r / 111320, userPos.lon + r / (111320 * Math.cos(userPos.lat * Math.PI / 180)));
    map.fitBounds(L.latLngBounds(corner1, corner2), { padding: [30, 30] });

    setStatus('🔍', 'Ricerca negozi in corso…');
    loadNearbyStores();
}

function flyTo(lat, lon) {
    if (!map) return;
    map.flyTo([lat, lon], 17, { duration: 1.0 });
}

function clearStoreMarkers() {
    storeMarkers.forEach(m => map && map.removeLayer(m));
    storeMarkers = [];
}

// ============================================================
// UTILITY
// ============================================================

function haversine(lat1, lon1, lat2, lon2) {
    const R    = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a    = Math.sin(dLat / 2) ** 2
               + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDist(m) {
    return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

function formatRadius(m) {
    return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
}

function buildAddress(tags) {
    if (!tags) return '';
    return [tags['addr:street'], tags['addr:housenumber'], tags['addr:city']]
        .filter(Boolean).join(' ');
}

function emojiByType(type) {
    const map = {
        supermarket: '🏪',
        grocery: '🥦',
        convenience: '🏬',
        department_store: '🏢',
        wholesale: '📦',
        food: '🛒',
    };
    return map[type] || '🛒';
}

function labelByType(type) {
    const map = {
        supermarket: 'Supermercato',
        grocery: 'Negozio alimentari',
        convenience: 'Minimarket',
        department_store: 'Grande magazzino',
        wholesale: 'Ingrosso',
        food: 'Negozio alimentari',
    };
    return map[type] || 'Negozio';
}

function setStatus(icon, text, type = 'info') {
    const iconEl = document.getElementById('status-icon');
    const textEl = document.getElementById('status-text');
    const bar    = document.getElementById('location-status');
    if (iconEl) iconEl.textContent = icon;
    if (textEl) textEl.textContent = text;
    if (bar) {
        bar.style.borderColor = type === 'error' ? 'rgba(239,68,68,0.3)' : '';
        bar.style.background  = type === 'error' ? 'rgba(239,68,68,0.08)' : '';
        bar.style.color       = type === 'error' ? 'var(--danger)' : '';
    }
}

function showMapError(msg) {
    const el = document.getElementById('map-container');
    if (!el) return;
    el.innerHTML = `
        <div style="height:100%; display:flex; align-items:center; justify-content:center;
                    flex-direction:column; gap:1rem; color:var(--text-light); padding:2rem; text-align:center;">
            <div style="font-size:3rem;">📍</div>
            <p style="max-width:280px;">${escapeHtml(msg)}</p>
            <button class="btn btn-primary" onclick="requestLocation()">Riprova</button>
        </div>`;
}

function initLogout() {
    document.getElementById('btn-logout')?.addEventListener('click', async () => {
        await api.post('/auth/logout.php');
        window.location.href = 'index.html';
    });
}
