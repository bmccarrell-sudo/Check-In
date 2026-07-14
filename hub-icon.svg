/**
 * camp-worker.js — Standalone Cloudflare Worker
 * ─────────────────────────────────────────────
 * Paste this entire file into the Cloudflare Workers editor.
 * See DEPLOY.md Step 2 for instructions.
 *
 * This worker provides a simple KV API for the camp check-in apps.
 * It runs independently of Cloudflare Pages.
 *
 * Routes:
 *   GET    /kv/:key  → read value
 *   PUT    /kv/:key  → write value (body = JSON)
 *   DELETE /kv/:key  → delete value
 */

const CORS = {
  "Content-Type":                "application/json",
  "Cache-Control":               "no-store",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods":"GET, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":"Content-Type",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    // Only handle /kv/ routes
    if (!url.pathname.startsWith("/kv/")) {
      return new Response("Camp KV API — use /kv/:key", { status: 200 });
    }

    const key = decodeURIComponent(url.pathname.slice(4)); // strip "/kv/"

    if (request.method === "GET") {
      try {
        const value = await env.CAMP_KV.get(key);
        return new Response(value ?? "null", { headers: CORS });
      } catch {
        return new Response("null", { status: 500, headers: CORS });
      }
    }

    if (request.method === "PUT") {
      try {
        const body = await request.text();
        await env.CAMP_KV.put(key, body);
        return new Response('{"ok":true}', { headers: CORS });
      } catch {
        return new Response('{"ok":false}', { status: 500, headers: CORS });
      }
    }

    if (request.method === "DELETE") {
      try {
        await env.CAMP_KV.delete(key);
        return new Response('{"ok":true}', { headers: CORS });
      } catch {
        return new Response('{"ok":false}', { status: 500, headers: CORS });
      }
    }

    return new Response("Method not allowed", { status: 405, headers: CORS });
  },
};
