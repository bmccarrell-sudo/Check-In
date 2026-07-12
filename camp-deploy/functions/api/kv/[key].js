/**
 * Cloudflare Pages Function — /api/kv/:key
 *
 * Provides a simple REST interface over Cloudflare KV.
 * The binding name CAMP_KV must match wrangler.toml.
 *
 * GET    /api/kv/:key  → returns the stored JSON value (or null)
 * PUT    /api/kv/:key  → body = JSON value to store
 * DELETE /api/kv/:key  → removes the key
 */

const CORS = {
  'Content-Type':                'application/json',
  'Cache-Control':               'no-store',
  'Access-Control-Allow-Origin': '*',
};

export async function onRequestGet({ params, env }) {
  try {
    const key   = decodeURIComponent(params.key);
    const value = await env.CAMP_KV.get(key);
    return new Response(value ?? 'null', { headers: CORS });
  } catch (e) {
    return new Response('null', { status: 500, headers: CORS });
  }
}

export async function onRequestPut({ params, request, env }) {
  try {
    const key  = decodeURIComponent(params.key);
    const body = await request.text();
    await env.CAMP_KV.put(key, body);
    return new Response('{"ok":true}', { headers: CORS });
  } catch (e) {
    return new Response('{"ok":false}', { status: 500, headers: CORS });
  }
}

export async function onRequestDelete({ params, env }) {
  try {
    const key = decodeURIComponent(params.key);
    await env.CAMP_KV.delete(key);
    return new Response('{"ok":true}', { headers: CORS });
  } catch (e) {
    return new Response('{"ok":false}', { status: 500, headers: CORS });
  }
}

// Handle preflight
export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}
