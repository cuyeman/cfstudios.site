# Beta privada (Cloudflare Worker)

Protege el juego en `cfstudios.games/beta/*` con una clave que cambia cada día
y se publica automáticamente en Discord a las 00:00 (hora de Chile).

```
Discord (#beta) ←── clave diaria (cron 00:00) ──┐
                                                 │
index.html → "Jugar la beta privada" → clave + Turnstile → POST /beta/unlock (Worker)
                                                 │  ✔ cookie válida hasta medianoche
                                                 ▼
                         <iframe src="/beta/game/"> ← archivos del juego en R2 (privado)
```

- La clave es `PALABRA-NNNN` (ej. `FOGATA-4821`) y se calcula con `BETA_SECRET` + la fecha:
  no hay base de datos ni que cambiarla a mano.
- Las cookies del día anterior dejan de valer a medianoche.
- **El build del juego nunca se sube a este repo**: va al bucket R2.

## Requisitos

- El dominio `cfstudios.games` en Cloudflare con el registro de GitHub Pages **proxied** (nube naranja).
  Sin el proxy, la ruta `/beta/*` no pasa por el Worker.
- Node.js 18+ para usar `wrangler` (o hacer todo desde el panel de Cloudflare, ver abajo).

## Despliegue con wrangler

```sh
cd beta-worker
npx wrangler login

# 1. Bucket privado y subir el build del juego (index.html en la raíz del bucket)
npx wrangler r2 bucket create cfstudios-beta-game
npx wrangler r2 object put cfstudios-beta-game/index.html --file ../ruta/al/build/index.html --remote
#    ...repetir por cada archivo, o arrastrar la carpeta en el panel de R2 (más cómodo)

# 2. Secretos
npx wrangler secret put BETA_SECRET          # texto largo aleatorio (ej. 40+ caracteres)
npx wrangler secret put TURNSTILE_SECRET     # Turnstile → widget del sitio → Secret Key
npx wrangler secret put DISCORD_WEBHOOK_URL  # Discord → canal → Integraciones → Webhooks
npx wrangler secret put ADMIN_TOKEN          # otro texto aleatorio, para reenviar la clave

# 3. Publicar
npx wrangler deploy
```

## Despliegue solo desde el panel de Cloudflare (sin Node)

1. **R2** → Create bucket `cfstudios-beta-game` → subir los archivos del build (la carpeta completa).
2. **Workers & Pages** → Create Worker → pegar `src/index.js` → Deploy.
3. En el Worker → **Settings**:
   - *Bindings* → R2 bucket → nombre `GAME_BUCKET`, bucket `cfstudios-beta-game`.
   - *Variables and Secrets* → agregar como **Secret**: `BETA_SECRET`, `TURNSTILE_SECRET`,
     `DISCORD_WEBHOOK_URL`, `ADMIN_TOKEN`.
   - *Domains & Routes* → Add route → `cfstudios.games/beta/*`.
   - *Trigger Events* → Cron → `0 3 * * *` y `0 4 * * *`.

## Uso diario

- No hay que hacer nada: la clave se publica sola en Discord cada medianoche.
- **Día del lanzamiento** (o si un día no se publicó), reenviar la clave de hoy:

  ```sh
  curl -X POST https://cfstudios.games/beta/admin/announce -H "Authorization: Bearer <ADMIN_TOKEN>"
  ```

- **Actualizar el juego:** volver a subir los archivos al bucket. No hace falta redesplegar el Worker.
- **Cerrar la beta:** quitar la ruta `cfstudios.games/beta/*` del Worker (o vaciar el bucket).
- Cambiar `BETA_SECRET` invalida todas las claves y cookies al instante.

## Métricas (GA4)

`src/beta-gate.js` envía estos eventos a Google Analytics:
`beta_unlock` (clave correcta), `beta_unlock_failed` (clave incorrecta) y `beta_game_loaded`.
