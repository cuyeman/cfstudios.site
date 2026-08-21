/**
 * scr/i18n.js
 * Motor de traducción de la Landing Page — Campfire Studios
 *
 * Sigue el estándar del "Manual de Localización y Gestión Multi-idioma":
 *  - Fuente de verdad: Lenguague/{lang}.json
 *  - Persistencia: localStorage.setItem('pref_lang', lang)
 *  - Failsafe: si el fetch falla o una llave no existe, el elemento
 *    conserva el texto en español que ya está escrito en el HTML
 *    (nunca queda en blanco ni muestra la llave cruda).
 */

let currentLang = localStorage.getItem('pref_lang') || 'es';
const SUPPORTED_LANGS = ['es', 'en', 'pt', 'hi'];

/** Helper de búsqueda segura de llaves anidadas tipo "landing.hero_title" */
function resolveKey(translations, key) {
    try {
        return key.split('.').reduce((obj, part) => (obj ? obj[part] : undefined), translations);
    } catch (e) {
        return undefined;
    }
}

async function loadLanguage(lang) {
    try {
        const response = await fetch(`Lenguage/${lang}.json`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const translations = await response.json();

        // Se expone para que el Prólogo (Phaser 3) pueda reutilizarlo si se navega en la misma sesión
        window.activeLocale = translations;

        document.querySelectorAll('[data-i18n]').forEach((elem) => {
            const key = elem.getAttribute('data-i18n');
            const text = resolveKey(translations, key);

            // Failsafe: si "text" no existe, NO se toca el elemento.
            // El texto en español que ya está en el HTML queda como respaldo visible.
            if (text) {
                if (elem.tagName === 'INPUT' || elem.tagName === 'TEXTAREA') {
                    elem.placeholder = text;
                } else {
                    elem.textContent = text;
                }
            }
        });

        // Actualizar el selector visual de banderas
        document.querySelectorAll('.lang-option').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.lang === lang);
        });
        const flagEl = document.getElementById('langFlag');
        if (flagEl && translations.meta && translations.meta.flag) {
            flagEl.textContent = translations.meta.flag;
        }

        currentLang = lang;
        localStorage.setItem('pref_lang', lang);
        document.documentElement.lang = lang;
    } catch (error) {
        console.error('Error cargando el archivo de idioma:', error);
        // Failsafe: no se rompe nada. La página sigue mostrando el español
        // que ya está escrito por defecto en el HTML.
    }
}

function setLanguage(lang) {
    if (!SUPPORTED_LANGS.includes(lang)) lang = 'es';
    loadLanguage(lang);
}

document.addEventListener('DOMContentLoaded', () => {
    loadLanguage(currentLang);

    const toggle = document.getElementById('langToggle');
    const menu = document.getElementById('langMenu');

    if (toggle && menu) {
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            menu.classList.toggle('open');
        });

        document.querySelectorAll('.lang-option').forEach((btn) => {
            btn.addEventListener('click', () => {
                setLanguage(btn.dataset.lang);
                menu.classList.remove('open');
            });
        });

        document.addEventListener('click', () => menu.classList.remove('open'));
    }
});
