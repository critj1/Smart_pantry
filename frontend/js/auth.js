/**
 * auth.js — Logica pagina login e registrazione
 */

document.addEventListener('DOMContentLoaded', async () => {
    // Se l'utente è già loggato, reindirizza alla dashboard
    const user = await getCurrentUser();
    if (user) {
        window.location.href = 'dashboard.html';
        return;
    }

    initTabs();
    initLoginForm();
    initRegisterForm();
});

/** Gestisce il cambio tra tab Login e Registrazione */
function initTabs() {
    const tabs  = document.querySelectorAll('.auth-tab');
    const forms = document.querySelectorAll('.auth-form');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;

            tabs.forEach(t  => t.classList.remove('active'));
            forms.forEach(f => f.classList.add('hidden'));

            tab.classList.add('active');
            const targetForm = document.getElementById(`form-${target}`);
            if (targetForm) targetForm.classList.remove('hidden');

            // Pulisce gli errori quando si cambia tab
            clearErrors();
        });
    });
}

/** Gestisce il form di login */
function initLoginForm() {
    const form = document.getElementById('form-login');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearErrors();

        const email    = form.querySelector('#login-email').value.trim();
        const password = form.querySelector('#login-password').value;

        if (!email || !password) {
            showFormError('login', 'Compila tutti i campi');
            return;
        }

        const btn = form.querySelector('button[type="submit"]');
        setButtonLoading(btn, true);

        try {
            const res = await api.post('/auth/login.php', { email, password });

            if (res.success) {
                showToast('Accesso effettuato!', 'success');
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 500);
            } else {
                showFormError('login', res.message || 'Credenziali non valide');
            }
        } catch (err) {
            showFormError('login', 'Errore di connessione. Riprova.');
        } finally {
            setButtonLoading(btn, false);
        }
    });
}

/** Gestisce il form di registrazione */
function initRegisterForm() {
    const form = document.getElementById('form-register');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearErrors();

        const username = form.querySelector('#reg-username').value.trim();
        const email    = form.querySelector('#reg-email').value.trim();
        const password = form.querySelector('#reg-password').value;
        const confirm  = form.querySelector('#reg-confirm').value;

        // Validazione lato client
        if (!username || !email || !password || !confirm) {
            showFormError('register', 'Compila tutti i campi');
            return;
        }

        if (password !== confirm) {
            showFormError('register', 'Le password non coincidono');
            return;
        }

        if (password.length < 6) {
            showFormError('register', 'La password deve essere di almeno 6 caratteri');
            return;
        }

        const btn = form.querySelector('button[type="submit"]');
        setButtonLoading(btn, true);

        try {
            const res = await api.post('/auth/register.php', { username, email, password });

            if (res.success) {
                showToast('Registrazione completata!', 'success');
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 600);
            } else {
                showFormError('register', res.message || 'Errore durante la registrazione');
            }
        } catch (err) {
            showFormError('register', 'Errore di connessione. Riprova.');
        } finally {
            setButtonLoading(btn, false);
        }
    });
}

/** Mostra un messaggio di errore nel form specificato */
function showFormError(formName, message) {
    const errorEl = document.getElementById(`error-${formName}`);
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.remove('hidden');
    }
}

/** Pulisce tutti i messaggi di errore */
function clearErrors() {
    document.querySelectorAll('.form-error').forEach(el => {
        el.textContent = '';
        el.classList.add('hidden');
    });
}

/** Imposta lo stato di caricamento di un bottone */
function setButtonLoading(btn, loading) {
    if (!btn) return;
    btn.disabled = loading;
    // Supporta sia i nuovi auth-btn-primary (con spinner CSS) che i btn generici
    if (btn.classList.contains('auth-btn-primary')) {
        btn.classList.toggle('loading', loading);
    } else {
        btn.dataset.originalText = btn.dataset.originalText || btn.textContent;
        btn.textContent = loading ? 'Caricamento...' : btn.dataset.originalText;
    }
}
