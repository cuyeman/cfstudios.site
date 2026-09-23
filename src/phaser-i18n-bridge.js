/**
 * src/phaser-i18n-bridge.js
 * Puente de idioma entre la Landing Page y el juego "Bram: La Luz que se Apaga" (Phaser 3).
 *
 * REQUISITO: el juego debe vivir en el MISMO dominio que la landing
 * (ej. cfstudios.site/prologo/) para poder leer localStorage compartido.
 * Si algún día se embebe desde un dominio externo, este puente no sirve
 * y hay que pasar el idioma por parámetro de URL en su lugar.
 *
 * USO DENTRO DE UNA SCENE DE PHASER:
 *
 *   import { loadGameLocale, gt } from './phaser-i18n-bridge.js';
 *
 *   class BootScene extends Phaser.Scene {
 *     async create() {
 *       await loadGameLocale();          // carga el idioma guardado por el sitio
 *       this.add.text(100, 100, gt('acto1_title'));
 *       this.add.text(100, 140, gt('edwin_dialog_1'));
 *     }
 *   }
 */

const FALLBACK_LANG = 'es';
// Ajusta esta ruta según dónde viva el archivo de Phaser respecto a /Lenguague/
// Si el juego está en /prologo/index.html (un nivel adentro de la raíz), usa '../Lenguague/'
const LOCALE_PATH = '../Lenguague/';

let prologoDict = null;

export async function loadGameLocale() {
    const lang = localStorage.getItem('pref_lang') || FALLBACK_LANG;

    try {
        const response = await fetch(`${LOCALE_PATH}${lang}.json`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        prologoDict = data.prologo || {};
        return prologoDict;
    } catch (error) {
        console.error('[Puente i18n] No se pudo cargar el idioma del juego:', error);
        // Failsafe: intenta cargar español como respaldo si el idioma elegido falla
        if (lang !== FALLBACK_LANG) {
            try {
                const res = await fetch(`${LOCALE_PATH}${FALLBACK_LANG}.json`);
                const data = await res.json();
                prologoDict = data.prologo || {};
                return prologoDict;
            } catch (e) {
                console.error('[Puente i18n] Tampoco se pudo cargar español:', e);
            }
        }
        prologoDict = {};
        return prologoDict;
    }
}

/** Traduce una llave del namespace "prologo" (ej. gt('edwin_dialog_1')) */
export function gt(key) {
    if (!prologoDict) {
        console.warn('[Puente i18n] Llamaste a gt() antes de loadGameLocale(). Revisa el orden en tu Scene.');
        return `[[${key}]]`;
    }
    return prologoDict[key] !== undefined ? prologoDict[key] : `[[${key}]]`;
}

/** Para diálogos con opciones (ej. bram_choices, que es un array) */
export function gtList(key) {
    if (!prologoDict) return [];
    return Array.isArray(prologoDict[key]) ? prologoDict[key] : [];
}
