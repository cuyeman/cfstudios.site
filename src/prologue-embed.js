/**
 * src/prologue-embed.js
 * Controla el botón "Pantalla completa" del reproductor embebido del Prólogo.
 * Usa delegación de eventos porque el iframe se crea después, cuando
 * src/beta-gate.js carga el juego; mientras no exista, no hace nada.
 */
document.addEventListener('click', (event) => {
    if (!event.target.closest('#embedFullscreenBtn')) return;

    const iframe = document.getElementById('prologueIframe');
    if (!iframe) return; // el reproductor real aún no está activado

    if (iframe.requestFullscreen) {
        iframe.requestFullscreen();
    } else if (iframe.webkitRequestFullscreen) {
        iframe.webkitRequestFullscreen();
    }
});
