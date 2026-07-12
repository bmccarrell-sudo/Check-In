/**
 * storage.js — Universal storage layer
 *
 * DEV  (npm run dev):  uses localStorage so you can work offline
 * PROD (Cloudflare):   calls the Pages Function at /api/kv/:key
 *                      which reads/writes Cloudflare KV
 */

const IS_DEV = import.meta.env.DEV;
const LS_PREFIX = 'acfc-camp-';

export async function sGet(key) {
  if (IS_DEV) {
    try {
      const v = localStorage.getItem(LS_PREFIX + key);
      return v ? JSON.parse(v) : null;
    } catch { return null; }
  }

  try {
    const res = await fetch(`/api/kv/${encodeURIComponent(key)}`);
    if (!res.ok) return null;
    const text = await res.text();
    return text === 'null' || !text ? null : JSON.parse(text);
  } catch { return null; }
}

export async function sSet(key, value) {
  if (IS_DEV) {
    try {
      localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
    } catch {}
    return;
  }

  try {
    await fetch(`/api/kv/${encodeURIComponent(key)}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(value),
    });
  } catch {}
}
