/**
 * MongoDB-backed datastore, kept behind the same tiny interface the JSON-file
 * version used (all/find/findOne/insert/update/remove) so every route file
 * only needed async/await added, not rewritten.
 *
 * `find`/`findOne` still take a plain JS predicate function, same as before
 * -- filtered in memory after fetching the collection, rather than translated
 * into a Mongo query. Collections here are small (a single demo/review
 * deployment), so that's a deliberate simplicity-over-scale tradeoff, not an
 * oversight; push filters down into the query if this ever needs to handle
 * real production volume.
 *
 * The client is cached at module scope so serverless invocations reuse the
 * same connection (and its connection pool) instead of opening a new one on
 * every request -- important on Vercel, where re-connecting per invocation
 * would both be slow and exhaust Atlas's connection limit under load.
 */
const { MongoClient } = require("mongodb");
const crypto = require("crypto");

let clientPromise = null;

function getClient() {
  if (!clientPromise) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI is not set.");
    clientPromise = new MongoClient(uri).connect();
  }
  return clientPromise;
}

async function collection(name) {
  const client = await getClient();
  return client.db("wealthline").collection(name);
}

const NO_ID = { projection: { _id: 0 } };

const db = {
  async all(name) {
    const c = await collection(name);
    return c.find({}, NO_ID).toArray();
  },
  async find(name, predicate) {
    const rows = await db.all(name);
    return rows.filter(predicate);
  },
  async findOne(name, predicate) {
    const rows = await db.all(name);
    return rows.find(predicate) || null;
  },
  async insert(name, record) {
    const c = await collection(name);
    const row = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...record };
    await c.insertOne({ ...row });
    return row;
  },
  async update(name, id, patch) {
    const c = await collection(name);
    const updatedFields = { ...patch, updatedAt: new Date().toISOString() };
    const result = await c.findOneAndUpdate({ id }, { $set: updatedFields }, { returnDocument: "after", projection: { _id: 0 } });
    return result?.value ?? result ?? null;
  },
  async remove(name, id) {
    const c = await collection(name);
    const result = await c.deleteOne({ id });
    return result.deletedCount > 0;
  },
};

module.exports = db;
