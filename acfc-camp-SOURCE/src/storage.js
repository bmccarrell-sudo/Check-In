/**
 * storage.js — localStorage
 * Pure client-side storage. Works on any static host.
 * Data persists on each device independently.
 */
const PFX = 'acfc-';

export async function sGet(key) {
  try {
    const v = localStorage.getItem(PFX + key);
    return v ? JSON.parse(v) : null;
  } catch { return null; }
}

export async function sSet(key, value) {
  try {
    localStorage.setItem(PFX + key, JSON.stringify(value));
  } catch {}
}
