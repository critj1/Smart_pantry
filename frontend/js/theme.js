/**
 * theme.js — Gestione tema chiaro/scuro (condiviso su tutte le pagine)
 * Includere DOPO api.js. Il tema viene applicato prima del render
 * tramite uno script inline nel <head> di ogni pagina.
 */

document.addEventListener('DOMContentLoaded', function () {
    // Sincronizza l'icona con il tema già applicato dall'inline script
    syncThemeIcon();

    // Attiva il click sul pulsante toggle (presente in ogni pagina)
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.addEventListener('click', toggleTheme);
});

/** Legge il tema corrente e aggiorna l'icona */
function syncThemeIcon() {
    const theme = document.documentElement.getAttribute('data-theme') || 'light';
    const icon  = document.getElementById('theme-icon');
    if (icon) icon.textContent = theme === 'dark' ? '🍌' : '🥑';
}

/** Alterna tra chiaro e scuro con animazione sull'icona */
function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next    = current === 'dark' ? 'light' : 'dark';
    const icon    = document.getElementById('theme-icon');

    if (icon) {
        icon.style.transition = 'transform 0.18s ease';
        icon.style.transform  = 'rotate(360deg) scale(0)';
        setTimeout(() => {
            applyTheme(next);
            icon.style.transition = 'none';
            icon.style.transform  = 'scale(1)';
            requestAnimationFrame(() => { icon.style.transition = ''; });
        }, 180);
    } else {
        applyTheme(next);
    }
}

/** Applica il tema all'elemento <html> e lo salva in localStorage */
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('sp-theme', theme);
    const icon = document.getElementById('theme-icon');
    if (icon) icon.textContent = theme === 'dark' ? '🍌' : '🥑';
}
