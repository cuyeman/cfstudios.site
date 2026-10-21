/**
 * src/beta-gate.js
 * Beta privada del Prólogo: el juego solo se carga al hacer clic e ingresar la clave del día.
 * La clave la valida el Worker de Cloudflare (beta-worker/) en /beta/unlock, que deja una
 * cookie válida hasta medianoche (hora de Chile). Con esa cookie el iframe puede abrir /beta/game/.
 */
document.addEventListener('DOMContentLoaded', () => {
    const playBtn = document.getElementById('betaPlayBtn');
    const form = document.getElementById('betaForm');
    const input = document.getElementById('betaPassword');
    const errorEl = document.getElementById('betaError');
    const embed = document.getElementById('prologueEmbed');

    if (!playBtn || !form || !embed) return;

    const GAME_URL = '/beta/game/';

    // Textos dinámicos: usa el idioma activo de i18n.js y cae al español si falta la llave.
    const fallback = {
        beta_error_wrong: 'Clave incorrecta o vencida. Revisa la clave de hoy en Discord.',
        beta_error_captcha: 'Completa la verificación antes de entrar.',
        beta_error_network: 'No pudimos conectar con el servidor. Intenta de nuevo.',
        beta_fullscreen: 'Pantalla completa'
    };
    const t = (key) => window.activeLocale?.landing?.[key] || fallback[key];

    function showError(key) {
        errorEl.textContent = t(key);
        errorEl.dataset.key = key;
        errorEl.hidden = false;
    }

    function loadGame() {
        embed.innerHTML = '';

        const iframe = document.createElement('iframe');
        iframe.id = 'prologueIframe';
        iframe.src = GAME_URL;
        iframe.title = 'Bram: La Luz que se Apaga';
        iframe.allow = 'fullscreen; autoplay; gamepad';

        const fullscreenBtn = document.createElement('button');
        fullscreenBtn.type = 'button';
        fullscreenBtn.id = 'embedFullscreenBtn';
        fullscreenBtn.className = 'embed-fullscreen-btn';
        fullscreenBtn.textContent = '⛶ ' + t('beta_fullscreen');

        embed.append(fullscreenBtn, iframe);
        form.hidden = true;
        playBtn.hidden = true;
        embed.scrollIntoView({ behavior: 'smooth', block: 'center' });

        if (typeof gtag === 'function') gtag('event', 'beta_game_loaded');
    }

    async function alreadyUnlocked() {
        try {
            const response = await fetch('/beta/status', { credentials: 'same-origin' });
            if (!response.ok) return false;
            return (await response.json()).unlocked === true;
        } catch {
            return false;
        }
    }

    playBtn.addEventListener('click', async () => {
        // Si ya ingresó la clave hoy, el juego carga directo sin volver a pedirla.
        if (await alreadyUnlocked()) {
            loadGame();
            return;
        }
        form.hidden = false;
        playBtn.hidden = true;
        input.focus();
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        errorEl.hidden = true;

        const token = form.querySelector('[name="cf-turnstile-response"]')?.value;
        if (!token) {
            showError('beta_error_captcha');
            return;
        }

        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;

        try {
            const response = await fetch('/beta/unlock', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: input.value, token })
            });
            const result = await response.json().catch(() => ({}));

            if (result.ok) {
                if (typeof gtag === 'function') gtag('event', 'beta_unlock');
                loadGame();
                return;
            }

            showError(result.error === 'captcha' ? 'beta_error_captcha' : 'beta_error_wrong');
            if (typeof gtag === 'function') gtag('event', 'beta_unlock_failed');
        } catch {
            showError('beta_error_network');
        } finally {
            submitBtn.disabled = false;
            // Cada token de Turnstile sirve una sola vez.
            if (window.turnstile) window.turnstile.reset(form.querySelector('.cf-turnstile'));
        }
    });

    // Si el usuario cambia de idioma con un error visible, se re-traduce.
    document.querySelectorAll('.lang-option').forEach((btn) => {
        btn.addEventListener('click', () => {
            setTimeout(() => {
                if (!errorEl.hidden && errorEl.dataset.key) errorEl.textContent = t(errorEl.dataset.key);
            }, 300);
        });
    });
});
