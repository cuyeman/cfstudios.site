/**
 * beta-worker/src/index.js
 * Beta privada de "Bram: La Luz que se Apaga" en cfstudios.games/beta/*.
 *
 * - La clave cambia cada día (hora de Chile) y se calcula con HMAC(BETA_SECRET, fecha),
 *   así que no hay base de datos ni que cambiarla a mano.
 * - Al acertar la clave se entrega una cookie firmada que solo vale para ese día.
 * - Los archivos del juego viven en el bucket R2 privado (GAME_BUCKET), nunca en el repo.
 * - Todos los días a las 00:00 (hora de Chile) se publica la clave nueva en Discord.
 *
 * Secretos requeridos (wrangler secret put ...):
 *   BETA_SECRET          texto largo y aleatorio; si se cambia, cambian todas las claves
 *   TURNSTILE_SECRET     clave secreta del widget Turnstile del sitio
 *   DISCORD_WEBHOOK_URL  webhook del canal de Discord donde se publica la clave
 *   ADMIN_TOKEN          token para POST /beta/admin/announce (reenviar la clave a mano)
 */

const TIME_ZONE = 'America/Santiago';
const COOKIE_NAME = 'cf_beta';
const SITE_URL = 'https://cfstudios.games/#bram-fading-light';

// Palabras de la clave diaria: FOGATA-4821, FARO-0193, ...
const WORDS = [
    'FOGATA', 'FARO', 'BRASA', 'CHISPA', 'CENIZA', 'LLAMA',
    'LINTERNA', 'HOGUERA', 'ANTORCHA', 'BOSQUE', 'NIEBLA', 'TORMENTA'
];

const CONTENT_TYPES = {
    html: 'text/html; charset=utf-8',
    js: 'text/javascript; charset=utf-8',
    mjs: 'text/javascript; charset=utf-8',
    css: 'text/css; charset=utf-8',
    json: 'application/json; charset=utf-8',
    wasm: 'application/wasm',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    mp3: 'audio/mpeg',
    ogg: 'audio/ogg',
    wav: 'audio/wav',
    m4a: 'audio/mp4',
    mp4: 'video/mp4',
    webm: 'video/webm',
    ttf: 'font/ttf',
    otf: 'font/otf',
    woff: 'font/woff',
    woff2: 'font/woff2',
    xml: 'application/xml',
    txt: 'text/plain; charset=utf-8'
};

/* ---------- Fecha y claves ---------- */

// Fecha actual en Chile como "AAAA-MM-DD".
function todayInChile(date = new Date()) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(date);
}

function hourInChile(date = new Date()) {
    return Number(new Intl.DateTimeFormat('en-US', {
        timeZone: TIME_ZONE, hour: '2-digit', hourCycle: 'h23'
    }).format(date));
}

async function hmac(secret, message) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw', encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
    return new Uint8Array(signature);
}

async function dailyPassword(env, day) {
    const bytes = await hmac(env.BETA_SECRET, `password:${day}`);
    const word = WORDS[bytes[0] % WORDS.length];
    const number = (((bytes[1] << 8) | bytes[2]) % 10000).toString().padStart(4, '0');
    return `${word}-${number}`;
}

// Acepta "fogata 4821", "FOGATA-4821", "Fogata4821"...
function normalize(password) {
    return String(password || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function toBase64Url(bytes) {
    return btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Comparación en tiempo constante para no filtrar información por tiempos de respuesta.
function safeEqual(a, b) {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
        diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
}

/* ---------- Cookie de acceso ---------- */

async function cookieSignature(env, day) {
    return toBase64Url(await hmac(env.BETA_SECRET, `cookie:${day}`));
}

async function buildAccessCookie(env, day) {
    const value = `${day}.${await cookieSignature(env, day)}`;
    // La cookie dura como máximo 24 h, pero el Worker la rechaza en cuanto cambia el día.
    return `${COOKIE_NAME}=${value}; Path=/beta; Max-Age=86400; HttpOnly; Secure; SameSite=Lax`;
}

async function hasAccess(request, env) {
    const cookies = request.headers.get('Cookie') || '';
    const match = cookies.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
    if (!match) return false;

    const [day, signature] = match[1].split('.');
    if (day !== todayInChile() || !signature) return false;

    return safeEqual(signature, await cookieSignature(env, day));
}

/* ---------- Turnstile ---------- */

async function verifyTurnstile(env, token, ip) {
    if (!token) return false;

    const body = new FormData();
    body.append('secret', env.TURNSTILE_SECRET);
    body.append('response', token);
    if (ip) body.append('remoteip', ip);

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST', body
    });
    const result = await response.json();
    return result.success === true;
}

/* ---------- Rutas ---------- */

function json(data, status = 200, extraHeaders = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            ...extraHeaders
        }
    });
}

async function handleUnlock(request, env) {
    let payload;
    try {
        payload = await request.json();
    } catch {
        return json({ ok: false, error: 'bad_request' }, 400);
    }

    const ip = request.headers.get('CF-Connecting-IP');
    if (!(await verifyTurnstile(env, payload.token, ip))) {
        return json({ ok: false, error: 'captcha' }, 400);
    }

    const day = todayInChile();
    const expected = normalize(await dailyPassword(env, day));
    if (!safeEqual(normalize(payload.password), expected)) {
        return json({ ok: false, error: 'wrong' }, 401);
    }

    return json({ ok: true }, 200, { 'Set-Cookie': await buildAccessCookie(env, day) });
}

async function handleGameFile(request, env, path) {
    if (!(await hasAccess(request, env))) {
        return new Response(
            '<!doctype html><meta charset="utf-8"><title>Beta privada</title>' +
            '<body style="background:#0a0a0c;color:#f0f0f5;font-family:sans-serif;' +
            'display:grid;place-items:center;height:100vh;margin:0;text-align:center">' +
            '<p>La clave de la beta venció o no es válida.<br>' +
            `Vuelve a <a style="color:#ff6b35" href="${SITE_URL}" target="_top">cfstudios.games</a> ` +
            'e ingresa la clave de hoy.</p>',
            { status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } }
        );
    }

    let key = decodeURIComponent(path.replace(/^\/beta\/game\/?/, ''));
    if (key === '' || key.endsWith('/')) key += 'index.html';
    if (key.split('/').includes('..')) return new Response('Not found', { status: 404 });

    const object = await env.GAME_BUCKET.get(key);
    if (!object) return new Response('Not found', { status: 404 });

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    if (!headers.has('Content-Type')) {
        const extension = key.split('.').pop().toLowerCase();
        headers.set('Content-Type', CONTENT_TYPES[extension] || 'application/octet-stream');
    }
    headers.set('ETag', object.httpEtag);
    // "private": solo el navegador del jugador guarda copia, nunca un caché compartido.
    headers.set('Cache-Control', 'private, max-age=3600');
    headers.set('X-Robots-Tag', 'noindex');

    return new Response(object.body, { headers });
}

/* ---------- Discord ---------- */

async function postPasswordToDiscord(env) {
    const day = todayInChile();
    const password = await dailyPassword(env, day);

    const response = await fetch(env.DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            content:
                `🔥 **Clave de la beta privada — ${day}**\n` +
                `\`${password}\`\n` +
                `Válida hasta las 23:59 (hora de Chile). Juega aquí: ${SITE_URL}\n` +
                '_No la compartas fuera del servidor: mañana habrá una nueva._'
        })
    });

    if (!response.ok) {
        throw new Error(`Discord respondió ${response.status}: ${await response.text()}`);
    }
}

export default {
    async fetch(request, env) {
        const { pathname } = new URL(request.url);

        if (pathname === '/beta/unlock' && request.method === 'POST') {
            return handleUnlock(request, env);
        }

        if (pathname === '/beta/status' && request.method === 'GET') {
            return json({ unlocked: await hasAccess(request, env) });
        }

        if (pathname.startsWith('/beta/game') && request.method === 'GET') {
            return handleGameFile(request, env, pathname);
        }

        // Reenvía la clave de hoy a Discord sin esperar al cron (lanzamiento o si falló).
        if (pathname === '/beta/admin/announce' && request.method === 'POST') {
            const auth = request.headers.get('Authorization') || '';
            if (!env.ADMIN_TOKEN || !safeEqual(auth, `Bearer ${env.ADMIN_TOKEN}`)) {
                return json({ ok: false }, 401);
            }
            await postPasswordToDiscord(env);
            return json({ ok: true });
        }

        return new Response('Not found', { status: 404 });
    },

    // Los cron corren en UTC y Chile cambia de horario (UTC-3 / UTC-4),
    // por eso hay dos disparos y solo publica el que cae a las 00:00 en Chile.
    async scheduled(event, env, ctx) {
        if (hourInChile(new Date(event.scheduledTime)) !== 0) return;
        ctx.waitUntil(postPasswordToDiscord(env));
    }
};
