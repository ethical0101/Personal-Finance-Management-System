/**
 * Tiny synchronous JSON-file datastore. Good enough for a single-instance
 * demo/review deployment; swap for a real database (Postgres/Mongo) before
 * any multi-instance or production use -- there is no locking here.
 *
 * On Vercel the deployment bundle is read-only except /tmp, and /tmp is not
 * persistent or shared across invocations/regions -- so on Vercel this data
 * resets unpredictably (typically on every cold start). That's an accepted
 * limitation for a demo deployment; swap this module for a hosted database
 * (Vercel Postgres, MongoDB Atlas, etc.) before relying on data surviving.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_DIR = process.env.VERCEL
  ? path.join("/tmp", "wealthline-data")
  : path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const COLLECTIONS = [
  "users", "accounts", "categories", "transactions",
  "budgets", "goals", "bills", "notifications",
];

const cache = {};

function fileFor(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

function load(name) {
  if (cache[name]) return cache[name];
  const f = fileFor(name);
  if (!fs.existsSync(f)) {
    cache[name] = [];
    return cache[name];
  }
  cache[name] = JSON.parse(fs.readFileSync(f, "utf-8"));
  return cache[name];
}

function persist(name) {
  fs.writeFileSync(fileFor(name), JSON.stringify(cache[name], null, 2));
}

for (const c of COLLECTIONS) load(c);

const db = {
  all(name) {
    return load(name);
  },
  find(name, predicate) {
    return load(name).filter(predicate);
  },
  findOne(name, predicate) {
    return load(name).find(predicate) || null;
  },
  insert(name, record) {
    const row = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...record };
    load(name).push(row);
    persist(name);
    return row;
  },
  update(name, id, patch) {
    const rows = load(name);
    const idx = rows.findIndex(r => r.id === id);
    if (idx === -1) return null;
    rows[idx] = { ...rows[idx], ...patch, updatedAt: new Date().toISOString() };
    persist(name);
    return rows[idx];
  },
  remove(name, id) {
    const rows = load(name);
    const idx = rows.findIndex(r => r.id === id);
    if (idx === -1) return false;
    rows.splice(idx, 1);
    persist(name);
    return true;
  },
};

module.exports = db;
