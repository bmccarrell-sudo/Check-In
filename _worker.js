/**
 * _worker.js — Cloudflare Pages Worker
 *
 * Handles KV read/write for the camp check-in apps.
 * Static assets (HTML, JS, CSS) are served automatically via env.ASSETS.
 *
 * This file works with Cloudflare Pages Direct Upload.
 * The CAMP_KV binding is configured in the Pages project settings.
 */

const CORS = {
  "Content-Type":  "application/json",
  "Cache-Control": "no-store",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ── KV API routes ─────────────────────────────────────────────────────────
    if (url.pathname.startsWith("/api/kv/")) {
      const key = decodeURIComponent(url.pathname.slice("/api/kv/".length));

      // GET — read a value
      if (request.method === "GET") {
        try {
          const value = await env.CAMP_KV.get(key);
          return new Response(value ?? "null", { headers: CORS });
        } catch {
          return new Response("null", { status: 500, headers: CORS });
        }
      }

      // PUT — write a value
      if (request.method === "PUT") {
        try {
          const body = await request.text();
          await env.CAMP_KV.put(key, body);
          return new Response('{"ok":true}', { headers: CORS });
        } catch {
          return new Response('{"ok":false}', { status: 500, headers: CORS });
        }
      }

      // DELETE — remove a value
      if (request.method === "DELETE") {
        try {
          await env.CAMP_KV.delete(key);
          return new Response('{"ok":true}', { headers: CORS });
        } catch {
          return new Response('{"ok":false}', { status: 500, headers: CORS });
        }
      }

      // OPTIONS — CORS preflight
      if (request.method === "OPTIONS") {
        return new Response(null, { headers: CORS });
      }
    }

    // ── Everything else → serve static files ─────────────────────────────────
    return env.ASSETS.fetch(request);
  },
};
