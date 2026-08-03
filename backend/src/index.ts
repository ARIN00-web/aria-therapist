import 'dotenv/config';
import app from './app';
import { getConfig } from './config/env';
import { connectDatabase } from './config/db';
import { startSessionExpirySweep } from './services/session-expiry.service';

const config = getConfig();

connectDatabase()
  .then(() => {
    app.locals.dbReady = true;
    startSessionExpirySweep();
    app.listen(config.port, () => {
      console.log(`[server:start] port=${config.port}`);
    });
  })
  .catch((error) => {
    console.error('[server:db_connect_failed]', {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'unknown'
    });
    app.listen(config.port, () => {
      console.log(`[server:start] port=${config.port} (degraded: database unavailable)`);
    });
  });
