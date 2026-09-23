/**
 * src/prologue-embed.js
 * Controla el botón "Pantalla completa" del reproductor embebido del Prólogo.
 * No hace nada si el iframe todavía no existe (mientras esté el placeholder),
 * así que es seguro dejarlo cargado desde ya.
 */
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('embedFullscreenBtn');
    const iframe = document.getElementById('prologueIframe');

    if (!btn || !iframe) return; // el reproductor real aún no está activado

    btn.addEventListener('click', () => {
        if (iframe.requestFullscreen) {
            iframe.requestFullscreen();
        } else if (iframe.webkitRequestFullscreen) {
            iframe.webkitRequestFullscreen();
        }
    });
});
