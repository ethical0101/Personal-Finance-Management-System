/**
 * Caches expensive, deterministic-enough AI results in MongoDB so identical
 * requests don't spend Gemini quota (or wait several seconds) twice.
 * Keys are hashes that include the user id, so one user's cached answer is
 * never served to another, and a change in the user's data changes the key.
 */
const crypto = require("crypto");
const db = require("../db");

const DAY = 24 * 60 * 60 * 1000;
const hash = (...parts) => crypto.createHash("sha256").update(parts.map(p => (typeof p === "string" ? p : JSON.stringify(p))).join("|")).digest("hex").slice(0, 40);

/** Returns the cached value for `key`, or computes it with `fn()` and stores it when `fn` returns a truthy `ok`. */
async function cached(key, ttlMs, fn, shouldStore = v => v && v.ok) {
  try {
    const hit = await db.cacheGet(key);
    if (hit) return { ...hit, cached: true };
  } catch (e) { /* cache problems must never break the feature */ }
  const value = await fn();
  if (shouldStore(value)) { try { await db.cacheSet(key, value, ttlMs); } catch (e) { /* ignore */ } }
  return value;
}

module.exports = { cached, hash, DAY };
