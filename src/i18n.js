
/**
 * src/i18n.js
 * Motor de traducción de Campfire Studios
 */

const supportedLanguages = ["es", "en", "pt", "hi"];

function detectBrowserLanguage() {
    const browserLanguage = navigator.language
        .toLowerCase()
        .split("-")[0];

    return supportedLanguages.includes(browserLanguage)
        ? browserLanguage
        : "en";
}

// Validar el idioma guardado
const savedLanguage = localStorage.getItem("pref_lang");

let currentLang = supportedLanguages.includes(savedLanguage)
    ? savedLanguage
    : detectBrowserLanguage();

/**
 * Busca llaves anidadas, por ejemplo:
 * landing.hero_title
 */
function resolveKey(translations, key) {
    try {
        return key.split(".").reduce(
            (obj, part) => obj?.[part],
            translations
        );
    } catch (error) {
        return undefined;
    }
}

async function loadLanguage(lang) {
    try {
        const response = await fetch(`Language/${lang}.json`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const translations = await response.json();

        // Permitir que el prólogo reutilice las traducciones
        window.activeLocale = translations;

        // Traducir elementos marcados
        document.querySelectorAll("[data-i18n]").forEach((elem) => {
            const key = elem.getAttribute("data-i18n");
            const text = resolveKey(translations, key);

            // No modificar elementos si la llave no existe
            if (typeof text !== "string") return;

            if (
                elem.tagName === "INPUT" ||
                elem.tagName === "TEXTAREA"
            ) {
                elem.placeholder = text;
            } else {
                elem.textContent = text;
            }
        });

        // Actualizar el idioma activo en el menú
        document.querySelectorAll(".lang-option").forEach((btn) => {
            btn.classList.toggle(
                "active",
                btn.dataset.lang === lang
            );
        });

        // Actualizar bandera, si existe
        const flagEl = document.getElementById("langFlag");

        if (flagEl && translations.meta?.flag) {
            flagEl.textContent = translations.meta.flag;
        }

        // Guardar idioma seleccionado
        currentLang = lang;
        localStorage.setItem("pref_lang", lang);
        document.documentElement.lang = lang;

    } catch (error) {
        console.error(
            `Error cargando el idioma "${lang}":`,
            error
        );
    }
}

function setLanguage(lang) {
    // CORREGIDO: usar supportedLanguages
    if (!supportedLanguages.includes(lang)) {
        lang = "es";
    }

    loadLanguage(lang);
}

document.addEventListener("DOMContentLoaded", () => {
    // Cargar idioma inicial
    loadLanguage(currentLang);

    const toggle = document.getElementById("langToggle");
    const menu = document.getElementById("langMenu");

    if (toggle && menu) {
        toggle.addEventListener("click", (event) => {
            event.stopPropagation();
            menu.classList.toggle("open");
        });

        document.querySelectorAll(".lang-option").forEach((btn) => {
            btn.addEventListener("click", () => {
                setLanguage(btn.dataset.lang);
                menu.classList.remove("open");
            });
        });

        document.addEventListener("click", () => {
            menu.classList.remove("open");
        });
    }
});