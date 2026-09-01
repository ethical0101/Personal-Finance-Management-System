// Vercel serverless entrypoint: every request under /api/* is routed here
// (see vercel.json rewrites) and handled by the same Express app used
// locally in app/server/index.js -- just without the static-file serving,
// which Vercel's CDN handles directly from app/web/dist.
module.exports = require("../app/server/app");
