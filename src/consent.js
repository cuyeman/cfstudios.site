/**
 * src/consent.js
 * Aviso de consentimiento de cookies.
 *
 * Google Analytics NO se descarga ni deja cookies hasta que el visitante pulsa "Aceptar".
 * Si rechaza (o no responde), el sitio funciona igual y no se mide nada.
 * La decisión se guarda en localStorage y se puede cambiar desde el pie de página
 * ("Preferencias de cookies").
 *
 * Este archivo se carga en el <head>, antes que el resto de los scripts.
 */
(() => {
    const GA_ID = 'G-7QJPS29EPC';
    const STORAGE_KEY = 'cookie_consent'; // 'granted' | 'denied'
    const RENEW_AFTER_DAYS = 180;         // se vuelve a preguntar pasado este plazo

    // gtag() existe siempre para que el resto del sitio pueda llamarlo sin errores;
    // mientras Analytics no esté cargado, los eventos simplemente no salen del navegador.
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() { window.dataLayer.push(arguments); };

    // Por defecto todo denegado (Consent Mode v2).
    gtag('consent', 'default', {
        analytics_storage: 'denied',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied'
    });

    function readChoice() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
            if (!saved || (saved.value !== 'granted' && saved.value !== 'denied')) return null;
            const ageDays = (Date.now() - saved.date) / 86400000;
            return ageDays >= 0 && ageDays < RENEW_AFTER_DAYS ? saved.value : null;
        } catch {
            return null;
        }
    }

    function saveChoice(value) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ value, date: Date.now() }));
        } catch {
            // Navegación privada sin almacenamiento: la decisión vale solo para esta visita.
        }
    }

    let analyticsLoaded = false;

    function loadAnalytics() {
        if (analyticsLoaded) return;
        analyticsLoaded = true;

        gtag('consent', 'update', { analytics_storage: 'granted' });
        gtag('js', new Date());
        gtag('config', GA_ID);

        const script = document.createElement('script');
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
        document.head.appendChild(script);
    }

    // Borra las cookies de Analytics (_ga, _ga_XXXX...) cuando se retira el consentimiento.
    function clearAnalyticsCookies() {
        const host = location.hostname;
        const domains = ['', host, '.' + host, '.' + host.split('.').slice(-2).join('.')];

        document.cookie.split(';').forEach((cookie) => {
            const name = cookie.split('=')[0].trim();
            if (!/^_ga|^_gid$|^_gat/.test(name)) return;
            domains.forEach((domain) => {
                document.cookie = `${name}=; Max-Age=0; Path=/` + (domain ? `; Domain=${domain}` : '');
            });
        });
    }

    if (readChoice() === 'granted') loadAnalytics();

    document.addEventListener('DOMContentLoaded', () => {
        const banner = document.getElementById('consentBanner');
        const acceptBtn = document.getElementById('consentAccept');
        const rejectBtn = document.getElementById('consentReject');
        const manageBtn = document.getElementById('consentManage');

        if (!banner || !acceptBtn || !rejectBtn) return;

        acceptBtn.addEventListener('click', () => {
            saveChoice('granted');
            banner.hidden = true;
            loadAnalytics();
        });

        rejectBtn.addEventListener('click', () => {
            const hadAnalytics = analyticsLoaded;
            saveChoice('denied');
            banner.hidden = true;
            gtag('consent', 'update', { analytics_storage: 'denied' });
            clearAnalyticsCookies();
            // Analytics ya estaba en memoria: recargar es la única forma de apagarlo del todo.
            if (hadAnalytics) location.reload();
        });

        if (manageBtn) {
            manageBtn.addEventListener('click', () => {
                banner.hidden = false;
                acceptBtn.focus();
            });
        }

        if (readChoice() === null) banner.hidden = false;
    });
})();
