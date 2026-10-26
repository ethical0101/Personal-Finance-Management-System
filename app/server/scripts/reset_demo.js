/**
 * Deletes the demo account (demo@gmail.com) and everything it owns, so
 * seed_demo.js can rebuild it from scratch with dates relative to today.
 * Usage: node app/server/scripts/reset_demo.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { MongoClient } = require("mongodb");

(async () => {
  const client = await new MongoClient(process.env.MONGODB_URI).connect();
  const db = client.db("wealthline");
  const user = await db.collection("users").findOne({ email: "demo@gmail.com" });
  if (!user) { console.log("No demo user to reset."); return client.close(); }
  for (const c of ["accounts", "categories", "transactions", "budgets", "goals", "bills", "notifications"]) {
    const r = await db.collection(c).deleteMany({ userId: user.id });
    console.log(`${c}: removed ${r.deletedCount}`);
  }
  await db.collection("users").deleteOne({ id: user.id });
  console.log("demo user removed");
  await client.close();
})().catch(e => { console.error(e.message); process.exit(1); });
