/**
 * Vercel serverless entry point.
 *
 * Load the output from `npm run build` rather than asking Vercel's function
 * compiler to transpile our TypeScript source a second time. Its CommonJS
 * transform incorrectly rewrites Better Auth's ESM-only `better-auth/node`
 * integration, causing ERR_REQUIRE_ESM at invocation time.
 */
let app;
let connectDatabase;

function loadBackend() {
  if (!app || !connectDatabase) {
    ({ default: app } = require('../dist/app'));
    ({ connectDatabase } = require('../dist/config/db'));
  }
}

module.exports = async function handler(req, res) {
  try {
    loadBackend();
    await connectDatabase();
    app.locals.dbReady = true;
    app(req, res);
  } catch (error) {
    console.error('[server:startup_failed]', {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'unknown'
    });
    res.status(503).json({
      error: 'Service configuration or database is unavailable. Check the Vercel function logs.'
    });
  }
};
